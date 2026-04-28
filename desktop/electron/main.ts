import { app, BrowserWindow, ipcMain, Tray, Menu, shell, dialog, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { configGet, configSet, configDel, getAllFolders, getAllDocuments } from './sync/db'
import { apiLogin, apiFetchFolders, apiFetchDocuments, apiCreateFolder, apiDeleteDocument, apiDeleteFolder } from './sync/api'
import { startEngine, stopEngine, resetEngine, runFullSync, getSyncState, setWindow } from './sync/engine'

// ── Tray icon (generated inline) ──────────────────────────────────────────────
// 22x22 white "H" on transparent background for macOS menu bar
const TRAY_ICON_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABmJLR0QA/wD/AP+gvaeTAAAA' +
  'eklEQVQ4jWNgGAVkAkYGBob/DFSAB1RjxgCqMWMAqjFjAKoxYwCqMWMAqjFjAP7TYDAGAA' +
  'AAAElFTkSuQmCC'

let tray: Tray | null = null
let mainWin: BrowserWindow | null = null

function createWindow(): void {
  mainWin = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 540,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0C0F16',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  mainWin.once('ready-to-show', () => mainWin?.show())

  mainWin.on('close', (e) => {
    e.preventDefault()
    mainWin?.hide()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWin.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWin.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  setWindow(mainWin)
}

function createTray(): void {
  const iconPath = path.join(__dirname, '../../resources/tray-icon.png')
  let icon: Electron.NativeImage
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
  } else {
    icon = nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON_B64}`)
  }
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('HestiOS DMS')
  updateTrayMenu()

  tray.on('click', () => {
    mainWin?.isVisible() ? mainWin.focus() : mainWin?.show()
  })
}

function updateTrayMenu(): void {
  if (!tray) return
  const syncState = getSyncState()
  const isLoggedIn = !!configGet('token')
  const statusLabel = {
    idle: '● Sincronizat',
    syncing: '↻ Se sincronizează...',
    error: '⚠ Eroare sync',
    offline: '○ Offline',
  }[syncState.status] ?? '○'

  const menu = Menu.buildFromTemplate([
    { label: 'HestiOS DMS', enabled: false },
    { type: 'separator' },
    { label: statusLabel, enabled: false },
    ...(syncState.lastSync ? [{ label: `Ultima sincronizare: ${new Date(syncState.lastSync).toLocaleTimeString('ro')}`, enabled: false }] : []),
    { type: 'separator' },
    { label: 'Deschide', click: () => { mainWin?.show(); mainWin?.focus() } },
    {
      label: 'Sincronizează acum',
      enabled: isLoggedIn,
      click: () => runFullSync().then(() => updateTrayMenu()),
    },
    { type: 'separator' },
    { label: 'Ieșire', click: () => { app.exit(0) } },
  ])
  tray.setContextMenu(menu)
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  createTray()

  // Auto-start sync if already logged in
  if (configGet('token') && configGet('sync_folder')) {
    startEngine().then(() => updateTrayMenu()).catch(() => {})
  }

  app.on('activate', () => {
    mainWin?.show()
    mainWin?.focus()
  })
})

app.on('window-all-closed', () => {
  // Keep running in tray on macOS
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopEngine()
})

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('auth:login', async (_, { serverUrl, email, password }) => {
  try {
    const { token, user } = await apiLogin(serverUrl, email, password)
    configSet('server_url', serverUrl)
    configSet('token', token)
    if (user) {
      configSet('user_name', user.full_name ?? user.email ?? email)
      configSet('user_email', user.email ?? email)
      configSet('user_role', user.role ?? '')
    }
    return { ok: true, user: { name: configGet('user_name'), email: configGet('user_email'), role: configGet('user_role') } }
  } catch (err: any) {
    return { ok: false, error: err.response?.data?.detail ?? err.message ?? 'Eroare login' }
  }
})

ipcMain.handle('auth:logout', () => {
  stopEngine()
  resetEngine()
  configDel('token')
  configDel('server_url')
  configDel('user_name')
  configDel('user_email')
  configDel('user_role')
  updateTrayMenu()
  return { ok: true }
})

ipcMain.handle('auth:status', () => {
  const token = configGet('token')
  if (!token) return { isLoggedIn: false }
  return {
    isLoggedIn: true,
    serverUrl: configGet('server_url'),
    user: {
      name: configGet('user_name'),
      email: configGet('user_email'),
      role: configGet('user_role'),
    },
  }
})

ipcMain.handle('sync:setFolder', async (_, { folderPath }) => {
  configSet('sync_folder', folderPath)
  stopEngine()
  await startEngine()
  updateTrayMenu()
  return { ok: true }
})

ipcMain.handle('sync:getFolder', () => configGet('sync_folder'))

ipcMain.handle('sync:getState', () => getSyncState())

ipcMain.handle('sync:force', async () => {
  await runFullSync()
  updateTrayMenu()
  return getSyncState()
})

ipcMain.handle('sync:start', async () => {
  if (!configGet('token') || !configGet('sync_folder')) return { ok: false, error: 'Not configured' }
  await startEngine()
  updateTrayMenu()
  return { ok: true }
})

ipcMain.handle('dms:listFolders', async () => {
  const auth = { serverUrl: configGet('server_url')!, token: configGet('token')! }
  try {
    return await apiFetchFolders(auth)
  } catch {
    // Fallback to local DB
    return getAllFolders()
  }
})

ipcMain.handle('dms:listFiles', async (_, { folderId }) => {
  const auth = { serverUrl: configGet('server_url')!, token: configGet('token')! }
  try {
    return await apiFetchDocuments(auth, folderId ?? null)
  } catch {
    return getAllDocuments().filter(d => d.folder_id === (folderId ?? null))
  }
})

ipcMain.handle('dms:createFolder', async (_, { name, parentId }) => {
  const auth = { serverUrl: configGet('server_url')!, token: configGet('token')! }
  return await apiCreateFolder(auth, name, parentId ?? null)
})

ipcMain.handle('dms:deleteDocument', async (_, { docId }) => {
  const auth = { serverUrl: configGet('server_url')!, token: configGet('token')! }
  await apiDeleteDocument(auth, docId)
  return { ok: true }
})

ipcMain.handle('dms:deleteFolder', async (_, { folderId }) => {
  const auth = { serverUrl: configGet('server_url')!, token: configGet('token')! }
  await apiDeleteFolder(auth, folderId)
  return { ok: true }
})

ipcMain.handle('shell:pickFolder', async () => {
  const result = await dialog.showOpenDialog(mainWin!, {
    title: 'Alege folderul de sincronizare HestiOS DMS',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Alege folder',
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('shell:reveal', (_, { localPath }) => {
  shell.showItemInFolder(localPath)
})

ipcMain.handle('shell:openFile', (_, { localPath }) => {
  shell.openPath(localPath)
})
