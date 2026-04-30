import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: (serverUrl: string, email: string, password: string) =>
      ipcRenderer.invoke('auth:login', { serverUrl, email, password }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    status: () => ipcRenderer.invoke('auth:status'),
  },
  sync: {
    setFolder: (folderPath: string) => ipcRenderer.invoke('sync:setFolder', { folderPath }),
    getFolder: () => ipcRenderer.invoke('sync:getFolder'),
    getState: () => ipcRenderer.invoke('sync:getState'),
    force: () => ipcRenderer.invoke('sync:force'),
    start: () => ipcRenderer.invoke('sync:start'),
    syncFolder: (folderId: number | null) => ipcRenderer.invoke('sync:syncFolder', { folderId }),
    syncDocument: (docId: number) => ipcRenderer.invoke('sync:syncDocument', { docId }),
  },
  dms: {
    listFolders: () => ipcRenderer.invoke('dms:listFolders'),
    listFiles: (folderId: number | null) => ipcRenderer.invoke('dms:listFiles', { folderId }),
    createFolder: (name: string, parentId: number | null) =>
      ipcRenderer.invoke('dms:createFolder', { name, parentId }),
    deleteDocument: (docId: number) => ipcRenderer.invoke('dms:deleteDocument', { docId }),
    deleteFolder: (folderId: number) => ipcRenderer.invoke('dms:deleteFolder', { folderId }),
  },
  shell: {
    pickFolder: () => ipcRenderer.invoke('shell:pickFolder'),
    reveal: (localPath: string) => ipcRenderer.invoke('shell:reveal', { localPath }),
    openFile: (localPath: string) => ipcRenderer.invoke('shell:openFile', { localPath }),
  },
  on: (channel: string, cb: (...args: any[]) => void) => {
    const handler = (_: any, ...args: any[]) => cb(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
})
