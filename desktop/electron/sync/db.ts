/**
 * Simple JSON-file persistence layer — no native modules needed.
 * Files stored in app.getPath('userData'):
 *   config.json    — auth token, server URL, sync folder, user info
 *   sync-state.json — folders and documents sync state
 */
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

function userDataPath(name: string): string {
  return path.join(app.getPath('userData'), name)
}

// ── Config ────────────────────────────────────────────────────────────────────

type ConfigStore = Record<string, string>

function readConfig(): ConfigStore {
  const p = userDataPath('config.json')
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return {} }
}

function writeConfig(data: ConfigStore): void {
  fs.writeFileSync(userDataPath('config.json'), JSON.stringify(data, null, 2))
}

export function configGet(key: string): string | null {
  return readConfig()[key] ?? null
}

export function configSet(key: string, value: string): void {
  const cfg = readConfig()
  cfg[key] = value
  writeConfig(cfg)
}

export function configDel(key: string): void {
  const cfg = readConfig()
  delete cfg[key]
  writeConfig(cfg)
}

// ── Sync state ────────────────────────────────────────────────────────────────

interface SyncStateFile {
  folders: Record<number, FolderRecord>
  documents: Record<number, DocRecord>
}

interface FolderRecord {
  id: number
  name: string
  parent_id: number | null
  local_path: string
  synced_at: string
}

interface DocRecord {
  id: number
  name: string
  folder_id: number | null
  local_path: string
  file_size: number
  version: number
  content_type: string
  server_created_at: string
  local_mtime: number
  sync_status: string
}

function readState(): SyncStateFile {
  const p = userDataPath('sync-state.json')
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return { folders: {}, documents: {} } }
}

function writeState(data: SyncStateFile): void {
  fs.writeFileSync(userDataPath('sync-state.json'), JSON.stringify(data, null, 2))
}

// ── Folder helpers ────────────────────────────────────────────────────────────

export function upsertFolder(id: number, name: string, parentId: number | null, localPath: string): void {
  const s = readState()
  s.folders[id] = { id, name, parent_id: parentId, local_path: localPath, synced_at: new Date().toISOString() }
  writeState(s)
}

export function batchUpsertFolders(folders: { id: number; name: string; parent_id: number | null; local_path: string }[]): void {
  const s = readState()
  const now = new Date().toISOString()
  for (const f of folders) {
    s.folders[f.id] = { ...f, synced_at: now }
  }
  writeState(s)
}

export function getAllFolders(): FolderRecord[] {
  return Object.values(readState().folders)
}

export function getFolderById(id: number): FolderRecord | null {
  return readState().folders[id] ?? null
}

// ── Document helpers ──────────────────────────────────────────────────────────

export function upsertDocument(doc: {
  id: number; name: string; folder_id: number | null; local_path: string
  file_size: number; version: number; content_type: string
  server_created_at: string; local_mtime?: number; sync_status?: string
}): void {
  const s = readState()
  const existing = s.documents[doc.id]
  s.documents[doc.id] = {
    ...doc,
    local_mtime: doc.local_mtime ?? existing?.local_mtime ?? 0,
    sync_status: doc.sync_status ?? existing?.sync_status ?? 'synced',
  }
  writeState(s)
}

export function batchUpsertDocuments(docs: Parameters<typeof upsertDocument>[0][]): void {
  const s = readState()
  for (const doc of docs) {
    const existing = s.documents[doc.id]
    s.documents[doc.id] = {
      ...doc,
      local_mtime: doc.local_mtime ?? existing?.local_mtime ?? 0,
      sync_status: doc.sync_status ?? existing?.sync_status ?? 'synced',
    }
  }
  writeState(s)
}

export function getDocumentByLocalPath(localPath: string): DocRecord | null {
  return Object.values(readState().documents).find(d => d.local_path === localPath) ?? null
}

export function getDocumentById(id: number): DocRecord | null {
  return readState().documents[id] ?? null
}

export function getAllDocuments(): DocRecord[] {
  return Object.values(readState().documents)
}

export function setDocumentStatus(id: number, status: string): void {
  const s = readState()
  if (s.documents[id]) { s.documents[id].sync_status = status; writeState(s) }
}

export function setDocumentMtime(id: number, mtime: number): void {
  const s = readState()
  if (s.documents[id]) { s.documents[id].local_mtime = mtime; s.documents[id].sync_status = 'synced'; writeState(s) }
}

export function deleteDocumentRecord(id: number): void {
  const s = readState()
  delete s.documents[id]
  writeState(s)
}

export function clearAll(): void {
  writeState({ folders: {}, documents: {} })
}
