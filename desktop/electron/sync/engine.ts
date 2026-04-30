import fs from 'fs'
import path from 'path'
import chokidar, { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import {
  configGet, upsertFolder, batchUpsertFolders, upsertDocument, batchUpsertDocuments,
  getAllDocuments, getAllFolders,
  getDocumentByLocalPath, setDocumentStatus, setDocumentMtime, deleteDocumentRecord, clearAll,
} from './db'
import {
  ApiAuth, apiFetchFolders, apiFetchAllDocuments, apiDownloadDocument,
  apiUploadDocument, apiCreateFolder, ServerFolder,
} from './api'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncState {
  status: SyncStatus
  lastSync: string | null
  pending: number
  errors: string[]
}

const state: SyncState = {
  status: 'idle',
  lastSync: null,
  pending: 0,
  errors: [],
}

let pollTimer: NodeJS.Timeout | null = null
let watcher: FSWatcher | null = null
const uploadDebounce = new Map<string, NodeJS.Timeout>()
let mainWindow: BrowserWindow | null = null

export function setWindow(win: BrowserWindow): void {
  mainWindow = win
}

function emit(channel: string, data?: any): void {
  mainWindow?.webContents?.send(channel, data)
}

function setState(patch: Partial<SyncState>): void {
  Object.assign(state, patch)
  emit('sync:state', { ...state })
}

export function getSyncState(): SyncState {
  return { ...state }
}

function getAuth(): ApiAuth | null {
  const serverUrl = configGet('server_url')
  const token = configGet('token')
  if (!serverUrl || !token) return null
  return { serverUrl, token }
}

function getSyncFolder(): string | null {
  return configGet('sync_folder')
}

// ── Concurrency helper ────────────────────────────────────────────────────────

async function runConcurrent(tasks: (() => Promise<void>)[], concurrency: number): Promise<void> {
  const queue = [...tasks]
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift()
      if (task) await task()
    }
  })
  await Promise.all(workers)
}

// ── Full sync ─────────────────────────────────────────────────────────────────

export async function runFullSync(): Promise<void> {
  const auth = getAuth()
  const syncFolder = getSyncFolder()
  if (!auth || !syncFolder) return
  if (state.status === 'syncing') return

  setState({ status: 'syncing', errors: [] })
  emit('sync:start')

  try {
    // 1. Fetch all folders from server
    const serverFolders = await apiFetchFolders(auth)
    const flatFolders = flattenFolders(serverFolders, null)

    // 2. Build local folder structure — single DB write
    const folderRecords: { id: number; name: string; parent_id: number | null; local_path: string }[] = []
    for (const sf of flatFolders) {
      const localPath = buildFolderPath(syncFolder, sf.id, flatFolders)
      if (!fs.existsSync(localPath)) fs.mkdirSync(localPath, { recursive: true })
      folderRecords.push({ id: sf.id, name: sf.name, parent_id: sf.parent_id, local_path: localPath })
    }
    batchUpsertFolders(folderRecords)

    // 3. Folders only at startup — documents loaded lazily per folder

    setState({ status: 'idle', lastSync: new Date().toISOString(), pending: 0 })
    emit('sync:done', { downloaded: 0 })
  } catch (err: any) {
    console.error('[HestiDMS] runFullSync error:', err)
    if (err?.response?.status === 401) {
      emit('auth:expired')
      setState({ status: 'error', errors: ['Sesiune expirată — reconectare necesară'] })
    } else {
      const msg = err?.response?.data?.detail ?? err.message ?? 'Sync error'
      console.error('[HestiDMS] error detail:', msg)
      setState({ status: 'error', errors: [msg] })
    }
  }
}

// ── On-demand sync ────────────────────────────────────────────────────────────

