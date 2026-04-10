import { useEffect, useRef, useState } from 'react';
import api from '../api/client';

interface Props {
  docId: number;
  docName: string;
  onClose: () => void;
}

declare global {
  interface Window {
    DocsAPI?: any;
  }
}

const ONLYOFFICE_URL = '/office';

export function OnlyOfficeEditor({ docId, docName, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let scriptEl: HTMLScriptElement | null = null;

    async function init() {
      try {
        // Load OnlyOffice API script
        if (!window.DocsAPI) {
          await new Promise<void>((resolve, reject) => {
            scriptEl = document.createElement('script');
            scriptEl.src = `${ONLYOFFICE_URL}/web-apps/apps/api/documents/api.js`;
            scriptEl.onload = () => resolve();
            scriptEl.onerror = () => reject(new Error('Nu s-a putut încărca OnlyOffice. Verificați că serviciul rulează.'));
            document.head.appendChild(scriptEl);
          });
        }

        const { data: config } = await api.get(`/documents/${docId}/office-config/`);
        setLoading(false);

        if (!containerRef.current) return;

        editorRef.current = new window.DocsAPI.DocEditor('onlyoffice-container', {
          ...config,
          width: '100%',
          height: '100%',
          events: {
            onDocumentStateChange: () => {},
            onAppReady: () => setLoading(false),
            onError: (e: any) => {
              console.error('OnlyOffice error', e);
              setError('Eroare la deschiderea documentului.');
              setLoading(false);
            },
          },
        });
      } catch (e: any) {
        setError(e.message || 'Eroare la inițializarea editorului.');
        setLoading(false);
      }
    }

    init();

    return () => {
      if (editorRef.current?.destroyEditor) {
        editorRef.current.destroyEditor();
      }
    };
  }, [docId]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: '#1e293b',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: '#0f172a',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>H</span>
          </div>
          <span style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '600' }}>{docName}</span>
          {loading && (
            <span style={{ color: '#64748b', fontSize: 12 }}>Se pregătește editorul…</span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444', borderRadius: 6, padding: '5px 14px',
            fontSize: 13, fontWeight: '600', cursor: 'pointer',
          }}
        >
          Închide
        </button>
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {error ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: '#94a3b8',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: '700', color: '#f1f5f9', marginBottom: 8 }}>
              Editor indisponibil
            </div>
            <div style={{ fontSize: 13, maxWidth: 400, textAlign: 'center' }}>{error}</div>
          </div>
        ) : (
          <>
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: '#1e293b', color: '#94a3b8', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, border: '3px solid #334155',
                  borderTopColor: '#22C55E', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <span style={{ fontSize: 13 }}>Se pregătește documentul…</span>
              </div>
            )}
            <div
              id="onlyoffice-container"
              ref={containerRef}
              style={{ width: '100%', height: '100%' }}
            />
          </>
        )}
      </div>
    </div>
  );
}
