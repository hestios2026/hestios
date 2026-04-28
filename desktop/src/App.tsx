import React, { useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage'
import BrowserPage from './pages/BrowserPage'

declare global {
  interface Window {
    api: {
      auth: {
        login: (serverUrl: string, email: string, password: string) => Promise<any>
        logout: () => Promise<any>
        status: () => Promise<any>
      }
      sync: {
        setFolder: (p: string) => Promise<any>
        getFolder: () => Promise<string | null>
        getState: () => Promise<any>
        force: () => Promise<any>
        start: () => Promise<any>
      }
      dms: {
        listFolders: () => Promise<any[]>
        listFiles: (folderId: number | null) => Promise<any[]>
        createFolder: (name: string, parentId: number | null) => Promise<any>
        deleteDocument: (docId: number) => Promise<any>
        deleteFolder: (folderId: number) => Promise<any>
      }
      shell: {
        pickFolder: () => Promise<string | null>
        reveal: (localPath: string) => Promise<void>
        openFile: (localPath: string) => Promise<void>
      }
      on: (channel: string, cb: (...args: any[]) => void) => () => void
    }
  }
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    window.api.auth.status().then(s => {
      setAuthed(s.isLoggedIn)
      if (s.isLoggedIn) setUser(s.user)
    })
  }, [])

  if (authed === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0C0F16' }}>
        <div style={{ color: '#64748B', fontSize: 14 }}>Se încarcă...</div>
      </div>
    )
  }

  if (!authed) {
    return <LoginPage onLogin={(u) => { setUser(u); setAuthed(true) }} />
  }

  return (
    <BrowserPage
      user={user}
      onLogout={() => {
        window.api.auth.logout().then(() => { setAuthed(false); setUser(null) })
      }}
    />
  )
}
