import React from 'react'

interface SyncState { status: string; lastSync: string | null; pending: number; errors: string[] }

const DOT: Record<string, string> = {
  idle: '#22C55E',
  syncing: '#F59E0B',
  error: '#EF4444',
  offline: '#64748B',
}

const LABEL: Record<string, string> = {
  idle: 'Sincronizat',
  syncing: 'Se sincronizează...',
  error: 'Eroare',
  offline: 'Offline',
}

export default function SyncStatus({ syncState, onForce }: { syncState: SyncState; onForce: () => void }) {
  const color = DOT[syncState.status] ?? '#64748B'
  const label = LABEL[syncState.status] ?? syncState.status
  const isSyncing = syncState.status === 'syncing'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', background: '#0C0F16', borderTop: '1px solid #1E293B', fontSize: 12, color: '#64748B' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, animation: isSyncing ? 'pulse 1.2s infinite' : undefined }} />
      <span style={{ color: isSyncing ? '#F59E0B' : '#94A3B8' }}>{label}</span>
      {syncState.lastSync && !isSyncing && (
        <span>· {new Date(syncState.lastSync).toLocaleTimeString('ro')}</span>
      )}
      {syncState.errors.length > 0 && (
        <span
          style={{ color: '#EF4444', cursor: 'pointer', textDecoration: 'underline dotted' }}
          onClick={() => alert(syncState.errors.join('\n'))}
        >
          {syncState.errors.length} eroare{syncState.errors.length !== 1 ? 'i' : ''}
        </span>
      )}
      <div style={{ flex: 1 }} />
      <button
        onClick={onForce}
        disabled={isSyncing}
        style={{ background: 'none', border: 'none', color: '#64748B', cursor: isSyncing ? 'not-allowed' : 'pointer', fontSize: 13, padding: '2px 6px' }}
        title="Sincronizează acum"
      >↻</button>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  )
}
