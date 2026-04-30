import React, { useEffect, useState, useCallback, useRef } from 'react'
import FolderTree from '../components/FolderTree'
import FileList from '../components/FileList'
import SyncStatus from '../components/SyncStatus'

const C = { bg: '#0C0F16', sidebar: '#0E1420', border: '#1E293B', green: '#22C55E', text: '#E2E8F0', muted: '#64748B' }

const DEFAULT_SYNC_STATE = { status: 'idle', lastSync: null, pending: 0, errors: [] }

interface Props { user: any; onLogout: () => void }

export default function BrowserPage({ user, onLogout }: Props) {
  const [folders, setFolders]         = useState<any[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const selectedFolderRef = useRef<number | null>(null)
  const [documents, setDocuments]     = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [syncFolder, setSyncFolder]   = useState<string | null>(null)
  const [syncState, setSyncState]     = useState<any>(DEFAULT_SYNC_STATE)
  const [showSettings, setShowSettings] = useState(false)
  const [setupNeeded, setSetupNeeded] = useState(false)

  // Bootstrap
  useEffect(() => {
    loadFolders()
    window.api.sync.getFolder().then(f => {
      setSyncFolder(f)
      if (!f) setSetupNeeded(true)
    })
    window.api.sync.getState().then(setSyncState)

    const unsub = window.api.on('sync:state', setSyncState)
    // Reload only when sync completes, not on every file — avoids flickering
    const unsubDone = window.api.on('sync:done', () => {
      loadFiles(selectedFolderRef.current)
    })
    return () => { unsub(); unsubDone() }
  }, [])

  // Keep ref in sync so event listeners always have the current folder
  useEffect(() => {
    selectedFolderRef.current = selectedFolderId
    loadFiles(selectedFolderId)
  }, [selectedFolderId])

  function loadFolders() {
    window.api.dms.listFolders().then(setFolders).catch(() => {})
  }

  function loadFiles(folderId: number | null) {
    setLoadingFiles(true)
    window.api.dms.listFiles(folderId).then(docs => {
      setDocuments(docs)
      setLoadingFiles(false)
    }).catch(() => setLoadingFiles(false))
  }

  async function handleCreateFolder(parentId: number | null) {
    const name = prompt('Nume folder:')
    if (!name?.trim()) return
    try {
      await window.api.dms.createFolder(name.trim(), parentId)
      loadFolders()
    } catch (err: any) {
      alert(err.message ?? 'Eroare la crearea folderului')
    }
  }

  async function handleDeleteFolder(folderId: number) {
    if (!confirm('Ștergi folderul? (trebuie să fie gol)')) return
    try {
      await window.api.dms.deleteFolder(folderId)
      if (selectedFolderId === folderId) setSelectedFolderId(null)
      loadFolders()
    } catch (err: any) {
      alert(err.message ?? 'Eroare la ștergerea folderului')
    }
  }

  async function handleDeleteDocument(docId: number) {
    try {
      await window.api.dms.deleteDocument(docId)
      loadFiles(selectedFolderId)
      loadFolders()
    } catch (err: any) {
      alert(err.message ?? 'Eroare la ștergerea documentului')
    }
  }

  async function handleUpload() {
    // Trigger upload by opening Finder in the sync folder for this directory
    const folder = folders.find(f => f.id === selectedFolderId)
    if (syncFolder) {
      const targetPath = folder ? syncFolder : syncFolder
      window.api.shell.reveal(targetPath)
      alert('Copiază fișierele în folderul deschis în Finder. Vor fi sincronizate automat.')
    } else {
      alert('Configurează mai întâi folderul de sincronizare în Setări.')
    }
  }

  async function handlePickSyncFolder() {
    const picked = await window.api.shell.pickFolder()
    if (!picked) return
    setSyncFolder(picked)
    setSetupNeeded(false)
    await window.api.sync.setFolder(picked)
    loadFolders()
  }

  async function handleForceSync() {
    await window.api.sync.force()
    loadFolders()
    loadFiles(selectedFolderId)
  }

  async function handleSyncFolder() {
    if (syncState.status === 'syncing') return
    await window.api.sync.syncFolder(selectedFolderId)
    loadFiles(selectedFolderId)
  }

  async function handleSyncDocument(docId: number) {
    await window.api.sync.syncDocument(docId)
    loadFiles(selectedFolderId)
  }

  const selectedFolderName = selectedFolderId
    ? findFolderName(folders, selectedFolderId) ?? 'Folder'
    : 'Toate documentele'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg }}>
      {/* Titlebar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px 0 80px', background: C.sidebar,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        WebkitAppRegion: 'drag',
      } as any}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 22, height: 22, background: C.green, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#0C0F16', fontWeight: 800, fontSize: 12 }}>H</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>HestiDMS</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ WebkitAppRegion: 'no-drag' } as any}>
          <span style={{ fontSize: 12, color: C.muted, marginRight: 12 }}>{user?.name ?? user?.email ?? ''}</span>
          <button
            onClick={() => setShowSettings(v => !v)}
            style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, marginRight: 8 }}
            title="Setări"
          >⚙</button>
          <button
            onClick={() => { if (confirm('Ești sigur că vrei să te deconectezi?')) onLogout() }}
            style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13 }}
          >Ieșire</button>
        </div>
      </div>

      {/* Setup banner */}
      {setupNeeded && !showSettings && (
        <div style={{ background: '#1C1506', border: 'none', borderBottom: `1px solid #713F12`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: '#FCD34D' }}>⚠ Niciun folder de sincronizare configurat.</span>
          <button onClick={handlePickSyncFolder} style={{ background: '#F59E0B', border: 'none', borderRadius: 6, padding: '5px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#0C0F16' }}>
            Alege folder
          </button>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div style={{ background: '#0E1420', borderBottom: `1px solid ${C.border}`, padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Setări sincronizare</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: C.text }}>Folder local:</span>
            <span style={{ fontSize: 13, color: syncFolder ? C.green : C.muted, flex: 1 }}>
              {syncFolder ?? 'Neconfigurat'}
            </span>
            <button onClick={handlePickSyncFolder} style={{ background: '#1E293B', border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 14px', color: C.text, fontSize: 13, cursor: 'pointer' }}>
              Schimbă folder
            </button>
            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 220, background: C.sidebar, borderRight: `1px solid ${C.border}`, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <FolderTree
            folders={folders}
            selectedId={selectedFolderId}
            onSelect={setSelectedFolderId}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <FileList
            documents={documents}
            loading={loadingFiles}
            syncing={syncState.status === 'syncing'}
            syncFolder={syncFolder}
            selectedFolderId={selectedFolderId}
            folderName={selectedFolderName}
            onDelete={handleDeleteDocument}
            onUpload={handleUpload}
            onRefresh={() => { loadFolders(); loadFiles(selectedFolderId) }}
            onSyncFolder={handleSyncFolder}
            onSyncDocument={handleSyncDocument}
          />
        </div>
      </div>

      {/* Status bar */}
      <SyncStatus syncState={syncState} onForce={handleForceSync} />
    </div>
  )
}

function findFolderName(folders: any[], id: number): string | null {
  for (const f of folders) {
    if (f.id === id) return f.name
    if (f.children?.length) {
      const found = findFolderName(f.children, id)
      if (found) return found
    }
  }
  return null
}
