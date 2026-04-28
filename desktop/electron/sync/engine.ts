import fs from 'fs'
import path from 'path'
import chokidar, { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import {
  configGet, upsertFolder, upsertDocument, getAllDocuments, getAllFolders,
  getDocumentByLocalPath, setDocumentStatus, setDocumentMtime, deleteDocumentRecord, clearAll,
} from './db'
import {
  ApiAuth, apiFetchFolders, apiFetchDocuments, apiDownloadDocument,
  apiUploadDocument, ServerFolder,
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

    // 2. Build local folder structure
    for (const sf of flatFolders) {
      const localPath = buildFolderPath(syncFolder, sf.id, flatFolders)
      if (!fs.existsSync(localPath)) fs.mkdirSync(localPath, { recursive: true })
      upsertFolder(sf.id, sf.name, sf.parent_id, localPath)
    }

    // 3. Fetch all documents (per folder + root)
    const allFolderIds: (number | null)[] = [null, ...flatFolders.map(f => f.id)]
    let totalDownloaded = 0

    for (const folderId of allFolderIds) {
      const docs = await apiFetchDocuments(auth, folderId)
      for (const doc of docs) {
        const localDir = folderId
          ? (getAllFolders().find(f => f.id === folderId)?.local_path ?? syncFolder)
          : syncFolder
        const localPath = path.join(localDir, sanitizeName(doc.name))

        const existing = getAllDocuments().find(d => d.id === doc.id)
        const needsDownload = !existing
          || !fs.existsSync(localPath)
          || doc.version > (existing.version ?? 0)
          || doc.file_size !== existing.file_size

        if (needsDownload) {
          // Check for local conflict: file exists & was modified locally
          if (existing && fs.existsSync(localPath)) {
            const stat = fs.statSync(localPath)
            if (stat.mtimeMs !== existing.local_mtime && existing.sync_status !== 'synced') {
              // Conflict: rename local copy
              const ext = path.extname(localPath)
              const base = path.basename(localPath, ext)
              const conflictPath = path.join(path.dirname(localPath), `${base}_conflict_${Date.now()}${ext}`)
              fs.renameSync(localPath, conflictPath)
              state.errors.push(`Conflict: ${doc.name} — copia locală salvată ca ${path.basename(conflictPath)}`)
            }
          }

          setDocumentStatus(doc.id, 'downloading')
          emit('sync:file', { type: 'download', name: doc.name })
          try {
            await apiDownloadDocument(auth, doc.id, localPath)
            const stat = fs.statSync(localPath)
            upsertDocument({
              id: doc.id, name: doc.name, folder_id: folderId,
              local_path: localPath, file_size: doc.file_size,
              version: doc.version, content_type: doc.content_type,
              server_created_at: doc.created_at, local_mtime: stat.mtimeMs,
              sync_status: 'synced',
            })
            totalDownloaded++
          } catch (err: any) {
            setDocumentStatus(doc.id, 'error')
            state.errors.push(`Download failed: ${doc.name}`)
          }
        } else {
          // Ensure it's in DB
          upsertDocument({
            id: doc.id, name: doc.name, folder_id: folderId,
            local_path: localPath, file_size: doc.file_size,
            version: doc.version, content_type: doc.content_type,
            server_created_at: doc.created_at,
            sync_status: existing?.sync_status ?? 'synced',
          })
        }
      }
    }

    setState({ status: 'idle', lastSync: new Date().toISOString(), pending: 0 })
    emit('sync:done', { downloaded: totalDownloaded })
  } catch (err: any) {
    setState({ status: 'error', errors: [...state.errors, err.message ?? 'Sync error'] })
  }
}

// ── File watcher ──────────────────────────────────────────────────────────────

export function startWatcher(): void {
  const syncFolder = getSyncFolder()
  if (!syncFolder || watcher) return

  watcher = chokidar.watch(syncFolder, {
    ignored: /(^|[/\\])\../, // ignore hidden files
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 },
  })

  watcher.on('add', (filePath) => scheduleUpload(filePath, 'add'))
  watcher.on('change', (filePath) => scheduleUpload(filePath, 'change'))
  watcher.on('unlink', (filePath) => handleLocalDelete(filePath))
}

export function stopWatcher(): void {
  watcher?.close()
  watcher = null
}

function scheduleUpload(filePath: string, _event: string): void {
  const existing = uploadDebounce.get(filePath)
  if (existing) clearTimeout(existing)
  uploadDebounce.set(filePath, setTimeout(() => {
    uploadDebounce.delete(filePath)
    uploadLocalFile(filePath)
  }, 3000))
}

async function uploadLocalFile(filePath: string): Promise<void> {
  const auth = getAuth()
  const syncFolder = getSyncFolder()
  if (!auth || !syncFolder) return

  // Find which folder this belongs to
  const folders = getAllFolders()
  const parentDir = path.dirname(filePath)
  const matchedFolder = folders.find(f => f.local_path === parentDir) ?? null
  const folderId = matchedFolder?.id ?? null

  const existing = getDocumentByLocalPath(filePath)
  if (existing?.sync_status === 'downloading') return

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
  // Note: we don't auto-delete from server on local delete to be safe
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