export async function syncFolderById(folderId: number | null): Promise<void> {
  const auth = getAuth()
  const syncFolder = getSyncFolder()
  if (!auth || !syncFolder) return

  setState({ status: 'syncing', errors: [] })

  try {
    // Fetch fresh doc list from server for this folder
    const serverDocs = await apiFetchDocuments(auth, folderId)
    const currentFolders = new Map(getAllFolders().map(f => [f.id, f]))
    const localDocsMap = new Map(getAllDocuments().map(d => [d.id, d]))

    // Build doc records with local paths
    const docsWithPaths = serverDocs.map(doc => {
      const folderRecord = doc.folder_id ? currentFolders.get(doc.folder_id) : null
      const localDir = folderRecord?.local_path ?? syncFolder
      const localPath = path.join(localDir, sanitizeName(doc.name))
      const existing = localDocsMap.get(doc.id)
      const isSynced = existing?.sync_status === 'synced'
        && fs.existsSync(localPath)
        && doc.version <= (existing.version ?? 0)
      return {
        id: doc.id, name: doc.name, folder_id: doc.folder_id,
        local_path: localPath, file_size: doc.file_size,
        version: doc.version, content_type: doc.content_type,
        server_created_at: doc.created_at,
        local_mtime: existing?.local_mtime ?? 0,
        sync_status: isSynced ? 'synced' : 'available',
      }
    })
    batchUpsertDocuments(docsWithPaths)

    const toDownload = docsWithPaths.filter(d => d.sync_status === 'available')
    setState({ pending: toDownload.length })

    const tasks = toDownload.map(doc => () => downloadDocumentRecord(auth, doc))
    await runConcurrent(tasks, 5)
  } catch (err: any) {
    console.error('[HestiDMS] syncFolderById error:', err)
    state.errors.push(err?.response?.data?.detail ?? err.message ?? 'Sync error')
  }

  setState({ status: 'idle', pending: 0 })
  emit('sync:done', { downloaded: 0 })
}

export async function syncDocumentById(docId: number): Promise<void> {
  const auth = getAuth()
  if (!auth) return
  const doc = getAllDocuments().find(d => d.id === docId)
  if (!doc) return
  setState({ status: 'syncing', pending: 1 })
  await downloadDocumentRecord(auth, doc)
  setState({ status: 'idle', pending: 0 })
  emit('sync:done', { downloaded: 1 })
}

async function downloadDocumentRecord(auth: ApiAuth, doc: ReturnType<typeof getAllDocuments>[number]): Promise<void> {
  setDocumentStatus(doc.id, 'downloading')
  emit('sync:file', { type: 'download', name: doc.name })
  try {
    await apiDownloadDocument(auth, doc.id, doc.local_path)
    const stat = fs.statSync(doc.local_path)
    upsertDocument({ ...doc, local_mtime: stat.mtimeMs, sync_status: 'synced' })
    emit('sync:file', { type: 'downloaded', name: doc.name, id: doc.id })
  } catch (err: any) {
    setDocumentStatus(doc.id, 'error')
    state.errors.push(`Download failed: ${doc.name}`)
  }
}

// ── Reconciliation: upload untracked local files ──────────────────────────────

async function reconcileLocalFiles(auth: ApiAuth, syncFolder: string): Promise<void> {
  const knownPaths = new Set(getAllDocuments().map(d => d.local_path))

  const scanDir = (dir: string): string[] => {
    const files: string[] = []
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name.includes('_conflict_')) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) files.push(...scanDir(full))
        else files.push(full)
      }
    } catch {}
    return files
  }

  for (const filePath of scanDir(syncFolder)) {
    if (!knownPaths.has(filePath)) {
      await uploadLocalFile(filePath, auth)
    }
  }
}

// ── File watcher ──────────────────────────────────────────────────────────────

export function startWatcher(): void {
  const syncFolder = getSyncFolder()
  if (!syncFolder || watcher) return

  watcher = chokidar.watch(syncFolder, {
    ignored: /(^|[/\\])(\.|.*_conflict_)/,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 },
  })

  watcher.on('add', (filePath) => scheduleUpload(filePath))
  watcher.on('change', (filePath) => scheduleUpload(filePath))
  watcher.on('unlink', (filePath) => handleLocalDelete(filePath))
  watcher.on('addDir', (dirPath) => {
    if (dirPath === getSyncFolder()) return
    handleLocalMkdir(dirPath)
  })
}

