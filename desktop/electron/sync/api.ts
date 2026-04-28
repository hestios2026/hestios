import axios, { AxiosInstance } from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'

export interface ApiAuth {
  serverUrl: string
  token: string
}

export interface ServerFolder {
  id: number
  name: string
  parent_id: number | null
  site_id: number | null
  site_name: string | null
  doc_count: number
  children?: ServerFolder[]
}

export interface ServerDocument {
  id: number
  name: string
  folder_id: number | null
  file_size: number
  version: number
  content_type: string
  created_at: string
  category: string
}

function makeClient(auth: ApiAuth): AxiosInstance {
  return axios.create({
    baseURL: auth.serverUrl.replace(/\/$/, ''),
    headers: { Authorization: `Bearer ${auth.token}` },
    timeout: 30_000,
  })
}

export async function apiLogin(serverUrl: string, email: string, password: string): Promise<{ token: string; user: any }> {
  const base = serverUrl.replace(/\/$/, '')
  const params = new URLSearchParams()
  params.set('username', email)
  params.set('password', password)
  const res = await axios.post(`${base}/api/auth/login/`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15_000,
  })
  return { token: res.data.access_token, user: res.data.user ?? null }
}

export async function apiFetchFolders(auth: ApiAuth): Promise<ServerFolder[]> {
  const res = await makeClient(auth).get('/api/folders/')
  return res.data
}

export async function apiFetchDocuments(auth: ApiAuth, folderId: number | null): Promise<ServerDocument[]> {
  const params: Record<string, any> = { limit: 500 }
  if (folderId !== null) params.folder_id = folderId
  const res = await makeClient(auth).get('/api/documents/', { params })
  return res.data.items ?? res.data
}

export async function apiFetchAllDocuments(auth: ApiAuth): Promise<ServerDocument[]> {
  const res = await makeClient(auth).get('/api/documents/', { params: { limit: 10000 } })
  return res.data.items ?? res.data
}

export async function apiDownloadDocument(auth: ApiAuth, docId: number, destPath: string): Promise<void> {
  const client = makeClient(auth)
  client.defaults.timeout = 120_000
  const res = await client.get(`/api/documents/${docId}/download/`, {
    responseType: 'arraybuffer',
    maxRedirects: 5,
  })
  const dir = path.dirname(destPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(destPath, Buffer.from(res.data))
}

export async function apiUploadDocument(
  auth: ApiAuth,
  filePath: string,
  folderId: number | null,
  category = 'other',
): Promise<ServerDocument> {
  const form = new FormData()
  form.append('file', fs.createReadStream(filePath), path.basename(filePath))
  form.append('category', category)
  if (folderId !== null) form.append('folder_id', String(folderId))

  const client = makeClient(auth)
  client.defaults.timeout = 120_000
  const res = await client.post('/api/documents/upload/', form, {
    headers: form.getHeaders(),
  })
  return res.data
}

export async function apiCreateFolder(auth: ApiAuth, name: string, parentId: number | null): Promise<ServerFolder> {
  const res = await makeClient(auth).post('/api/folders/', { name, parent_id: parentId })
  return res.data
}

export async function apiDeleteDocument(auth: ApiAuth, docId: number): Promise<void> {
  await makeClient(auth).delete(`/api/documents/${docId}/`)
}

export async function apiDeleteFolder(auth: ApiAuth, folderId: number): Promise<void> {
  await makeClient(auth).delete(`/api/folders/${folderId}/`)
}
