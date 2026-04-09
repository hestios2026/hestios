import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDocument } from '../api/documents';
import type { Document } from '../types';

interface Props {
  docId: number;
  onClose: () => void;
}

function isImage(ct: string) { return ct.startsWith('image/'); }
function isPDF(ct: string) { return ct === 'application/pdf'; }

export function DocumentViewerModal({ docId, onClose }: Props) {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<Document | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Image zoom/pan
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const token = localStorage.getItem('hestios_token') || '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });

    (async () => {
      try {
        const d: Document = await getDocument(docId);
        if (cancelled) return;
        setDoc(d);

        if (isPDF(d.content_type) || isImage(d.content_type)) {
          // Fetch via authenticated backend endpoint — streams directly from MinIO
          const res = await fetch(`/api/documents/${docId}/view/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          if (!cancelled) setBlobUrl(URL.createObjectURL(blob));
        }
      } catch (e) {
        if (!cancelled) setError(t('common.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docId]);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => { setBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; }); };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleMouseDown(e: React.MouseEvent) {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return;
    setPos({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    });
  }
  function handleMouseUp() { dragging.current = false; }
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale(s => Math.max(0.1, Math.min(10, s - e.deltaY * 0.001)));
  }

  function handleDownload() {
    if (!doc || !blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl; a.download = doc.name; a.click();
  }

  const canView = doc && (isPDF(doc.content_type) || isImage(doc.content_type));

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Toolbar */}
      <div style={{
        height: 52, flexShrink: 0, background: '#1e293b',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
      }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc?.name || ''}
        </div>
        {doc && isImage(doc.content_type) && (
          <>
            <button onClick={() => setScale(s => Math.min(10, s * 1.25))}
              style={{ background: '#334155', border: 'none', color: '#f1f5f9', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 18 }}>+</button>
            <span style={{ color: '#94a3b8', fontSize: 13, minWidth: 48, textAlign: 'center' }}>{(scale * 100).toFixed(0)}%</span>
            <button onClick={() => setScale(s => Math.max(0.1, s / 1.25))}
              style={{ background: '#334155', border: 'none', color: '#f1f5f9', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 18 }}>−</button>
            <button onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); }}
              style={{ background: '#334155', border: 'none', color: '#f1f5f9', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{t('documents.viewerReset')}</button>
          </>
        )}
        {blobUrl && (
          <button onClick={handleDownload}
            style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {t('documents.downloadBtn')}
          </button>
        )}
        <button onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>✕</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 15 }}>
            {t('common.loading')}…
          </div>
        )}
        {!loading && error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#f87171', fontSize: 15 }}>
            {error}
          </div>
        )}
        {!loading && !error && doc && isPDF(doc.content_type) && blobUrl && (
          <iframe
            src={blobUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={doc.name}
          />
        )}
        {!loading && !error && doc && isImage(doc.content_type) && blobUrl && (
          <div
            style={{ width: '100%', height: '100%', overflow: 'hidden', cursor: 'grab', userSelect: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <img
              src={blobUrl}
              alt={doc.name}
              draggable={false}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${scale})`,
                transformOrigin: 'center', maxWidth: 'none',
              }}
            />
          </div>
        )}
        {!loading && !error && doc && !canView && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, color: '#94a3b8' }}>
            <div style={{ fontSize: 56 }}>📁</div>
            <div style={{ fontSize: 15 }}>{t('documents.noPreview')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