export function stopWatcher(): void {
  watcher?.close()
  watcher = null
}

function scheduleUpload(filePath: string): void {
  const existing = uploadDebounce.get(filePath)
  if (existing) clearTimeout(existing)
  uploadDebounce.set(filePath, setTimeout(() => {
    uploadDebounce.delete(filePath)
    const auth = getAuth()
    if (auth) uploadLocalFile(filePath, auth)
  }, 3000))
}

async function uploadLocalFile(filePath: string, auth: ApiAuth): Promise<void> {
  const syncFolder = getSyncFolder()
  if (!syncFolder) return

  const existing = getDocumentByLocalPath(filePath)
  if (existing?.sync_status === 'downloading') return

  const folders = getAllFolders()
  const parentDir = path.dirname(filePath)
  const matchedFolder = folders.find(f => f.local_path === parentDir) ?? null
  const folderId = matchedFolder?.id ?? null

  emit('sync:file', { type: 'upload', name: path.basename(filePath) })
  try {
    const doc = await apiUploadDocument(auth, filePath, folderId)
    const stat = fs.statSync(filePath)
    upsertDocument({
      id: doc.id, name: doc.name, folder_id: folderId,
      local_path: filePath, file_size: doc.file_size,
      version: doc.version, content_type: doc.content_type,
      server_created_at: doc.created_at, local_mtime: stat.mtimeMs,
      sync_status: 'synced',
    })
    emit('sync:file', { type: 'uploaded', name: path.basename(filePath) })
  } catch (err: any) {
    state.errors.push(`Upload failed: ${path.basename(filePath)}`)
  }
}

function handleLocalDelete(filePath: string): void {
  const doc = getDocumentByLocalPath(filePath)
  if (doc) deleteDocumentRecord(doc.id)
  // Intentional: don't auto-delete from server on local delete
}

async function handleLocalMkdir(dirPath: string): Promise<void> {
  const auth = getAuth()
  if (!auth) return

  const syncFolder = getSyncFolder()!
  const folders = getAllFolders()
  if (folders.find(f => f.local_path === dirPath)) return

  const parentDir = path.dirname(dirPath)
  const parentFolder = parentDir === syncFolder
    ? null
    : folders.find(f => f.local_path === parentDir) ?? null
  const parentId = parentFolder?.id ?? null
  const name = path.basename(dirPath)

  try {
    const created = await apiCreateFolder(auth, name, parentId)
    upsertFolder(created.id, created.name, parentId, dirPath)
  } catch {}
}

// ── Polling ───────────────────────────────────────────────────────────────────

export function startPolling(intervalMs = 60_000): void {
  if (pollTimer) return
  pollTimer = setInterval(() => runFullSync(), intervalMs)
}

export function stopPolling(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

// ── Start / Stop ──────────────────────────────────────────────────────────────

export async function startEngine(): Promise<void> {
  await runFullSync()
  startWatcher()
  startPolling()
}

export function stopEngine(): void {
  stopWatcher()
  stopPolling()
  // Cancel pending upload debounces
  for (const t of uploadDebounce.values()) clearTimeout(t)
  uploadDebounce.clear()
}

export function resetEngine(): void {
  stopEngine()
  clearAll()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface FlatFolder { id: number; name: string; parent_id: number | null }

function flattenFolders(folders: ServerFolder[], parentId: number | null): FlatFolder[] {
  const result: FlatFolder[] = []
  for (const f of folders) {
    result.push({ id: f.id, name: f.name, parent_id: parentId })
    if (f.children?.length) result.push(...flattenFolders(f.children, f.id))
  }
  return result
}

function buildFolderPath(syncRoot: string, folderId: number, flat: FlatFolder[]): string {
  const folder = flat.find(f => f.id === folderId)
  if (!folder) return syncRoot
  const segments: string[] = []
  let current: FlatFolder | undefined = folder
  while (current) {
    segments.unshift(sanitizeName(current.name))
    current = current.parent_id !== null ? flat.find(f => f.id === current!.parent_id) : undefined
  }
  return path.join(syncRoot, ...segments)
}

function sanitizeName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_')
}
