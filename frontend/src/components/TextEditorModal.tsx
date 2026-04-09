import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getDocumentContent, updateDocumentContent } from '../api/documents';

interface Props {
  docId: number;
  docName: string;
  onClose: () => void;
}

export function TextEditorModal({ docId, docName, onClose }: Props) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLoading(true);
    getDocumentContent(docId)
      .then(text => { setContent(text); setLoading(false); })
      .catch(() => { toast.error(t('common.error')); setLoading(false); });
  }, [docId]);

  // Escape to close (with dirty check)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dirty && !confirm(t('documents.editorUnsaved'))) return;
        onClose();
      }
      // Ctrl+S / Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dirty, content]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateDocumentContent(docId, content);
      toast.success(t('documents.savedOk'));
      setDirty(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (dirty && !confirm(t('documents.editorUnsaved'))) return;
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Toolbar */}
      <div style={{
        height: 52, flexShrink: 0, background: '#1e293b',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
      }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {docName}
          {dirty && <span style={{ color: '#f59e0b', marginLeft: 8, fontSize: 12 }}>●</span>}
        </div>
        <span style={{ fontSize: 11, color: '#475569' }}>Ctrl+S</span>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          style={{
            background: dirty ? '#22C55E' : '#334155',
            border: 'none', color: '#fff', borderRadius: 6,
            padding: '6px 16px', cursor: dirty ? 'pointer' : 'default',
            fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? t('documents.saving') : t('documents.saveBtn')}
        </button>
        <button
          onClick={handleClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
        >✕</button>
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0f172a' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#94a3b8', fontSize: 15 }}>
            {t('common.loading')}…
          </div>
        ) : (
          <textarea
            ref={taRef}
            value={content}
            onChange={e => { setContent(e.target.value); setDirty(true); }}
            spellCheck={false}
            style={{
              flex: 1, resize: 'none', border: 'none', outline: 'none',
              background: '#0f172a', color: '#e2e8f0',
              fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
              fontSize: 13, lineHeight: 1.7,
              padding: '20px 24px',
              tabSize: 2,
            }}
          />
        )}
        {/* Status bar */}
        <div style={{
          height: 26, flexShrink: 0, background: '#1e293b',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16,
          fontSize: 11, color: '#475569',
        }}>
          <span>{content.split('\n').length} {t('documents.editorLines')}</span>
          <span>{content.length} {t('documents.editorChars')}</span>
        </div>
      </div>
    </div>
  );
}
