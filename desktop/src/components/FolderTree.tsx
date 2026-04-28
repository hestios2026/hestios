import React, { useState } from 'react'

const C = { card: '#141D2E', border: '#1E293B', green: '#22C55E', text: '#E2E8F0', muted: '#64748B', hover: '#1E293B', active: '#0F2D1A' }

interface FolderNode {
  id: number
  name: string
  parent_id: number | null
  doc_count: number
  children?: FolderNode[]
}

interface Props {
  folders: FolderNode[]
  selectedId: number | null
  onSelect: (id: number | null) => void
  onCreateFolder: (parentId: number | null) => void
  onDeleteFolder: (id: number) => void
}

function FolderItem({
  folder, depth, selectedId, onSelect, onCreateFolder, onDeleteFolder
}: {
  folder: FolderNode; depth: number; selectedId: number | null
  onSelect: (id: number | null) => void
  onCreateFolder: (parentId: number | null) => void
  onDeleteFolder: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [hovered, setHovered] = useState(false)
  const isSelected = selectedId === folder.id
  const hasChildren = (folder.children?.length ?? 0) > 0

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: `5px 8px 5px ${12 + depth * 16}px`,
          borderRadius: 6, cursor: 'pointer', position: 'relative',
          background: isSelected ? C.active : hovered ? C.hover : 'transparent',
          color: isSelected ? C.green : C.text,
          transition: 'background 0.1s',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(folder.id)}
      >
        {hasChildren && (
          <span
            style={{ fontSize: 10, color: C.muted, transition: 'transform 0.15s', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
            onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          >▶</span>
        )}
        {!hasChildren && <span style={{ width: 14, flexShrink: 0 }} />}
        <span style={{ fontSize: 14 }}>📁</span>
        <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {folder.name}
        </span>
        {folder.doc_count > 0 && (
          <span style={{ fontSize: 10, color: C.muted, background: C.border, borderRadius: 10, padding: '1px 6px', flexShrink: 0 }}>
            {folder.doc_count}
          </span>
        )}
        {hovered && (
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button
              style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, padding: '2px 4px', borderRadius: 4 }}
              title="Folder nou"
              onClick={() => onCreateFolder(folder.id)}
            >+</button>
            <button
              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 12, padding: '2px 4px', borderRadius: 4 }}
              title="Șterge folder"
              onClick={() => onDeleteFolder(folder.id)}
            >×</button>
          </div>
        )}
      </div>
      {hasChildren && expanded && (
        <div>
          {folder.children!.map(child => (
            <FolderItem key={child.id} folder={child} depth={depth + 1}
              selectedId={selectedId} onSelect={onSelect}
              onCreateFolder={onCreateFolder} onDeleteFolder={onDeleteFolder} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FolderTree({ folders, selectedId, onSelect, onCreateFolder, onDeleteFolder }: Props) {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '8px 4px' }}>
      {/* Root */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
          background: selectedId === null ? C.active : 'transparent',
          color: selectedId === null ? C.green : C.text,
          marginBottom: 4,
        }}
        onClick={() => onSelect(null)}
      >
        <span style={{ fontSize: 14 }}>🏠</span>
        <span style={{ fontSize: 13, fontWeight: selectedId === null ? 600 : 400 }}>Toate documentele</span>
      </div>

      <div style={{ height: 1, background: C.border, margin: '4px 8px 8px' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px 6px' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Foldere</span>
        <button
          onClick={() => onCreateFolder(null)}
          style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
          title="Folder nou la rădăcină"
        >+</button>
      </div>

      {folders.length === 0 && (
        <div style={{ padding: '16px 12px', fontSize: 12, color: C.muted, textAlign: 'center' }}>
          Niciun folder
        </div>
      )}

      {folders.map(f => (
        <FolderItem key={f.id} folder={f} depth={0}
          selectedId={selectedId} onSelect={onSelect}
          onCreateFolder={onCreateFolder} onDeleteFolder={onDeleteFolder} />
      ))}
    </div>
  )
}
