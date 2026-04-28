import React, { useState } from 'react'

const C = { border: '#1E293B', green: '#22C55E', text: '#E2E8F0', muted: '#64748B', hover: '#1E293B', card: '#141D2E' }

const ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'image/jpeg': '🖼',
  'image/png': '🖼',
  'image/webp': '🖼',
  'application/zip': '🗜',
  'text/plain': '📃',
}

function fileIcon(contentType: string): string {
  return ICONS[contentType] ?? '📎'
}

function fileSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ro', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Doc {
  id: number
  name: string
  file_size: number
  content_type: string
  created_at: string
  category: string
  local_path?: string
}

interface Props {
  documents: Doc[]
  loading: boolean
  syncFolder: string | null
  onDelete: (docId: number) => void
  onUpload: () => void
  onRefresh: () => void
  folderName: string
}

export default function FileList({ documents, loading, syncFolder, onDelete, onUpload, onRefresh, folderName }: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const filtered = documents.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text, flex: 1 }}>{folderName}</span>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Caută..."
          style={{
            padding: '6px 10px', background: '#0F172A', border: `1px solid ${C.border}`,
            borderRadius: 7, color: C.text, fontSize: 12, width: 160, outline: 'none',
          }}
        />
        <button onClick={onRefresh} style={toolBtn} title="Reîncarcă">↺</button>
        <button onClick={onUpload} style={{ ...toolBtn, background: C.green, color: '#0C0F16', fontWeight: 700 }} title="Încarcă fișier">
          + Adaugă
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>Se încarcă...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>
            {documents.length === 0 ? 'Niciun document în acest folder' : 'Niciun rezultat'}
          </div>
        )}
        {!loading && filtered.map(doc => (
          <div
            key={doc.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
              background: hoveredId === doc.id ? C.hover : 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={() => setHoveredId(doc.id)}
            onMouseLeave={() => setHoveredId(null)}
            onDoubleClick={() => {
              if (doc.local_path) window.api.shell.openFile(doc.local_path)
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{fileIcon(doc.content_type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.name}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                {fileSize(doc.file_size)} · {formatDate(doc.created_at)}
                <span style={{ marginLeft: 8, background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>
                  {doc.category}
                </span>
              </div>
            </div>
            {hoveredId === doc.id && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {doc.local_path && (
                  <button
                    style={actionBtn}
                    title="Deschide în Finder"
                    onClick={e => { e.stopPropagation(); window.api.shell.reveal(doc.local_path!) }}
                  >🔍</button>
                )}
                {doc.local_path && (
                  <button
                    style={actionBtn}
                    title="Deschide fișier"
                    onClick={e => { e.stopPropagation(); window.api.shell.openFile(doc.local_path!) }}
                  >↗</button>
                )}
                <button
                  style={{ ...actionBtn, color: '#EF4444' }}
                  title="Șterge"
                  onClick={e => { e.stopPropagation(); if (confirm(`Șterge "${doc.name}"?`)) onDelete(doc.id) }}
                >🗑</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '6px 16px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted, flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <span>{filtered.length} document{filtered.length !== 1 ? 'e' : ''}</span>
        {syncFolder && (
          <span style={{ cursor: 'pointer' }} onClick={() => window.api.shell.reveal(syncFolder)} title="Deschide folder sync">
            📁 {syncFolder.replace(/^.*[\\/]/, '')}
          </span>
        )}
      </div>
    </div>
  )
}

const toolBtn: React.CSSProperties = {
  padding: '6px 10px', background: '#1E293B', border: '1px solid #334155',
  borderRadius: 7, color: '#E2E8F0', fontSize: 13, cursor: 'pointer',
}

const actionBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 14, padding: '4px 6px', borderRadius: 5, color: '#94A3B8',
}
