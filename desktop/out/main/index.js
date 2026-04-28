"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const chokidar = require("chokidar");
function userDataPath(name) {
  return path.join(electron.app.getPath("userData"), name);
}
function readConfig() {
  const p = userDataPath("config.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}
function writeConfig(data) {
  fs.writeFileSync(userDataPath("config.json"), JSON.stringify(data, null, 2));
}
function configGet(key) {
  return readConfig()[key] ?? null;
}
function configSet(key, value) {
  const cfg = readConfig();
  cfg[key] = value;
  writeConfig(cfg);
}
function configDel(key) {
  const cfg = readConfig();
  delete cfg[key];
  writeConfig(cfg);
}
function readState() {
  const p = userDataPath("sync-state.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { folders: {}, documents: {} };
  }
}
function writeState(data) {
  fs.writeFileSync(userDataPath("sync-state.json"), JSON.stringify(data, null, 2));
}
function upsertFolder(id, name, parentId, localPath) {
  const s = readState();
  s.folders[id] = { id, name, parent_id: parentId, local_path: localPath, synced_at: (/* @__PURE__ */ new Date()).toISOString() };
  writeState(s);
}
function getAllFolders() {
  return Object.values(readState().folders);
}
function upsertDocument(doc) {
  const s = readState();
  const existing = s.documents[doc.id];
  s.documents[doc.id] = {
    ...doc,
    local_mtime: doc.local_mtime ?? existing?.local_mtime ?? 0,
    sync_status: doc.sync_status ?? existing?.sync_status ?? "synced"
  };
  writeState(s);
}
function getDocumentByLocalPath(localPath) {
  return Object.values(readState().documents).find((d) => d.local_path === localPath) ?? null;
}
function getAllDocuments() {
  return Object.values(readState().documents);
}
function setDocumentStatus(id, status) {
  const s = readState();
  if (s.documents[id]) {
    s.documents[id].sync_status = status;
    writeState(s);
  }
}
function deleteDocumentRecord(id) {
  const s = readState();
  delete s.documents[id];
  writeState(s);
}
function clearAll() {
  writeState({ folders: {}, documents: {} });
}
function makeClient(auth) {
  return axios.create({
    baseURL: auth.serverUrl.replace(/\/$/, ""),
    headers: { Authorization: `Bearer ${auth.token}` },
    timeout: 3e4
  });
}
async function apiLogin(serverUrl, email, password) {
  const base = serverUrl.replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("username", email);
  params.set("password", password);
  const res = await axios.post(`${base}/api/auth/token`, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15e3
  });
  return { token: res.data.access_token, user: res.data.user ?? null };
}
async function apiFetchFolders(auth) {
  const res = await makeClient(auth).get("/api/folders/");
  return res.data;
}
async function apiFetchDocuments(auth, folderId) {
  const params = { limit: 500 };
  if (folderId !== null) params.folder_id = folderId;
  const res = await makeClient(auth).get("/api/documents/", { params });
  return res.data.items ?? res.data;
}
async function apiDownloadDocument(auth, docId, destPath) {
  const client = makeClient(auth);
  client.defaults.timeout = 12e4;
  const res = await client.get(`/api/documents/${docId}/download/`, {
    responseType: "arraybuffer",
    maxRedirects: 5
  });
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(destPath, Buffer.from(res.data));
}
async function apiUploadDocument(auth, filePath, folderId, category = "other") {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), path.basename(filePath));
  form.append("category", category);
  if (folderId !== null) form.append("folder_id", String(folderId));
  const client = makeClient(auth);
  client.defaults.timeout = 12e4;
  const res = await client.post("/api/documents/upload/", form, {
    headers: form.getHeaders()
  });
  return res.data;
}
async function apiCreateFolder(auth, name, parentId) {
  const res = await makeClient(auth).post("/api/folders/", { name, parent_id: parentId });
  return res.data;
}
async function apiDeleteDocument(auth, docId) {
  await makeClient(auth).delete(`/api/documents/${docId}/`);
}
async function apiDeleteFolder(auth, folderId) {
  await makeClient(auth).delete(`/api/folders/${folderId}/`);
}
const state = {
  status: "idle",
  lastSync: null,
  pending: 0,
  errors: []
};
let pollTimer = null;
let watcher = null;
const uploadDebounce = /* @__PURE__ */ new Map();
let mainWindow = null;
function setWindow(win) {
  mainWindow = win;
}
function emit(channel, data) {
  mainWindow?.webContents?.send(channel, data);
}
function setState(patch) {
  Object.assign(state, patch);
  emit("sync:state", { ...state });
}
function getSyncState() {
  return { ...state };
}
function getAuth() {
  const serverUrl = configGet("server_url");
  const token = configGet("token");
  if (!serverUrl || !token) return null;
  return { serverUrl, token };
}
function getSyncFolder() {
  return configGet("sync_folder");
}
async function runFullSync() {
  const auth = getAuth();
  const syncFolder = getSyncFolder();
  if (!auth || !syncFolder) return;
  if (state.status === "syncing") return;
  setState({ status: "syncing", errors: [] });
  emit("sync:start");
  try {
    const serverFolders = await apiFetchFolders(auth);
    const flatFolders = flattenFolders(serverFolders, null);
    for (const sf of flatFolders) {
      const localPath = buildFolderPath(syncFolder, sf.id, flatFolders);
      if (!fs.existsSync(localPath)) fs.mkdirSync(localPath, { recursive: true });
      upsertFolder(sf.id, sf.name, sf.parent_id, localPath);
    }
    const allFolderIds = [null, ...flatFolders.map((f) => f.id)];
    let totalDownloaded = 0;
    for (const folderId of allFolderIds) {
      const docs = await apiFetchDocuments(auth, folderId);
      for (const doc of docs) {
        const localDir = folderId ? getAllFolders().find((f) => f.id === folderId)?.local_path ?? syncFolder : syncFolder;
        const localPath = path.join(localDir, sanitizeName(doc.name));
        const existing = getAllDocuments().find((d) => d.id === doc.id);
        const needsDownload = !existing || !fs.existsSync(localPath) || doc.version > (existing.version ?? 0) || doc.file_size !== existing.file_size;
        if (needsDownload) {
          if (existing && fs.existsSync(localPath)) {
            const stat = fs.statSync(localPath);
            if (stat.mtimeMs !== existing.local_mtime && existing.sync_status !== "synced") {
              const ext = path.extname(localPath);
              const base = path.basename(localPath, ext);
              const conflictPath = path.join(path.dirname(localPath), `${base}_conflict_${Date.now()}${ext}`);
              fs.renameSync(localPath, conflictPath);
              state.errors.push(`Conflict: ${doc.name} — copia locală salvată ca ${path.basename(conflictPath)}`);
            }
          }
          setDocumentStatus(doc.id, "downloading");
          emit("sync:file", { type: "download", name: doc.name });
          try {
            await apiDownloadDocument(auth, doc.id, localPath);
            const stat = fs.statSync(localPath);
            upsertDocument({
              id: doc.id,
              name: doc.name,
              folder_id: folderId,
              local_path: localPath,
              file_size: doc.file_size,
              version: doc.version,
              content_type: doc.content_type,
              server_created_at: doc.created_at,
              local_mtime: stat.mtimeMs,
              sync_status: "synced"
            });
            totalDownloaded++;
          } catch (err) {
            setDocumentStatus(doc.id, "error");
            state.errors.push(`Download failed: ${doc.name}`);
          }
        } else {
          upsertDocument({
            id: doc.id,
            name: doc.name,
            folder_id: folderId,
            local_path: localPath,
            file_size: doc.file_size,
            version: doc.version,
            content_type: doc.content_type,
            server_created_at: doc.created_at,
            sync_status: existing?.sync_status ?? "synced"
          });
        }
      }
    }
    setState({ status: "idle", lastSync: (/* @__PURE__ */ new Date()).toISOString(), pending: 0 });
    emit("sync:done", { downloaded: totalDownloaded });
  } catch (err) {
    setState({ status: "error", errors: [...state.errors, err.message ?? "Sync error"] });
  }
}
function startWatcher() {
  const syncFolder = getSyncFolder();
  if (!syncFolder || watcher) return;
  watcher = chokidar.watch(syncFolder, {
    ignored: /(^|[/\\])\../,
    // ignore hidden files
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2e3, pollInterval: 200 }
  });
  watcher.on("add", (filePath) => scheduleUpload(filePath));
  watcher.on("change", (filePath) => scheduleUpload(filePath));
  watcher.on("unlink", (filePath) => handleLocalDelete(filePath));
}
function stopWatcher() {
  watcher?.close();
  watcher = null;
}
function scheduleUpload(filePath, _event) {
  const existing = uploadDebounce.get(filePath);
  if (existing) clearTimeout(existing);
  uploadDebounce.set(filePath, setTimeout(() => {
    uploadDebounce.delete(filePath);
    uploadLocalFile(filePath);
  }, 3e3));
}
async function uploadLocalFile(filePath) {
  const auth = getAuth();
  const syncFolder = getSyncFolder();
  if (!auth || !syncFolder) return;
  const folders = getAllFolders();
  const parentDir = path.dirname(filePath);
  const matchedFolder = folders.find((f) => f.local_path === parentDir) ?? null;
  const folderId = matchedFolder?.id ?? null;
  const existing = getDocumentByLocalPath(filePath);
  if (existing?.sync_status === "downloading") return;
  emit("sync:file", { type: "upload", name: path.basename(filePath) });
  try {
    const doc = await apiUploadDocument(auth, filePath, folderId);
    const stat = fs.statSync(filePath);
    upsertDocument({
      id: doc.id,
      name: doc.name,
      folder_id: folderId,
      local_path: filePath,
      file_size: doc.file_size,
      version: doc.version,
      content_type: doc.content_type,
      server_created_at: doc.created_at,
      local_mtime: stat.mtimeMs,
      sync_status: "synced"
    });
    emit("sync:file", { type: "uploaded", name: path.basename(filePath) });
  } catch (err) {
    state.errors.push(`Upload failed: ${path.basename(filePath)}`);
  }
}
function handleLocalDelete(filePath) {
  const doc = getDocumentByLocalPath(filePath);
  if (doc) deleteDocumentRecord(doc.id);
}
function startPolling(intervalMs = 6e4) {
  if (pollTimer) return;
  pollTimer = setInterval(() => runFullSync(), intervalMs);
}
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
async function startEngine() {
  await runFullSync();
  startWatcher();
  startPolling();
}
function stopEngine() {
  stopWatcher();
  stopPolling();
}
function resetEngine() {
  stopEngine();
  clearAll();
}
function flattenFolders(folders, parentId) {
  const result = [];
  for (const f of folders) {
    result.push({ id: f.id, name: f.name, parent_id: parentId });
    if (f.children?.length) result.push(...flattenFolders(f.children, f.id));
  }
  return result;
}
function buildFolderPath(syncRoot, folderId, flat) {
  const folder = flat.find((f) => f.id === folderId);
  if (!folder) return syncRoot;
  const segments = [];
  let current = folder;
  while (current) {
    segments.unshift(sanitizeName(current.name));
    current = current.parent_id !== null ? flat.find((f) => f.id === current.parent_id) : void 0;
  }
  return path.join(syncRoot, ...segments);
}
function sanitizeName(name) {
  return name.replace(/[/\\:*?"<>|]/g, "_");
}
const TRAY_ICON_B64 = "iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABmJLR0QA/wD/AP+gvaeTAAAAeklEQVQ4jWNgGAVkAkYGBob/DFSAB1RjxgCqMWMAqjFjAKoxYwCqMWMAqjFjAP7TYDAGAAAAAElFTkSuQmCC";
let tray = null;
let mainWin = null;
function createWindow() {
  mainWin = new electron.BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 540,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0C0F16",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });
  mainWin.once("ready-to-show", () => mainWin?.show());
  mainWin.on("close", (e) => {
    e.preventDefault();
    mainWin?.hide();
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWin.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWin.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  setWindow(mainWin);
}
function createTray() {
  const iconPath = path.join(__dirname, "../../resources/tray-icon.png");
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = electron.nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  } else {
    icon = electron.nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON_B64}`);
  }
  icon.setTemplateImage(true);
  tray = new electron.Tray(icon);
  tray.setToolTip("HestiOS DMS");
  updateTrayMenu();
  tray.on("click", () => {
    mainWin?.isVisible() ? mainWin.focus() : mainWin?.show();
  });
}
function updateTrayMenu() {
  if (!tray) return;
  const syncState = getSyncState();
  const isLoggedIn = !!configGet("token");
  const statusLabel = {
    idle: "● Sincronizat",
    syncing: "↻ Se sincronizează...",
    error: "⚠ Eroare sync",
    offline: "○ Offline"
  }[syncState.status] ?? "○";
  const menu = electron.Menu.buildFromTemplate([
    { label: "HestiOS DMS", enabled: false },
    { type: "separator" },
    { label: statusLabel, enabled: false },
    ...syncState.lastSync ? [{ label: `Ultima sincronizare: ${new Date(syncState.lastSync).toLocaleTimeString("ro")}`, enabled: false }] : [],
    { type: "separator" },
    { label: "Deschide", click: () => {
      mainWin?.show();
      mainWin?.focus();
    } },
    {
      label: "Sincronizează acum",
      enabled: isLoggedIn,
      click: () => runFullSync().then(() => updateTrayMenu())
    },
    { type: "separator" },
    { label: "Ieșire", click: () => {
      electron.app.exit(0);
    } }
  ]);
  tray.setContextMenu(menu);
}
electron.app.whenReady().then(() => {
  createWindow();
  createTray();
  if (configGet("token") && configGet("sync_folder")) {
    startEngine().then(() => updateTrayMenu()).catch(() => {
    });
  }
  electron.app.on("activate", () => {
    mainWin?.show();
    mainWin?.focus();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", () => {
  stopEngine();
});
electron.ipcMain.handle("auth:login", async (_, { serverUrl, email, password }) => {
  try {
    const { token, user } = await apiLogin(serverUrl, email, password);
    configSet("server_url", serverUrl);
    configSet("token", token);
    if (user) {
      configSet("user_name", user.full_name ?? user.email ?? email);
      configSet("user_email", user.email ?? email);
      configSet("user_role", user.role ?? "");
    }
    return { ok: true, user: { name: configGet("user_name"), email: configGet("user_email"), role: configGet("user_role") } };
  } catch (err) {
    return { ok: false, error: err.response?.data?.detail ?? err.message ?? "Eroare login" };
  }
});
electron.ipcMain.handle("auth:logout", () => {
  stopEngine();
  resetEngine();
  configDel("token");
  configDel("server_url");
  configDel("user_name");
  configDel("user_email");
  configDel("user_role");
  updateTrayMenu();
  return { ok: true };
});
electron.ipcMain.handle("auth:status", () => {
  const token = configGet("token");
  if (!token) return { isLoggedIn: false };
  return {
    isLoggedIn: true,
    serverUrl: configGet("server_url"),
    user: {
      name: configGet("user_name"),
      email: configGet("user_email"),
      role: configGet("user_role")
    }
  };
});
electron.ipcMain.handle("sync:setFolder", async (_, { folderPath }) => {
  configSet("sync_folder", folderPath);
  stopEngine();
  await startEngine();
  updateTrayMenu();
  return { ok: true };
});
electron.ipcMain.handle("sync:getFolder", () => configGet("sync_folder"));
electron.ipcMain.handle("sync:getState", () => getSyncState());
electron.ipcMain.handle("sync:force", async () => {
  await runFullSync();
  updateTrayMenu();
  return getSyncState();
});
electron.ipcMain.handle("sync:start", async () => {
  if (!configGet("token") || !configGet("sync_folder")) return { ok: false, error: "Not configured" };
  await startEngine();
  updateTrayMenu();
  return { ok: true };
});
electron.ipcMain.handle("dms:listFolders", async () => {
  const auth = { serverUrl: configGet("server_url"), token: configGet("token") };
  try {
    return await apiFetchFolders(auth);
  } catch {
    return getAllFolders();
  }
});
electron.ipcMain.handle("dms:listFiles", async (_, { folderId }) => {
  const auth = { serverUrl: configGet("server_url"), token: configGet("token") };
  try {
    return await apiFetchDocuments(auth, folderId ?? null);
  } catch {
    return getAllDocuments().filter((d) => d.folder_id === (folderId ?? null));
  }
});
electron.ipcMain.handle("dms:createFolder", async (_, { name, parentId }) => {
  const auth = { serverUrl: configGet("server_url"), token: configGet("token") };
  return await apiCreateFolder(auth, name, parentId ?? null);
});
electron.ipcMain.handle("dms:deleteDocument", async (_, { docId }) => {
  const auth = { serverUrl: configGet("server_url"), token: configGet("token") };
  await apiDeleteDocument(auth, docId);
  return { ok: true };
});
electron.ipcMain.handle("dms:deleteFolder", async (_, { folderId }) => {
  const auth = { serverUrl: configGet("server_url"), token: configGet("token") };
  await apiDeleteFolder(auth, folderId);
  return { ok: true };
});
electron.ipcMain.handle("shell:pickFolder", async () => {
  const result = await electron.dialog.showOpenDialog(mainWin, {
    title: "Alege folderul de sincronizare HestiOS DMS",
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Alege folder"
  });
  return result.canceled ? null : result.filePaths[0];
});
electron.ipcMain.handle("shell:reveal", (_, { localPath }) => {
  electron.shell.showItemInFolder(localPath);
});
electron.ipcMain.handle("shell:openFile", (_, { localPath }) => {
  electron.shell.openPath(localPath);
});
