"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  auth: {
    login: (serverUrl, email, password) => electron.ipcRenderer.invoke("auth:login", { serverUrl, email, password }),
    logout: () => electron.ipcRenderer.invoke("auth:logout"),
    status: () => electron.ipcRenderer.invoke("auth:status")
  },
  sync: {
    setFolder: (folderPath) => electron.ipcRenderer.invoke("sync:setFolder", { folderPath }),
    getFolder: () => electron.ipcRenderer.invoke("sync:getFolder"),
    getState: () => electron.ipcRenderer.invoke("sync:getState"),
    force: () => electron.ipcRenderer.invoke("sync:force"),
    start: () => electron.ipcRenderer.invoke("sync:start")
  },
  dms: {
    listFolders: () => electron.ipcRenderer.invoke("dms:listFolders"),
    listFiles: (folderId) => electron.ipcRenderer.invoke("dms:listFiles", { folderId }),
    createFolder: (name, parentId) => electron.ipcRenderer.invoke("dms:createFolder", { name, parentId }),
    deleteDocument: (docId) => electron.ipcRenderer.invoke("dms:deleteDocument", { docId }),
    deleteFolder: (folderId) => electron.ipcRenderer.invoke("dms:deleteFolder", { folderId })
  },
  shell: {
    pickFolder: () => electron.ipcRenderer.invoke("shell:pickFolder"),
    reveal: (localPath) => electron.ipcRenderer.invoke("shell:reveal", { localPath }),
    openFile: (localPath) => electron.ipcRenderer.invoke("shell:openFile", { localPath })
  },
  on: (channel, cb) => {
    const handler = (_, ...args) => cb(...args);
    electron.ipcRenderer.on(channel, handler);
    return () => electron.ipcRenderer.removeListener(channel, handler);
  }
});
