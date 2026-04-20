import { useEffect, useRef, useState } from 'react';
import { publicGetShare, publicUpload, publicDeleteDoc } from '../api/folder_shares';

interface ShareDoc {
  id: number;
  name: string;
  description: string | null;
  category: string;
  file_size: number;
  content_type: string;
  created_at: string;
  tags: string | null;
  expires_at: string | null;
  download_url: string | null;
}

interface ShareInfo {
  token: string;
  folder_id: number;
  folder_name: string | null;
  label: string | null;
  can_read: boolean;
  can_upload: boolean;
  can_delete: boolean;
  expires_at: string | null;
  documents: ShareDoc[];
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const FILE_COLORS: Record<string, string> = {
  pdf: '#ef4444', word: '#3b82f6', excel: '#22c55e',
  image: '#a855f7', zip: '#f59e0b', text: '#06b6d4', other: '#94a3b8',
};

function getTypeKey(ct: string) {
  if (ct === 'application/pdf') return 'pdf';
  if (ct.includes('word') || ct === 'application/msword') return 'word';
  if (ct.includes('excel') || ct.includes('spreadsheet')) return 'excel';
  if (ct.startsWith('image/')) return 'image';
  if (ct.includes('zip')) return 'zip';
  if (ct.startsWith('text/')) return 'text';
  return 'other';
}

function FileIcon({ ct }: { ct: string }) {
  const key = getTypeKey(ct);
  const color = FILE_COLORS[key] || FILE_COLORS.other;
  const label = key.toUpperCase().slice(0, 4);
  return (
    <div style={{
      width: 42, height: 42, borderRadius: 8, flexShrink: 0,
      background: color + '22',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '-0.03em' }}>{label}</span>
    </div>
  );
}

export function SharePage({ token }: { token: string }) {
  const [info, setInfo]       = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await publicGetShare(token);
      setInfo(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Link invalid sau expirat');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  async function handleUpload(file: File) {
    if (!info?.can_upload) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await publicUpload(token, fd);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Eroare la upload');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: number, name: string) {
    if (!info?.can_delete) return;
    if (!confirm(`Ștergi "${name}"?`)) return;
    try {
      await publicDeleteDoc(token, docId);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Eroare la ștergere');
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ fontSize: 14, color: '#94a3b8' }}>Se încarcă...</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexDirection: 'column', gap: 12 }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>{error}</div>
      <div style={{ fontSize: 13, color: '#64748b' }}>Verificați URL-ul sau contactați persoana care v-a trimis link-ul.</div>
    </div>
  );

  if (!info) return null;

  const expiresDate = info.expires_at ? new Date(info.expires_at) : null;
  const isExpired = expiresDate && expiresDate < new Date();

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: '#1e3a8a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {info.label || info.folder_name || 'Folder partajat'}
            </div>
            {info.folder_name && info.label && (
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{info.folder_name}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {info.can_read && <span style={{ fontSize: 11, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>Citire</span>}
            {info.can_upload && <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>Upload</span>}
            {info.can_delete && <span style={{ fontSize: 11, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>Ștergere</span>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 24px' }}>

        {/* Expiry warning */}
        {expiresDate && !isExpired && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e', display: 'flex', gap: 8, alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Link valabil până la {expiresDate.toLocaleString('ro-RO')}
          </div>
        )}

        {/* Upload zone */}
        {info.can_upload && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#3b82f6' : '#cbd5e1'}`,
              borderRadius: 10, padding: '24px 20px', textAlign: 'center', cursor: 'pointer',
              background: dragging ? '#eff6ff' : '#fff', marginBottom: 20,
              transition: 'all 0.15s',
            }}
          >
            <input ref={fileRef} type="file" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            {uploading ? (
              <div style={{ fontSize: 13, color: '#64748b' }}>Se încarcă fișierul...</div>
            ) : (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', display: 'block' }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div style={{ fontSize: 13.5, color: '#475569' }}>
                  Trage un fișier sau <span style={{ color: '#2563eb', fontWeight: 600 }}>selectează</span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>PDF, Word, Excel, imagini, ZIP — max 50 MB</div>
              </>
            )}
          </div>
        )}

        {/* Document list */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
              {info.documents.length} {info.documents.length === 1 ? 'document' : 'documente'}
            </span>
          </div>

          {info.documents.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Niciun document în acest folder
            </div>
          ) : (
            <div>
              {info.documents.map((doc, i) => (
                <div key={doc.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
                  borderBottom: i < info.documents.length - 1 ? '1px solid #f1f5f9' : 'none',
                }}>
                  <FileIcon ct={doc.content_type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.name}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmt(doc.file_size)}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {new Date(doc.created_at).toLocaleDateString('ro-RO')}
                      </span>
                      {doc.tags && doc.tags.split(',').filter(Boolean).map(tag => (
                        <span key={tag} style={{ fontSize: 10, background: '#f1f5f9', color: '#475569', borderRadius: 10, padding: '1px 6px' }}>{tag.trim()}</span>
                      ))}
                      {doc.expires_at && (
                        <span style={{ fontSize: 10, background: new Date(doc.expires_at) < new Date() ? '#fef2f2' : '#fef9c3', color: new Date(doc.expires_at) < new Date() ? '#b91c1c' : '#854d0e', borderRadius: 10, padding: '1px 6px' }}>
                          Exp: {new Date(doc.expires_at).toLocaleDateString('ro-RO')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {doc.download_url && (
                      <a
                        href={doc.download_url}
                        download={doc.name}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: '#1e3a8a', color: '#fff', borderRadius: 7,
                          padding: '6px 12px', fontSize: 12, fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        ↓ Descarcă
                      </a>
                    )}
                    {info.can_delete && (
                      <button
                        onClick={() => handleDelete(doc.id, doc.name)}
                        style={{
                          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
                          borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        Șterge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#cbd5e1' }}>
          Powered by HestiOS · Hesti Rossmann GmbH
        </div>
      </div>
    </div>
  );
}
