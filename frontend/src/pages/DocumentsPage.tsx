import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { fetchDocuments, uploadDocument, deleteDocument, moveDocument, copyDocument, updateDocMeta, getDocVersions, bulkDocAction } from '../api/documents';
import { fetchFolders, createFolder, deleteFolder, renameFolder, deleteFolderRecursive, getFolderStats, FolderItem } from '../api/folders';
import { listShares, createShare, revokeShare } from '../api/folder_shares';
import { fetchDocumentCategories, DocCategory } from '../api/settings';
import { fetchSites } from '../api/sites';
import { DocumentViewerModal } from '../components/DocumentViewerModal';
import { TextEditorModal } from '../components/TextEditorModal';
import { OnlyOfficeEditor } from '../components/OnlyOfficeEditor';
import type { Document, Site } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES: DocCategory[] = [
  { key: 'contract',  label: 'Contract',  color: '#22C55E', icon: '📄' },
  { key: 'invoice',   label: 'Rechnung',  color: '#7c3aed', icon: '🧾' },
  { key: 'other',     label: 'Altele',    color: '#64748b', icon: '📁' },
];

// ─── CSS Injection ─────────────────────────────────────────────────────────────

function useDocPageStyles() {
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'docs-page-styles';
    el.textContent = `
      .dp-folder-item { transition: background 0.1s; cursor: pointer; }
      .dp-folder-item:hover { background: var(--surface-2) !important; }
      .dp-folder-item.active { background: rgba(34,197,94,0.1) !important; }
      .dp-doc-row { transition: background 0.1s; cursor: pointer; }
      .dp-doc-row:hover { background: var(--surface-2) !important; }
      .dp-doc-row.active { background: rgba(34,197,94,0.07) !important; }
      .dp-subfolder-card { transition: all 0.15s; cursor: pointer; }
      .dp-subfolder-card:hover { background: var(--surface-3) !important; border-color: rgba(34,197,94,0.3) !important; }
      .dp-action-btn { transition: all 0.12s; background: transparent; border: none; cursor: pointer; }
      .dp-action-btn:hover { background: var(--surface-3) !important; }
      .dp-search:focus { border-color: var(--green) !important; box-shadow: 0 0 0 2px rgba(34,197,94,0.12) !important; }
      .dp-upload-zone { transition: all 0.15s; }
      .dp-upload-zone:hover { border-color: var(--green) !important; background: rgba(34,197,94,0.04) !important; }
      .dp-upload-zone.dragging { border-color: var(--green) !important; background: rgba(34,197,94,0.08) !important; }
      @keyframes dp-fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      .dp-fade-in { animation: dp-fade-in 0.18s ease; }
      .dp-cat-chip { transition: all 0.12s; cursor: pointer; }
      .dp-cat-chip:hover { opacity: 0.85; }
      .dp-icon-btn { transition: all 0.12s; background: none; border: none; cursor: pointer; border-radius: 5px; display: flex; align-items: center; justify-content: center; }
      .dp-icon-btn:hover { background: var(--surface-3) !important; }
      @media (max-width: 767px) {
        .dp-three-panel { flex-direction: column !important; }
        .dp-folder-sidebar { width: 100% !important; max-height: 220px !important; }
        .dp-detail-panel { display: none !important; }
        .dp-mobile-detail-overlay {
          position: fixed; inset: 0; z-index: 500;
          background: var(--surface);
          overflow-y: auto;
          padding: 0;
        }
        .dp-mobile-detail-back {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 16px; font-size: 13px; font-weight: 600;
          color: var(--green); background: var(--surface);
          border-bottom: 1px solid var(--border);
          cursor: pointer; position: sticky; top: 0; z-index: 1;
        }
      }
      @media (min-width: 768px) {
        .dp-mobile-detail-overlay { display: none !important; }
      }
    `;
    document.head.appendChild(el);
    return () => { document.getElementById('docs-page-styles')?.remove(); };
  }, []);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Document name helpers ────────────────────────────────────────────────────

/** Returns just the filename, decoding URL-encoded WebDAV/Nextcloud paths. */
function cleanDocName(raw: string): string {
  try {
    const decoded = decodeURIComponent(raw);
    const last = decoded.split('/').filter(Boolean).pop();
    return last || decoded;
  } catch {
    return raw;
  }
}

/** Returns the decoded folder path portion, or null if it's a plain filename. */
function docRemotePath(raw: string): string | null {
  try {
    const decoded = decodeURIComponent(raw);
    const parts = decoded.split('/').filter(Boolean);
    if (parts.length <= 1) return null;
    // Nextcloud WebDAV: .../dav/files/<user>/<Folder>/<Sub>/file.ext
    const filesIdx = parts.findIndex(p => p === 'files');
    if (filesIdx !== -1 && parts.length > filesIdx + 3) {
      return parts.slice(filesIdx + 2, parts.length - 1).join(' › ');
    }
    // Generic path
    const folderParts = parts.slice(0, parts.length - 1);
    const meaningful = folderParts.filter(p => !p.includes('://') && !p.includes('.php'));
    return meaningful.length > 0 ? meaningful.join(' › ') : null;
  } catch {
    return null;
  }
}

function flattenFolders(items: FolderItem[]): FolderItem[] {
  const result: FolderItem[] = [];
  function walk(list: FolderItem[]) {
    for (const f of list) { result.push(f); if (f.children?.length) walk(f.children); }
  }
  walk(items);
  return result;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(ct: string) { return ct.startsWith('image/'); }
function isPDF(ct: string)   { return ct === 'application/pdf'; }

// ─── File Type Badge ──────────────────────────────────────────────────────────

const FILE_TYPE_CONFIGS: Record<string, { bg: string; fg: string; label: string }> = {
  pdf:   { bg: 'rgba(239,68,68,0.15)',   fg: '#F87171', label: 'PDF'  },
  word:  { bg: 'rgba(59,130,246,0.15)',  fg: '#60A5FA', label: 'DOC'  },
  excel: { bg: 'rgba(34,197,94,0.15)',   fg: '#4ADE80', label: 'XLS'  },
  image: { bg: 'rgba(168,85,247,0.15)',  fg: '#C084FC', label: 'IMG'  },
  zip:   { bg: 'rgba(245,158,11,0.15)',  fg: '#FCD34D', label: 'ZIP'  },
  text:  { bg: 'rgba(14,165,233,0.15)',  fg: '#38BDF8', label: 'TXT'  },
  ppt:   { bg: 'rgba(249,115,22,0.15)',  fg: '#FB923C', label: 'PPT'  },
  other: { bg: 'rgba(100,116,139,0.15)', fg: '#94A3B8', label: 'FILE' },
};

function getFileTypeKey(ct: string): string {
  if (isPDF(ct)) return 'pdf';
  if (ct.includes('word') || ct === 'application/msword') return 'word';
  if (ct.includes('excel') || ct.includes('spreadsheet')) return 'excel';
  if (isImage(ct)) return 'image';
  if (ct.includes('zip')) return 'zip';
  if (ct.startsWith('text/')) return 'text';
  if (ct.includes('powerpoint') || ct.includes('presentation')) return 'ppt';
  return 'other';
}

function FileTypeBadge({ contentType, size = 40 }: { contentType: string; size?: number }) {
  const cfg = FILE_TYPE_CONFIGS[getFileTypeKey(contentType)];
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.22),
      background: cfg.bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontSize: size * 0.27, fontWeight: 800, color: cfg.fg,
        fontFamily: 'var(--font-mono)', letterSpacing: '-0.04em', lineHeight: 1,
      }}>
        {cfg.label}
      </span>
    </div>
  );
}

// ─── Modal Base ───────────────────────────────────────────────────────────────

function ModalOverlay({ onClose, children, width = 440 }: { onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="dp-fade-in"
        style={{
          width, maxWidth: '92vw', maxHeight: '88vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{
      padding: '18px 20px 14px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      <button
        onClick={onClose}
        className="dp-icon-btn"
        style={{ width: 28, height: 28, color: 'var(--text-2)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Move Picker Modal ────────────────────────────────────────────────────────

function MovePicker({ folders, currentFolderId, excludeFolderId, title, onConfirm, onClose }: {
  folders: FolderItem[];
  currentFolderId: number | null;
  excludeFolderId?: number;
  title: string;
  onConfirm: (folderId: number | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(currentFolderId);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  function getDescendants(id: number): Set<number> {
    const set = new Set<number>([id]);
    for (const f of folders) { if (f.parent_id === id) getDescendants(f.id).forEach(d => set.add(d)); }
    return set;
  }
  const excluded = excludeFolderId !== undefined ? getDescendants(excludeFolderId) : new Set<number>();

  function toggle(id: number) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function renderNode(f: FolderItem, depth = 0): React.ReactNode {
    if (excluded.has(f.id)) return null;
    const children = folders.filter(c => c.parent_id === f.id && !excluded.has(c.id));
    const isSel = selected === f.id;
    return (
      <div key={f.id}>
        <div
          onClick={() => setSelected(isSel ? null : f.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: `7px 12px 7px ${16 + depth * 18}px`,
            borderRadius: 7, marginBottom: 2, cursor: 'pointer',
            background: isSel ? 'rgba(34,197,94,0.12)' : 'transparent',
            border: isSel ? '1px solid rgba(34,197,94,0.25)' : '1px solid transparent',
            transition: 'all 0.1s',
          }}
        >
          {children.length > 0 ? (
            <span
              onClick={e => { e.stopPropagation(); toggle(f.id); }}
              style={{ color: 'var(--text-2)', fontSize: 10, width: 14, textAlign: 'center', flexShrink: 0 }}
            >
              {expanded.has(f.id) ? '▾' : '▸'}
            </span>
          ) : <span style={{ width: 14, flexShrink: 0 }} />}
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isSel ? 'rgba(34,197,94,0.6)' : 'rgba(255,255,255,0.15)'} stroke={isSel ? '#22C55E' : 'var(--text-2)'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          <span style={{ fontSize: 13, flex: 1, color: isSel ? '#22C55E' : 'var(--text)', fontWeight: isSel ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f.name}
          </span>
          {isSel && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </div>
        {expanded.has(f.id) && children.map(c => renderNode(c, depth + 1))}
      </div>
    );
  }

  const rootFolders = folders.filter(f => f.parent_id === null && !excluded.has(f.id));

  async function handleConfirm() {
    setSaving(true);
    try { await onConfirm(selected); } finally { setSaving(false); }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title={title} onClose={onClose} />
      <div style={{ overflowY: 'auto', flex: 1, padding: '10px 12px' }}>
        {/* Root option */}
        <div
          onClick={() => setSelected(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            borderRadius: 7, cursor: 'pointer', marginBottom: 6,
            background: selected === null ? 'rgba(34,197,94,0.12)' : 'var(--surface-2)',
            border: selected === null ? '1px solid rgba(34,197,94,0.25)' : '1px solid var(--border)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={selected === null ? '#22C55E' : 'var(--text-2)'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: selected === null ? '#22C55E' : 'var(--text)', flex: 1 }}>
            {t('documentsExtra.rootFolder')}
          </span>
          {selected === null && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </div>
        {rootFolders.map(f => renderNode(f, 0))}
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="btn-primary"
          style={{ opacity: saving ? 0.6 : 1, flex: 1 }}
        >
          {saving ? t('documentsExtra.moving') : t('documentsExtra.moveHere')}
        </button>
        <button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
      </div>
    </ModalOverlay>
  );
}

// ─── Create Folder Modal ──────────────────────────────────────────────────────

function CreateFolderModal({ sites, onCreated, onClose }: {
  sites: Site[];
  onCreated: (folder: FolderItem) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error(t('documentsExtra.folderNameRequired')); return; }
    setSaving(true);
    try {
      const folder = await createFolder({ name: name.trim(), site_id: siteId ? parseInt(siteId) : undefined, description: description.trim() || undefined });
      toast.success(t('documentsExtra.folderCreated'));
      onCreated(folder);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    } finally { setSaving(false); }
  }

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };

  return (
    <ModalOverlay onClose={onClose} width={420}>
      <ModalHeader title={t('documentsExtra.folderNew')} onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={lbl}>{t('documentsExtra.folderName')}</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('documentsExtra.folderNamePlaceholder')} autoFocus required style={{ width: '100%' }} />
        </div>
        <div>
          <label style={lbl}>{t('documentsExtra.folderClient')}</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ width: '100%' }}>
            <option value="">{t('documentsExtra.folderNoClient')}</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>{t('documentsExtra.folderDescription')}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', height: 72, resize: 'vertical' }} placeholder={t('documents.descPlaceholder')} />
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1, opacity: saving ? 0.6 : 1 }}>
            {saving ? t('documentsExtra.folderCreating') : t('documentsExtra.folderCreate')}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </form>
    </ModalOverlay>
  );
}

// ─── Edit Folder Modal ────────────────────────────────────────────────────────

function EditFolderModal({ folder, sites, onSaved, onClose }: {
  folder: FolderItem;
  sites: Site[];
  onSaved: (updated: FolderItem) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(folder.name);
  const [siteId, setSiteId] = useState(folder.site_id != null ? String(folder.site_id) : '');
  const [description, setDescription] = useState(folder.description || '');
  const [saving, setSaving] = useState(false);

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error(t('documentsExtra.folderNameRequired')); return; }
    setSaving(true);
    try {
      const payload: Parameters<typeof renameFolder>[1] = { name: name.trim(), description: description.trim() || undefined };
      if (siteId) payload.site_id = parseInt(siteId);
      else payload.clear_site = true;
      const updated = await renameFolder(folder.id, payload);
      toast.success(t('documentsExtra.folderUpdated'));
      onSaved(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    } finally { setSaving(false); }
  }

  return (
    <ModalOverlay onClose={onClose} width={420}>
      <ModalHeader title={t('documentsExtra.editFolder')} onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={lbl}>{t('documentsExtra.folderName')}</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus required style={{ width: '100%' }} />
        </div>
        <div>
          <label style={lbl}>{t('documentsExtra.folderSite')}</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ width: '100%' }}>
            <option value="">{t('documentsExtra.folderNoSite')}</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>{t('documentsExtra.folderDescription')}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', height: 72, resize: 'vertical' }} placeholder={t('documents.descPlaceholder')} />
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1, opacity: saving ? 0.6 : 1 }}>
            {saving ? t('documentsExtra.folderSaving') : t('documentsExtra.folderSave')}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </form>
    </ModalOverlay>
  );
}

// ─── Folder Sidebar ───────────────────────────────────────────────────────────

function FolderSidebar({ folders, sites, selectedFolder, onSelect, onNewFolder, onFolderRenamed, onFolderDeleted, onMoveFolder, onShare }: {
  folders: FolderItem[];
  sites: Site[];
  selectedFolder: FolderItem | null;
  onSelect: (folder: FolderItem | null) => void;
  onNewFolder: () => void;
  onFolderRenamed: (folder: FolderItem) => void;
  onFolderDeleted: (folderId: number) => void;
  onMoveFolder: (folder: FolderItem) => void;
  onShare: (folder: FolderItem) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<FolderItem | null>(null);

  const topLevel = folders.filter(f => !f.parent_id);
  const grouped: { siteKey: string; siteLabel: string; items: FolderItem[] }[] = [];
  const siteMap = new Map<string, { label: string; items: FolderItem[] }>();

  for (const f of topLevel) {
    const key = f.site_id != null ? String(f.site_id) : '__none__';
    const label = f.site_id != null
      ? (f.site_kostenstelle ? `${f.site_kostenstelle} — ${f.site_name || ''}` : f.site_name || String(f.site_id))
      : t('documentsExtra.folderNoClient');
    if (!siteMap.has(key)) siteMap.set(key, { label, items: [] });
    siteMap.get(key)!.items.push(f);
  }
  siteMap.forEach((val, key) => grouped.push({ siteKey: key, siteLabel: val.label, items: val.items }));

  function getChildren(parentId: number) { return folders.filter(f => f.parent_id === parentId); }

  function toggleExpand(id: number) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function startRename(folder: FolderItem) { setRenamingId(folder.id); setRenameValue(folder.name); }

  async function commitRename(folder: FolderItem) {
    if (!renameValue.trim() || renameValue.trim() === folder.name) { setRenamingId(null); return; }
    try {
      const updated = await renameFolder(folder.id, { name: renameValue.trim() });
      toast.success(t('documentsExtra.folderRenamed'));
      onFolderRenamed(updated);
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
    finally { setRenamingId(null); }
  }

  async function handleDelete(folder: FolderItem) {
    setDeletingFolder(folder);
  }

  async function confirmSidebarDelete(folder: FolderItem) {
    try {
      const result = await deleteFolderRecursive(folder.id);
      toast.success(`Șters: ${result.deleted_folders} foldere, ${result.deleted_files} fișiere`);
      setDeletingFolder(null);
      onFolderDeleted(folder.id);
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
  }

  function renderFolder(folder: FolderItem, depth = 0) {
    const children = getChildren(folder.id);
    const isExpanded = expanded.has(folder.id);
    const isSelected = selectedFolder?.id === folder.id;
    const isHovered = hoveredId === folder.id;
    const isRenaming = renamingId === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`dp-folder-item${isSelected ? ' active' : ''}`}
          onMouseEnter={() => setHoveredId(folder.id)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => { if (!isRenaming) onSelect(folder); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: `5px 8px 5px ${10 + depth * 14}px`,
            borderRadius: 6, marginBottom: 1,
            background: isSelected ? 'rgba(34,197,94,0.1)' : 'transparent',
            borderLeft: isSelected ? '2px solid rgba(34,197,94,0.5)' : '2px solid transparent',
          }}
        >
          {/* Expand toggle */}
          <span
            onClick={e => { e.stopPropagation(); if (children.length > 0) toggleExpand(folder.id); }}
            style={{
              width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: children.length > 0 ? 'var(--text-2)' : 'transparent', fontSize: 9, flexShrink: 0,
              cursor: children.length > 0 ? 'pointer' : 'default',
            }}
          >
            {children.length > 0 ? (isExpanded ? '▾' : '▸') : ''}
          </span>

          {/* Folder icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill={isSelected ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'} stroke={isSelected ? '#22C55E' : 'var(--text-2)'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>

          {/* Name or rename input */}
          {isRenaming ? (
            <input
              autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onBlur={() => commitRename(folder)}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(folder); if (e.key === 'Escape') setRenamingId(null); }}
              onClick={e => e.stopPropagation()}
              style={{ flex: 1, padding: '1px 5px', fontSize: 12, borderRadius: 4 }}
            />
          ) : (
            <span style={{
              fontSize: 12.5, flex: 1, color: isSelected ? 'var(--green)' : 'var(--text)',
              fontWeight: isSelected ? 600 : 400,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {folder.name}
            </span>
          )}

          {/* Doc count badge */}
          {folder.doc_count > 0 && !isRenaming && !isHovered && (
            <span style={{
              fontSize: 10, fontWeight: 700, background: 'var(--surface-3)', color: 'var(--text-2)',
              borderRadius: 8, padding: '1px 5px', flexShrink: 0,
            }}>
              {folder.doc_count}
            </span>
          )}

          {/* Action buttons on hover */}
          {isHovered && !isRenaming && (
            <span style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              <button title="Partajează" onClick={e => { e.stopPropagation(); onShare(folder); }} className="dp-icon-btn" style={{ width: 22, height: 22, color: '#a78bfa', fontSize: 11 }}>⇧</button>
              <button title="Mută" onClick={e => { e.stopPropagation(); onMoveFolder(folder); }} className="dp-icon-btn" style={{ width: 22, height: 22, color: '#60A5FA', fontSize: 11 }}>↗</button>
              <button title="Editează / atribuie șantier" onClick={e => { e.stopPropagation(); setEditingFolder(folder); }} className="dp-icon-btn" style={{ width: 22, height: 22, color: 'var(--text-2)', fontSize: 11 }}>⚙</button>
              <button title={t('common.delete')} onClick={e => { e.stopPropagation(); handleDelete(folder); }} className="dp-icon-btn" style={{ width: 22, height: 22, color: 'var(--red)', fontSize: 11 }}>✕</button>
            </span>
          )}
        </div>
        {isExpanded && children.map(child => renderFolder(child, depth + 1))}
      </div>
    );
  }

  return (
    <>
    {editingFolder && (
      <EditFolderModal
        folder={editingFolder}
        sites={sites}
        onSaved={updated => { onFolderRenamed(updated); setEditingFolder(null); }}
        onClose={() => setEditingFolder(null)}
      />
    )}
    {deletingFolder && (
      <DeleteFolderConfirmModal
        folder={deletingFolder}
        onConfirm={() => confirmSidebarDelete(deletingFolder)}
        onClose={() => setDeletingFolder(null)}
      />
    )}
    <div className="dp-folder-sidebar" style={{
      width: 236, flexShrink: 0,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      maxHeight: 'calc(100vh - 200px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 12px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {t('documentsExtra.foldersHeader')}
        </span>
        <button
          onClick={onNewFolder}
          style={{
            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700,
            color: 'var(--green)', cursor: 'pointer',
          }}
        >
          + {t('documentsExtra.newBtn')}
        </button>
      </div>

      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {/* All Documents item */}
        <div
          className={`dp-folder-item${selectedFolder === null ? ' active' : ''}`}
          onClick={() => onSelect(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px',
            borderRadius: 6, marginBottom: 8,
            background: selectedFolder === null ? 'rgba(34,197,94,0.1)' : 'transparent',
            borderLeft: selectedFolder === null ? '2px solid rgba(34,197,94,0.5)' : '2px solid transparent',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={selectedFolder === null ? 'var(--green)' : 'var(--text-2)'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
          <span style={{ fontSize: 12.5, fontWeight: selectedFolder === null ? 700 : 500, color: selectedFolder === null ? 'var(--green)' : 'var(--text)' }}>
            {t('documentsExtra.allDocuments')}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 4px 8px' }} />

        {/* Grouped folders */}
        {grouped.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'center', padding: '16px 8px', fontStyle: 'italic' }}>
            {t('documentsExtra.noFolders')}
          </div>
        )}
        {grouped.map(group => (
          <div key={group.siteKey} style={{ marginBottom: 10 }}>
            {grouped.length > 1 && (
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 10px 4px' }}>
                {group.siteLabel}
              </div>
            )}
            {group.items.map(f => renderFolder(f, 0))}
          </div>
        ))}
      </div>
    </div>
    </>
  );
}

// ─── Upload Form ──────────────────────────────────────────────────────────────

function UploadForm({ sites, folders, categories, onUploaded, onCancel }: {
  sites: Site[];
  folders: FolderItem[];
  categories: DocCategory[];
  onUploaded: (doc: Document) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ category: 'other', description: '', site_id: '', notes: '', folder_id: '', tags: '', expires_at: '' });
  const ff = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) { toast.error(t('common.select')); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('category', form.category);
      fd.append('description', form.description);
      if (form.site_id) fd.append('site_id', form.site_id);
      if (form.notes) fd.append('notes', form.notes);
      if (form.folder_id) fd.append('folder_id', form.folder_id);
      if (form.tags) fd.append('tags', form.tags);
      if (form.expires_at) fd.append('expires_at', form.expires_at);
      const doc = await uploadDocument(fd);
      toast.success(t('documents.uploadedOk'));
      onUploaded(doc);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    } finally { setUploading(false); }
  }

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };

  return (
    <form onSubmit={handleSubmit}>
      {/* Drop zone */}
      <div
        className={`dp-upload-zone${dragging ? ' dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--green)' : 'var(--border)'}`,
          borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
          marginBottom: 20, background: dragging ? 'rgba(34,197,94,0.05)' : 'var(--surface-2)',
        }}
      >
        <input ref={fileRef} type="file" style={{ display: 'none' }}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.zip"
          onChange={e => e.target.files?.[0] && setSelectedFile(e.target.files[0])} />
        {selectedFile ? (
          <div>
            <FileTypeBadge contentType={selectedFile.type} size={44} />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 10 }}>{selectedFile.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{formatSize(selectedFile.size)}</div>
          </div>
        ) : (
          <div>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
              {t('documents.dragText')} <span style={{ color: 'var(--green)', fontWeight: 600 }}>{t('documents.dragSelect')}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{t('documents.fileTypes')}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>{t('common.category')}</label>
          <select value={form.category} onChange={e => ff('category', e.target.value)} style={{ width: '100%' }}>
            {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>{t('documents.siteAssoc')}</label>
          <select value={form.site_id} onChange={e => ff('site_id', e.target.value)} style={{ width: '100%' }}>
            <option value="">{t('common.noSite')}</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>{t('documentsExtra.folderLabel')}</label>
          <select value={form.folder_id} onChange={e => ff('folder_id', e.target.value)} style={{ width: '100%' }}>
            <option value="">{t('documentsExtra.folderNone')}</option>
            {folders.map(fl => <option key={fl.id} value={fl.id}>{fl.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>{t('documents.shortDesc')}</label>
          <input value={form.description} onChange={e => ff('description', e.target.value)} placeholder={t('documents.descPlaceholder')} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={lbl}>{t('documentsExtra.tagsLabel')}</label>
          <input value={form.tags} onChange={e => ff('tags', e.target.value)} placeholder="tag1, tag2, ..." style={{ width: '100%' }} />
        </div>
        <div>
          <label style={lbl}>{t('documentsExtra.expiryLabel')}</label>
          <input type="date" value={form.expires_at} onChange={e => ff('expires_at', e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button type="submit" className="btn-primary" disabled={uploading} style={{ opacity: uploading ? 0.6 : 1 }}>
          {uploading ? t('documents.uploading') : t('documents.uploadBtn')}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

// ─── Document Row ─────────────────────────────────────────────────────────────

const OFFICE_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function DocRow({ doc, selected, catMap, onClick }: {
  doc: Document & { folder_id?: number; folder_name?: string };
  selected: boolean;
  catMap: Record<string, DocCategory>;
  onClick: () => void;
}) {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const cat = catMap[doc.category] || catMap['other'] || { color: '#64748b' };

  return (
    <div
      className={`dp-doc-row${selected ? ' active' : ''}`}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
        borderBottom: '1px solid var(--border-light)',
        background: selected ? 'rgba(34,197,94,0.07)' : 'transparent',
        borderLeft: `2px solid ${selected ? cat.color : 'transparent'}`,
      }}
    >
      <FileTypeBadge contentType={doc.content_type} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cleanDocName(doc.name)}
        </div>
        {docRemotePath(doc.name) && (
          <div style={{ fontSize: 10, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            {docRemotePath(doc.name)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
            background: cat.color + '20', color: cat.color,
          }}>
            {doc.category}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{formatSize(doc.file_size)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {new Date(doc.created_at).toLocaleDateString(locale)}
          </span>
        </div>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}

// ─── Document Detail Panel ────────────────────────────────────────────────────

function DocDetail({ doc, catMap, onDelete, onClose, onView, onEdit, onOfficeEdit, onMove, onMetaUpdated, onVersions }: {
  doc: Document & { tags?: string; expires_at?: string; version?: number };
  catMap: Record<string, DocCategory>; onDelete: () => void; onClose: () => void;
  onView: () => void; onEdit: () => void; onOfficeEdit: () => void; onMove: () => void;
  onMetaUpdated: (d: Document) => void; onVersions: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const cat = catMap[doc.category] || catMap['other'] || { key: doc.category, label: doc.category, color: '#64748b', icon: '📁' };
  const token = localStorage.getItem('hestios_token');
  const canView = isImage(doc.content_type) || isPDF(doc.content_type);
  const canEdit = doc.content_type.startsWith('text/');
  const canOfficeEdit = OFFICE_TYPES.has(doc.content_type);

  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(doc.name);
  const [tagsVal, setTagsVal] = useState(doc.tags || '');
  const [expiryVal, setExpiryVal] = useState(doc.expires_at ? doc.expires_at.split('T')[0] : '');
  const [savingMeta, setSavingMeta] = useState(false);

  async function saveMeta() {
    setSavingMeta(true);
    try {
      const updated = await updateDocMeta(doc.id, {
        name: renameVal,
        tags: tagsVal,
        expires_at: expiryVal ? new Date(expiryVal).toISOString() : '',
      });
      onMetaUpdated(updated);
      setRenaming(false);
      toast.success(t('documentsExtra.metaSaved'));
    } catch { toast.error(t('documentsExtra.metaSaveError')); }
    finally { setSavingMeta(false); }
  }

  const tags = (doc.tags || '').split(',').map(s => s.trim()).filter(Boolean);
  const expiry = doc.expires_at ? new Date(doc.expires_at) : null;
  const expiryOverdue = expiry && expiry < new Date();
  const expirySoon = expiry && !expiryOverdue && (expiry.getTime() - Date.now()) < 30 * 86400000;

  const metaRows = [
    { label: t('documents.uploadedBy'), value: doc.uploader_name || '—' },
    { label: t('common.date'), value: new Date(doc.created_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' }) },
    { label: t('documents.siteAssoc'), value: doc.site_name || '—' },
    { label: t('documents.fileSize'), value: formatSize(doc.file_size) },
  ].filter(r => r.value !== '—' || true);

  return (
    <div className="dp-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 18px',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <FileTypeBadge contentType={doc.content_type} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word', lineHeight: 1.35 }}>
              {cleanDocName(doc.name)}
            </div>
            {docRemotePath(doc.name) && (
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                {t('documentsExtra.remotePath')}: {docRemotePath(doc.name)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ background: cat.color + '20', color: cat.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                {t(`documents.categories.${cat.key}` as any, cat.label)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{doc.content_type}</span>
            </div>
          </div>
          <button onClick={onClose} className="dp-icon-btn" style={{ width: 26, height: 26, color: 'var(--text-2)', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Image preview */}
        {isImage(doc.content_type) && doc.download_url && (
          <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 14, border: '1px solid var(--border)' }}>
            <img src={doc.download_url} alt={doc.name} style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block', background: 'var(--surface-2)' }} />
          </div>
        )}

        {/* Metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {metaRows.map(row => (
            <div key={row.label} style={{ background: 'var(--surface-2)', borderRadius: 7, padding: '8px 10px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 9.5, color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{row.label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</div>
            </div>
          ))}
        </div>

        {(doc.description || doc.notes) && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 7, border: '1px solid var(--border-light)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            {doc.description || doc.notes}
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {tags.map(tag => (
              <span key={tag} style={{ fontSize: 10, background: 'var(--surface-3)', color: 'var(--text-2)', borderRadius: 10, padding: '2px 8px', border: '1px solid var(--border)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Expiry badge */}
        {expiry && (
          <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 7, border: '1px solid', fontSize: 11, fontWeight: 600,
            background: expiryOverdue ? 'rgba(239,68,68,0.08)' : expirySoon ? 'rgba(245,158,11,0.08)' : 'var(--surface-2)',
            borderColor: expiryOverdue ? 'rgba(239,68,68,0.3)' : expirySoon ? 'rgba(245,158,11,0.3)' : 'var(--border)',
            color: expiryOverdue ? 'var(--red)' : expirySoon ? '#d97706' : 'var(--text-2)',
          }}>
            {t(expiryOverdue ? 'documentsExtra.expiryOverdue' : 'documentsExtra.expirySoon')}: {expiry.toLocaleDateString(locale)}
          </div>
        )}

        {/* Version */}
        {(doc.version || 0) > 1 && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-3)' }}>
            {t('documentsExtra.versionLabel', { n: doc.version })}
          </div>
        )}
      </div>

      {/* Rename / meta edit panel */}
      {renaming && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{t('documentsExtra.editMeta')}</div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>{t('documentsExtra.metaFileName')}</label>
            <input value={renameVal} onChange={e => setRenameVal(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>{t('documentsExtra.metaTags')}</label>
            <input value={tagsVal} onChange={e => setTagsVal(e.target.value)} placeholder="contract, semnat, urgent" style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>{t('documentsExtra.metaExpiry')}</label>
            <input type="date" value={expiryVal} onChange={e => setExpiryVal(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={saveMeta} disabled={savingMeta} className="btn-primary" style={{ flex: 1, padding: '7px', fontSize: 12 }}>
              {savingMeta ? t('documentsExtra.metaSaving') : t('documentsExtra.metaSave')}
            </button>
            <button onClick={() => setRenaming(false)} className="btn-ghost" style={{ padding: '7px 12px', fontSize: 12 }}>{t('documentsExtra.metaCancel')}</button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Primary actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          {canView && (
            <button onClick={onView} className="btn-primary" style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}>
              {t('documents.viewBtn')}
            </button>
          )}
          {canOfficeEdit && (
            <button onClick={onOfficeEdit} className="btn-primary" style={{ flex: 1, padding: '8px 12px', fontSize: 12, background: 'var(--green-dark)' }}>
              ✏ {t('documentsExtra.officeEditBtn')}
            </button>
          )}
          {canEdit && (
            <button onClick={onEdit} className="btn-ghost" style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}>
              {t('documents.editBtn')}
            </button>
          )}
          {!canView && !canEdit && !canOfficeEdit && (
            <div style={{ flex: 1 }} />
          )}
        </div>

        {/* Secondary actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => {
              fetch(`/api/documents/${doc.id}/download/`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'follow' })
                .then(r => r.blob()).then(blob => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = doc.name; a.click(); URL.revokeObjectURL(url);
                });
            }}
            className="btn-ghost" style={{ flex: 1, padding: '7px 12px', fontSize: 12 }}
          >
            ↓ {t('documents.downloadBtn')}
          </button>
          <button onClick={onMove} className="btn-ghost" style={{ padding: '7px 14px', fontSize: 12, color: '#60A5FA' }}>
            ↗ {t('documentsExtra.moveDocBtn')}
          </button>
        </div>

        {/* Tertiary actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setRenaming(r => !r); setRenameVal(doc.name); setTagsVal(doc.tags || ''); setExpiryVal(doc.expires_at ? doc.expires_at.split('T')[0] : ''); }}
            className="btn-ghost" style={{ flex: 1, padding: '7px 12px', fontSize: 12 }}>
            ✎ {t('documentsExtra.renameTagsBtn')}
          </button>
          <button onClick={onVersions} className="btn-ghost" style={{ padding: '7px 14px', fontSize: 12, color: 'var(--text-2)' }}>
            ⊞ {t('documentsExtra.versionsBtn')}
          </button>
        </div>

        {/* Danger */}
        <button
          onClick={onDelete}
          className="btn-ghost"
          style={{ padding: '7px 12px', fontSize: 12, color: 'var(--red)', borderColor: 'rgba(239,68,68,0.15)', width: '100%' }}
        >
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}

// ─── Version History Modal ────────────────────────────────────────────────────

function VersionHistoryModal({ docId, docName, onClose }: { docId: number; docName: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocVersions(docId).then(setData).catch(() => toast.error(t('documentsExtra.versionsLoadError'))).finally(() => setLoading(false));
  }, [docId]);

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title={t('documentsExtra.versionsModalTitle', { name: cleanDocName(docName) })} onClose={onClose} />
      <div style={{ padding: '12px 16px', overflowY: 'auto', maxHeight: 420 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-2)', fontSize: 13 }}>{t('documentsExtra.versionsLoading')}</div>
        ) : !data ? null : (
          <>
            <div style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'rgba(34,197,94,0.12)', borderRadius: 10, padding: '2px 8px' }}>{t('documentsExtra.versionsCurrent', { n: data.current_version })}</span>
              <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1 }}>{t('documentsExtra.versionsActive')}</span>
            </div>
            {data.versions.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>{t('documentsExtra.versionsNone')}</div>
            ) : data.versions.map((v: any) => (
              <div key={v.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', background: 'var(--surface-2)', borderRadius: 10, padding: '2px 8px' }}>v{v.version}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>{formatSize(v.file_size)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{v.created_at ? new Date(v.created_at).toLocaleString(locale) : '—'}</div>
                </div>
                {v.download_url && (
                  <a href={v.download_url} download style={{ fontSize: 11, color: '#60A5FA', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 6 }}>↓ {t('documentsExtra.versionsDownload')}</a>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </ModalOverlay>
  );
}

// ─── Share Folder Modal ───────────────────────────────────────────────────────

interface ShareItem { id: number; token: string; label: string | null; can_read: boolean; can_upload: boolean; can_delete: boolean; expires_at: string | null; creator_name: string | null; created_at: string; }

function ShareFolderModal({ folder, onClose }: { folder: FolderItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ label: '', can_read: true, can_upload: false, can_delete: false, expires_at: '' });
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setShares(await listShares(folder.id)); } catch { toast.error(t('documentsExtra.shareLoadError')); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [folder.id]);

  async function handleCreate() {
    setCreating(true);
    try {
      const body: any = { label: form.label || null, can_read: form.can_read, can_upload: form.can_upload, can_delete: form.can_delete };
      if (form.expires_at) body.expires_at = new Date(form.expires_at).toISOString();
      await createShare(folder.id, body);
      setForm({ label: '', can_read: true, can_upload: false, can_delete: false, expires_at: '' });
      await load();
      toast.success(t('documentsExtra.shareCreateOk'));
    } catch { toast.error(t('documentsExtra.shareCreateError')); } finally { setCreating(false); }
  }

  async function handleRevoke(token: string) {
    if (!confirm(t('documentsExtra.shareRevokeConfirm'))) return;
    try { await revokeShare(token); await load(); toast.success(t('documentsExtra.shareRevokeOk')); } catch { toast.error(t('documentsExtra.shareRevokeError')); }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(token); setTimeout(() => setCopied(null), 2000); });
  }

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 };
  const permKeys: [keyof typeof form, string][] = [
    ['can_read', t('documentsExtra.shareRead')],
    ['can_upload', t('documentsExtra.shareUpload')],
    ['can_delete', t('documentsExtra.shareDeletePerm')],
  ];

  return (
    <ModalOverlay onClose={onClose} width={520}>
      <ModalHeader title={t('documentsExtra.shareModalTitle', { name: folder.name })} onClose={onClose} />
      <div style={{ padding: '14px 18px', overflowY: 'auto', maxHeight: '70vh' }}>

        {/* Create new share */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('documentsExtra.shareNewLink')}</div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>{t('documentsExtra.shareLabel')}</label>
            <input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder={t('documentsExtra.shareLabelPlaceholder')} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>{t('documentsExtra.sharePermissions')}</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {permKeys.map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>
                  <input type="checkbox" checked={form[key] as boolean} onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>{t('documentsExtra.shareExpiry')}</label>
            <input type="datetime-local" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <button onClick={handleCreate} disabled={creating || !form.can_read} className="btn-primary" style={{ width: '100%', opacity: creating ? 0.6 : 1 }}>
            {creating ? t('documentsExtra.shareCreating') : t('documentsExtra.shareCreate')}
          </button>
        </div>

        {/* Existing shares */}
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('documentsExtra.shareActive', { count: shares.length })}
        </div>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '12px 0' }}>{t('documentsExtra.shareLoading')}</div>
        ) : shares.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '12px 0' }}>{t('documentsExtra.shareNone')}</div>
        ) : shares.map(s => {
          const isExpired = s.expires_at && new Date(s.expires_at) < new Date();
          const url = `${window.location.origin}/share/${s.token}`;
          return (
            <div key={s.token} style={{ border: `1px solid ${isExpired ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: isExpired ? 'rgba(239,68,68,0.04)' : 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: isExpired ? 'var(--red)' : 'var(--text)', marginBottom: 3 }}>
                    {s.label || t('documentsExtra.shareNewLink')}
                    {isExpired && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--red)' }}>{t('documentsExtra.shareExpired')}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                    {s.can_read   && <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.1)', color: '#15803d', borderRadius: 8, padding: '1px 6px' }}>{t('documentsExtra.shareRead')}</span>}
                    {s.can_upload && <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.1)', color: '#1d4ed8', borderRadius: 8, padding: '1px 6px' }}>{t('documentsExtra.shareUpload')}</span>}
                    {s.can_delete && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.1)', color: '#b91c1c', borderRadius: 8, padding: '1px 6px' }}>{t('documentsExtra.shareDeletePerm')}</span>}
                    {s.expires_at && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('documentsExtra.shareExp')} {new Date(s.expires_at).toLocaleDateString(locale)}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button onClick={() => copyLink(s.token)} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11, color: copied === s.token ? 'var(--green)' : 'var(--text-2)' }}>
                    {copied === s.token ? `✓ ${t('documentsExtra.shareCopied')}` : `⎘ ${t('documentsExtra.shareCopy')}`}
                  </button>
                  <button onClick={() => handleRevoke(s.token)} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11, color: 'var(--red)' }}>
                    {t('documentsExtra.shareRevoke')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ModalOverlay>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', color: 'var(--text-2)' }}>
      <div style={{ marginBottom: 14, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 }}>{text}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  );
}


// ─── Pane State ───────────────────────────────────────────────────────────────

interface PaneState {
  folderId: number | null;
  path: FolderItem[];
  docs: Document[];
  loading: boolean;
  sortCol: 'name' | 'date' | 'size' | 'type';
  sortDir: 'asc' | 'desc';
  selected: Document | null;
}

const EMPTY_PANE: PaneState = {
  folderId: null, path: [], docs: [], loading: false,
  sortCol: 'name', sortDir: 'asc', selected: null,
};

interface DragState {
  type: 'doc' | 'folder';
  id: number;
  paneId: 1 | 2;
  isCopy?: boolean;
}

// ─── File List Row ─────────────────────────────────────────────────────────────

function FileListRow({
  id, name, contentType, fileSize, date, isFolder, isSelected, isDropTarget, isDragging,
  docCount, onClick, onDblClick, onContextMenu, onDragStart, onDragOver, onDragLeave, onDrop,
}: {
  id: number; name: string; contentType: string; fileSize: number; date: string;
  isFolder: boolean; isSelected: boolean; isDropTarget: boolean; isDragging: boolean;
  docCount?: number;
  onClick: () => void;
  onDblClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const locale = 'de-DE';
  const dateStr = date ? new Date(date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const timeStr = date ? new Date(date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      onDoubleClick={onDblClick}
      onContextMenu={onContextMenu}
      style={{
        display: 'grid',
        gridTemplateColumns: '26px 1fr 130px 80px 50px',
        alignItems: 'center',
        height: 34,
        padding: '0 10px 0 6px',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        cursor: 'pointer',
        userSelect: 'none',
        opacity: isDragging ? 0.4 : 1,
        background: isDropTarget
          ? 'rgba(34,197,94,0.12)'
          : isSelected
          ? 'rgba(34,197,94,0.07)'
          : 'transparent',
        borderLeft: isDropTarget
          ? '2px solid #22C55E'
          : isSelected
          ? '2px solid rgba(34,197,94,0.5)'
          : '2px solid transparent',
        transition: 'background 0.08s',
      }}
    >
      {/* Icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isFolder ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(251,191,36,0.35)" stroke="#FBbf24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
        ) : (
          <FileTypeBadge contentType={contentType} size={20} />
        )}
      </div>

      {/* Name */}
      <div style={{
        fontSize: 12.5, fontWeight: isFolder ? 600 : 400,
        color: isSelected ? '#22C55E' : 'var(--text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        paddingRight: 10,
      }}>
        {cleanDocName(name)}
      </div>

      {/* Date */}
      <div style={{ fontSize: 11, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
        {dateStr}{timeStr ? <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>{timeStr}</span> : null}
      </div>

      {/* Size */}
      <div style={{ fontSize: 11, color: 'var(--text-2)', textAlign: 'right', paddingRight: 8 }}>
        {isFolder
          ? (docCount !== undefined && docCount > 0 ? `${docCount} fișiere` : '—')
          : formatSize(fileSize)}
      </div>

      {/* Type */}
      <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right' }}>
        {isFolder ? 'Folder' : contentType.split('/').pop()?.toUpperCase().slice(0, 6) || '—'}
      </div>
    </div>
  );
}

// ─── File List Pane ───────────────────────────────────────────────────────────

function FileListPane({
  paneState, paneId, isActive, allFolders, search,
  dragState, dropTargetKey,
  onActivate, onNavigate,
  onDocSelect, onDocDblClick, onDocContextMenu,
  onFolderContextMenu,
  onDragStart, onDragOver, onDragLeave, onDrop,
  onSortChange,
  onPaneDropTarget,
}: {
  paneState: PaneState;
  paneId: 1 | 2;
  isActive: boolean;
  allFolders: FolderItem[];
  search: string;
  dragState: DragState | null;
  dropTargetKey: string | null;
  onActivate: () => void;
  onNavigate: (folder: FolderItem | null) => void;
  onDocSelect: (doc: Document) => void;
  onDocDblClick: (doc: Document) => void;
  onDocContextMenu: (e: React.MouseEvent, doc: Document) => void;
  onFolderContextMenu: (e: React.MouseEvent, folder: FolderItem) => void;
  onDragStart: (e: React.DragEvent, type: 'doc' | 'folder', id: number) => void;
  onDragOver: (e: React.DragEvent, key: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetFolderId: number | null) => void;
  onSortChange: (col: PaneState['sortCol']) => void;
  onPaneDropTarget: (e: React.DragEvent) => void;
}) {
  const subFolders = allFolders.filter(f => f.parent_id === paneState.folderId);

  // Sort
  const sortedFolders = [...subFolders].sort((a, b) => {
    if (paneState.sortCol === 'name') {
      const cmp = a.name.localeCompare(b.name);
      return paneState.sortDir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });

  const filteredDocs = paneState.docs.filter(d =>
    !search || cleanDocName(d.name).toLowerCase().includes(search.toLowerCase())
  );

  const sortedDocs = [...filteredDocs].sort((a, b) => {
    let cmp = 0;
    if (paneState.sortCol === 'name') cmp = cleanDocName(a.name).localeCompare(cleanDocName(b.name));
    else if (paneState.sortCol === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    else if (paneState.sortCol === 'size') cmp = a.file_size - b.file_size;
    else if (paneState.sortCol === 'type') cmp = a.content_type.localeCompare(b.content_type);
    return paneState.sortDir === 'asc' ? cmp : -cmp;
  });

  const paneDrop = dropTargetKey === `pane-${paneId}`;

  function SortHeader({ col, label, width }: { col: PaneState['sortCol']; label: string; width: string }) {
    const active = paneState.sortCol === col;
    return (
      <div
        onClick={() => onSortChange(col)}
        style={{
          width, fontSize: 10, fontWeight: 700, color: active ? '#22C55E' : 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 3, userSelect: 'none',
          paddingRight: col !== 'name' ? 8 : 0,
          justifyContent: col === 'name' ? 'flex-start' : 'flex-end',
        }}
      >
        {label}
        {active && <span style={{ fontSize: 9 }}>{paneState.sortDir === 'asc' ? '↑' : '↓'}</span>}
      </div>
    );
  }

  return (
    <div
      onClick={onActivate}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        background: 'var(--surface)',
        border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: isActive ? '0 0 0 1px rgba(34,197,94,0.15)' : 'none',
      }}
    >
      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <button
          onClick={e => { e.stopPropagation(); onNavigate(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-2)', padding: '2px 4px', borderRadius: 4 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </button>
        {paneState.path.map((f, i) => (
          <span key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>›</span>
            <button
              onClick={e => { e.stopPropagation(); onNavigate(f); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: '2px 4px', borderRadius: 4,
                color: i === paneState.path.length - 1 ? 'var(--green)' : 'var(--text-2)',
                fontWeight: i === paneState.path.length - 1 ? 700 : 400,
              }}
            >
              {f.name}
            </button>
          </span>
        ))}
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: '26px 1fr 130px 80px 50px',
        alignItems: 'center', height: 28, padding: '0 10px 0 6px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)', flexShrink: 0,
      }}>
        <div />
        <SortHeader col="name" label="Nume" width="100%" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SortHeader col="date" label="Dată" width="130px" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SortHeader col="size" label="Mărime" width="80px" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SortHeader col="type" label="Tip" width="50px" />
        </div>
      </div>

      {/* List content */}
      <div
        style={{ flex: 1, overflowY: 'auto', background: paneDrop ? 'rgba(34,197,94,0.04)' : 'transparent' }}
        onDragOver={e => { e.preventDefault(); onPaneDropTarget(e); }}
        onDragLeave={onDragLeave}
        onDrop={e => onDrop(e, paneState.folderId)}
      >
        {paneState.loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: 'var(--text-2)', fontSize: 12 }}>
            Încărcare...
          </div>
        ) : sortedFolders.length === 0 && sortedDocs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: 'var(--text-3)', fontSize: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10, opacity: 0.4 }}>
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            Folder gol
          </div>
        ) : (
          <>
            {sortedFolders.map(folder => (
              <FileListRow
                key={`folder-${folder.id}`}
                id={folder.id}
                name={folder.name}
                contentType="folder"
                fileSize={0}
                date={folder.created_at}
                isFolder
                docCount={folder.doc_count}
                isSelected={false}
                isDropTarget={dropTargetKey === `folder-${folder.id}`}
                isDragging={dragState?.type === 'folder' && dragState.id === folder.id}
                onClick={() => {}}
                onDblClick={() => onNavigate(folder)}
                onContextMenu={e => onFolderContextMenu(e, folder)}
                onDragStart={e => onDragStart(e, 'folder', folder.id)}
                onDragOver={e => onDragOver(e, `folder-${folder.id}`)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, folder.id)}
              />
            ))}
            {sortedDocs.map(doc => (
              <FileListRow
                key={`doc-${doc.id}`}
                id={doc.id}
                name={doc.name}
                contentType={doc.content_type}
                fileSize={doc.file_size}
                date={doc.created_at}
                isFolder={false}
                isSelected={paneState.selected?.id === doc.id}
                isDropTarget={false}
                isDragging={dragState?.type === 'doc' && dragState.id === doc.id}
                onClick={() => onDocSelect(doc)}
                onDblClick={() => onDocDblClick(doc)}
                onContextMenu={e => onDocContextMenu(e, doc)}
                onDragStart={e => onDragStart(e, 'doc', doc.id)}
                onDragOver={e => e.preventDefault()}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, paneState.folderId)}
              />
            ))}
          </>
        )}
      </div>

      {/* Status bar */}
      <div style={{
        padding: '4px 10px', borderTop: '1px solid var(--border)',
        fontSize: 10, color: 'var(--text-3)', display: 'flex', gap: 10, flexShrink: 0,
        background: 'var(--surface-2)',
      }}>
        <span>{sortedFolders.length} foldere</span>
        <span>·</span>
        <span>{sortedDocs.length} fișiere</span>
        {sortedDocs.length > 0 && (
          <>
            <span>·</span>
            <span>{formatSize(sortedDocs.reduce((s, d) => s + d.file_size, 0))}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Folder Upload Modal ───────────────────────────────────────────────────────

function FolderUploadModal({ parentFolderId, allFolders, onDone, onClose }: {
  parentFolderId: number | null;
  allFolders: FolderItem[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const cancelRef = useRef(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) setFiles(e.target.files);
  }

  async function startUpload() {
    if (!files || files.length === 0) return;
    cancelRef.current = false;
    setStatus('running');
    setDone(0);

    // Parse paths
    const allPaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const rel = (files[i] as any).webkitRelativePath as string;
      const parts = rel.split('/');
      for (let j = 1; j < parts.length; j++) {
        const p = parts.slice(0, j).join('/');
        if (!allPaths.includes(p)) allPaths.push(p);
      }
    }
    // Sort by depth
    allPaths.sort((a, b) => a.split('/').length - b.split('/').length);

    const pathToId = new Map<string, number>();
    setTotal(allPaths.length + files.length);

    // Step 1: Create folders
    for (const path of allPaths) {
      if (cancelRef.current) break;
      const parts = path.split('/');
      const folderName = parts[parts.length - 1];
      const parentPath = parts.slice(0, parts.length - 1).join('/');
      const parentId = parentPath === '' ? parentFolderId : (pathToId.get(parentPath) ?? null);
      setMessage(`Creare folder: ${path}`);
      try {
        const folder = await createFolder({ name: folderName, parent_id: parentId ?? undefined });
        pathToId.set(path, folder.id);
      } catch {
        // Folder may already exist — try to find it in allFolders
        const existing = allFolders.find(f => f.name === folderName && f.parent_id === parentId);
        if (existing) pathToId.set(path, existing.id);
      }
      setDone(d => d + 1);
      setProgress(prev => prev + (40 / allPaths.length));
    }

    // Step 2: Upload files
    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) break;
      const file = files[i];
      const rel = (file as any).webkitRelativePath as string;
      const parts = rel.split('/');
      const dirPath = parts.slice(0, parts.length - 1).join('/');
      const folderId = pathToId.get(dirPath) ?? parentFolderId;

      setMessage(`Upload: ${file.name} (${formatSize(file.size)})`);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', 'other');
        if (folderId != null) fd.append('folder_id', String(folderId));
        await uploadDocument(fd);
      } catch {
        // Continue on individual file errors
      }
      setDone(d => d + 1);
      setProgress(40 + ((i + 1) / files.length) * 60);
    }

    if (!cancelRef.current) {
      setStatus('done');
      setMessage('Gata! Toate fișierele au fost încărcate.');
    }
  }

  const fileCount = files ? files.length : 0;
  const folderName = files && files.length > 0 ? (files[0] as any).webkitRelativePath?.split('/')[0] : '';

  return (
    <ModalOverlay onClose={onClose} width={480}>
      <ModalHeader title="Upload folder întreg" onClose={onClose} />
      <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {status === 'idle' && (
          <>
            <div
              onClick={() => folderInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border)', borderRadius: 10, padding: '32px 20px',
                textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)',
              }}
            >
              <input
                ref={folderInputRef}
                type="file"
                style={{ display: 'none' }}
                // @ts-ignore
                webkitdirectory=""
                multiple
                onChange={handleFileChange}
              />
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}>
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
              {fileCount > 0 ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>📁 {folderName}</div>
                  <div style={{ fontSize: 12, color: 'var(--green)' }}>{fileCount} fișiere selectate</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Click pentru a selecta un folder</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Structura de subfoldere va fi recreată automat · Max 2 GB per fișier</div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={startUpload}
                disabled={fileCount === 0}
                className="btn-primary"
                style={{ flex: 1, opacity: fileCount === 0 ? 0.5 : 1 }}
              >
                ↑ Încarcă {fileCount > 0 ? `(${fileCount} fișiere)` : ''}
              </button>
              <button onClick={onClose} className="btn-ghost">Anulează</button>
            </div>
          </>
        )}

        {status === 'running' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{message}</div>
            <div style={{ background: 'var(--surface-3)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#22C55E', width: `${Math.min(progress, 100)}%`, transition: 'width 0.3s', borderRadius: 6 }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{done} / {total} procesate</div>
            <button onClick={() => { cancelRef.current = true; onClose(); }} className="btn-ghost" style={{ color: 'var(--red)' }}>
              Anulează
            </button>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{message}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{fileCount} fișiere uploadate</div>
            </div>
            <button onClick={() => { onDone(); onClose(); }} className="btn-primary">Închide</button>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}

// ─── Delete Folder Confirm Modal ───────────────────────────────────────────────

function DeleteFolderConfirmModal({ folder, onConfirm, onClose }: {
  folder: FolderItem;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<{ folder_count: number; file_count: number; total_size: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getFolderStats(folder.id)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [folder.id]);

  async function handleConfirm() {
    setDeleting(true);
    try { await onConfirm(); } finally { setDeleting(false); }
  }

  return (
    <ModalOverlay onClose={onClose} width={420}>
      <ModalHeader title="Șterge folder recursiv" onClose={onClose} />
      <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>⚠ Acțiune ireversibilă</div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            Vei șterge folderul <strong>"{folder.name}"</strong> și tot conținutul său:
          </div>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>Calculare...</div>
          ) : stats ? (
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, display: 'flex', gap: 12 }}>
              <span>{stats.folder_count} subfoldere</span>
              <span>·</span>
              <span>{stats.file_count} fișiere</span>
              <span>·</span>
              <span>{formatSize(stats.total_size)}</span>
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleConfirm}
            disabled={deleting || loading}
            style={{
              flex: 1, padding: '8px 16px', border: 'none', borderRadius: 7,
              background: 'var(--red)', color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? 'Ștergere...' : 'Șterge definitiv'}
          </button>
          <button onClick={onClose} className="btn-ghost" disabled={deleting}>Anulează</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenuPopup({ x, y, items, onClose }: {
  x: number; y: number;
  items: { label: string; icon?: string; color?: string; onClick: () => void }[];
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('click', handler);
    document.addEventListener('contextmenu', handler);
    return () => { document.removeEventListener('click', handler); document.removeEventListener('contextmenu', handler); };
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', left: x, top: y, zIndex: 9999,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      padding: '4px 0',
      minWidth: 180,
    }}>
      {items.map((item, i) => (
        <div
          key={i}
          onClick={e => { e.stopPropagation(); item.onClick(); onClose(); }}
          style={{
            padding: '8px 14px', fontSize: 12.5, cursor: 'pointer',
            color: item.color || 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {item.icon && <span style={{ fontSize: 13 }}>{item.icon}</span>}
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  useDocPageStyles();
  const { t } = useTranslation();

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<DocCategory[]>(DEFAULT_CATEGORIES);

  // ── Pane state ───────────────────────────────────────────────────────────────
  const [pane1, setPane1] = useState<PaneState>(EMPTY_PANE);
  const [pane2, setPane2] = useState<PaneState>(EMPTY_PANE);
  const [activePaneId, setActivePaneId] = useState<1 | 2>(1);

  // ── UI flags ─────────────────────────────────────────────────────────────────
  const [dualPane, setDualPane] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [detailDoc, setDetailDoc] = useState<Document | null>(null);
  const [search, setSearch] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [showUpload, setShowUpload] = useState<1 | 2 | null>(null);
  const [showFolderUpload, setShowFolderUpload] = useState<1 | 2 | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [movingDoc, setMovingDoc] = useState<Document | null>(null);
  const [movingFolder, setMovingFolder] = useState<FolderItem | null>(null);
  const [sharingFolder, setSharingFolder] = useState<FolderItem | null>(null);
  const [versionsDoc, setVersionsDoc] = useState<{ id: number; name: string } | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<FolderItem | null>(null);
  const [viewingDocId, setViewingDocId] = useState<number | null>(null);
  const [editingDoc, setEditingDoc] = useState<{ id: number; name: string } | null>(null);
  const [officeDoc, setOfficeDoc] = useState<{ id: number; name: string } | null>(null);

  // ── Context menu ─────────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: any[] } | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const catMap = Object.fromEntries(categories.map(c => [c.key, c]));

  function buildPath(folder: FolderItem | null): FolderItem[] {
    if (!folder) return [];
    const path: FolderItem[] = [];
    let cur: FolderItem | undefined = folder;
    while (cur) {
      path.unshift(cur);
      cur = cur.parent_id ? allFolders.find(f => f.id === cur!.parent_id) : undefined;
    }
    return path;
  }

  function getPane(id: 1 | 2) { return id === 1 ? pane1 : pane2; }
  function setPane(id: 1 | 2, updater: (p: PaneState) => PaneState) {
    if (id === 1) setPane1(updater); else setPane2(updater);
  }

  // ── Data loading ─────────────────────────────────────────────────────────────
  async function loadPaneDocs(paneId: 1 | 2, folderId: number | null) {
    setPane(paneId, p => ({ ...p, loading: true }));
    try {
      const params: Record<string, any> = { limit: 500 };
      if (folderId !== null) params.folder_id = folderId;
      else params.folder_id = 'null';  // root docs
      const res = await fetchDocuments(folderId !== null ? params : { limit: 500, folder_id: folderId as any });
      setPane(paneId, p => ({ ...p, docs: res.items, loading: false }));
    } catch {
      setPane(paneId, p => ({ ...p, loading: false }));
    }
  }

  async function reloadFolders() {
    const data = await fetchFolders();
    setAllFolders(flattenFolders(data));
  }

  useEffect(() => {
    fetchSites().then(setSites);
    fetchDocumentCategories().then(setCategories).catch(() => {});
    reloadFolders();
    // Load root docs in pane1 by default
    loadPaneDocs(1, null);
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────────
  async function navigateTo(paneId: 1 | 2, folder: FolderItem | null) {
    const path = buildPath(folder);
    setPane(paneId, p => ({ ...p, folderId: folder?.id ?? null, path, loading: true, docs: [], selected: null }));
    try {
      const params: Record<string, any> = { limit: 500 };
      if (folder !== null) params.folder_id = folder.id;
      const res = await fetchDocuments(params);
      setPane(paneId, p => ({ ...p, docs: res.items, loading: false }));
    } catch {
      setPane(paneId, p => ({ ...p, loading: false }));
    }
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, type: 'doc' | 'folder', id: number, paneId: 1 | 2) {
    const isCopy = (e.ctrlKey || e.altKey) && type === 'doc';
    e.dataTransfer.effectAllowed = isCopy ? 'copy' : 'move';
    setDragState({ type, id, paneId, isCopy });
  }

  function handleDragOver(e: React.DragEvent, key: string) {
    e.preventDefault();
    const isCopy = e.ctrlKey || e.altKey;
    e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';
    setDropTargetKey(key);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if leaving to outside
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTargetKey(null);
    }
  }

  async function handleDrop(e: React.DragEvent, targetFolderId: number | null) {
    e.preventDefault();
    if (!dragState) return;
    const sourcePaneId = dragState.paneId;
    const targetPaneId = dropTargetKey?.startsWith('pane-') ? (parseInt(dropTargetKey.split('-')[1]) as 1 | 2) : sourcePaneId;
    setDropTargetKey(null);

    try {
      if (dragState.type === 'doc') {
        if (dragState.isCopy || e.ctrlKey || e.altKey) {
          await copyDocument(dragState.id, targetFolderId);
          toast.success('Document copiat');
          // Refresh only target pane (source unchanged)
          await navigateTo(targetPaneId, getPane(targetPaneId).folderId !== null ? allFolders.find(f => f.id === getPane(targetPaneId).folderId) ?? null : null);
        } else {
          await moveDocument(dragState.id, targetFolderId);
          toast.success('Document mutat');
          await navigateTo(sourcePaneId, getPane(sourcePaneId).folderId !== null ? allFolders.find(f => f.id === getPane(sourcePaneId).folderId) ?? null : null);
          if (targetPaneId !== sourcePaneId) {
            await navigateTo(targetPaneId, getPane(targetPaneId).folderId !== null ? allFolders.find(f => f.id === getPane(targetPaneId).folderId) ?? null : null);
          }
        }
      } else {
        await renameFolder(dragState.id, targetFolderId === null ? { clear_parent: true } : { parent_id: targetFolderId });
        toast.success('Folder mutat');
        await reloadFolders();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    }
    setDragState(null);
  }

  // ── Document actions ─────────────────────────────────────────────────────────
  async function handleDocDelete(doc: Document, paneId: 1 | 2) {
    if (!confirm(t('documents.confirmDelete', { name: doc.name }))) return;
    try {
      await deleteDocument(doc.id);
      toast.success(t('documents.deletedOk'));
      const pane = getPane(paneId);
      setPane(paneId, p => ({ ...p, docs: p.docs.filter(d => d.id !== doc.id), selected: p.selected?.id === doc.id ? null : p.selected }));
      if (detailDoc?.id === doc.id) { setDetailDoc(null); setShowDetail(false); }
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
  }

  async function handleMoveDoc(targetFolderId: number | null) {
    if (!movingDoc) return;
    try {
      await moveDocument(movingDoc.id, targetFolderId);
      toast.success(t('documentsExtra.docMoved'));
      setMovingDoc(null);
      // Reload both panes
      await navigateTo(1, allFolders.find(f => f.id === pane1.folderId) ?? null);
      await navigateTo(2, allFolders.find(f => f.id === pane2.folderId) ?? null);
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('documentsExtra.docMoveError')); }
  }

  async function handleMoveFolder(targetParentId: number | null) {
    if (!movingFolder) return;
    try {
      await renameFolder(movingFolder.id, targetParentId === null ? { clear_parent: true } : { parent_id: targetParentId });
      toast.success(t('documentsExtra.folderRenamed'));
      setMovingFolder(null);
      await reloadFolders();
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('documentsExtra.folderMoveError')); }
  }

  async function handleDeleteFolderRecursive(folder: FolderItem) {
    try {
      const result = await deleteFolderRecursive(folder.id);
      toast.success(`Șters: ${result.deleted_folders} foldere, ${result.deleted_files} fișiere`);
      setDeleteFolderTarget(null);
      await reloadFolders();
      // If active pane was in this folder, navigate to root
      if (pane1.folderId === folder.id) await navigateTo(1, null);
      if (pane2.folderId === folder.id) await navigateTo(2, null);
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
  }

  function openDocContextMenu(e: React.MouseEvent, doc: Document, paneId: 1 | 2) {
    e.preventDefault();
    const canEdit = doc.content_type.startsWith('text/');
    const canOffice = OFFICE_TYPES.has(doc.content_type);
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Previzualizare', icon: '👁', onClick: () => setViewingDocId(doc.id) },
        { label: 'Descarcă', icon: '↓', onClick: () => { window.open(`/api/documents/${doc.id}/download/`, '_blank'); } },
        ...(canEdit ? [{ label: 'Editează text', icon: '✏', onClick: () => setEditingDoc({ id: doc.id, name: doc.name }) }] : []),
        ...(canOffice ? [{ label: 'Deschide Office', icon: '📝', onClick: () => setOfficeDoc({ id: doc.id, name: doc.name }) }] : []),
        { label: 'Mută', icon: '↗', onClick: () => setMovingDoc(doc) },
        {
          label: 'Copiază în celălalt pane', icon: '⎘',
          onClick: async () => {
            const otherPaneId: 1 | 2 = paneId === 1 ? 2 : 1;
            const targetFolderId = getPane(otherPaneId).folderId;
            try {
              await copyDocument(doc.id, targetFolderId);
              toast.success('Document copiat');
              await navigateTo(otherPaneId, allFolders.find(f => f.id === targetFolderId) ?? null);
            } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
          },
        },
        { label: 'Versiuni', icon: '🕐', onClick: () => setVersionsDoc({ id: doc.id, name: doc.name }) },
        { label: 'Detalii', icon: 'ⓘ', onClick: () => { setDetailDoc(doc); setShowDetail(true); } },
        { label: 'Șterge', icon: '✕', color: 'var(--red)', onClick: () => handleDocDelete(doc, paneId) },
      ],
    });
  }

  function openFolderContextMenu(e: React.MouseEvent, folder: FolderItem) {
    e.preventDefault();
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Deschide', icon: '📂', onClick: () => navigateTo(activePaneId, folder) },
        { label: 'Mută', icon: '↗', onClick: () => setMovingFolder(folder) },
        { label: 'Partajează', icon: '⇧', onClick: () => setSharingFolder(folder) },
        { label: 'Șterge recursiv', icon: '✕', color: 'var(--red)', onClick: () => setDeleteFolderTarget(folder) },
      ],
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const activePane = activePaneId === 1 ? pane1 : pane2;
  const activeFolderInPane = allFolders.find(f => f.id === activePane.folderId) ?? null;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Modals ── */}
      {showUpload !== null && (
        <ModalOverlay onClose={() => setShowUpload(null)} width={560}>
          <ModalHeader title={t('documents.uploadTitle')} onClose={() => setShowUpload(null)} />
          <div style={{ padding: '16px 20px 20px' }}>
            <UploadForm
              sites={sites}
              folders={allFolders}
              categories={categories}
              onUploaded={async doc => {
                toast.success(t('documents.uploadedOk'));
                setShowUpload(null);
                const pid = showUpload as 1 | 2;
                await navigateTo(pid, allFolders.find(f => f.id === getPane(pid).folderId) ?? null);
              }}
              onCancel={() => setShowUpload(null)}
            />
          </div>
        </ModalOverlay>
      )}

      {showFolderUpload !== null && (
        <FolderUploadModal
          parentFolderId={getPane(showFolderUpload).folderId}
          allFolders={allFolders}
          onDone={async () => {
            const pid = showFolderUpload as 1 | 2;
            await reloadFolders();
            await navigateTo(pid, allFolders.find(f => f.id === getPane(pid).folderId) ?? null);
          }}
          onClose={() => setShowFolderUpload(null)}
        />
      )}

      {showCreateFolder && (
        <CreateFolderModal
          sites={sites}
          onCreated={async folder => {
            setShowCreateFolder(false);
            await reloadFolders();
          }}
          onClose={() => setShowCreateFolder(false)}
        />
      )}

      {movingDoc && (
        <MovePicker
          folders={allFolders}
          currentFolderId={movingDoc.folder_id ?? null}
          title={t('documentsExtra.moveDocTitle', { name: cleanDocName(movingDoc.name) })}
          onConfirm={handleMoveDoc}
          onClose={() => setMovingDoc(null)}
        />
      )}

      {movingFolder && (
        <MovePicker
          folders={allFolders}
          currentFolderId={movingFolder.parent_id}
          excludeFolderId={movingFolder.id}
          title={t('documentsExtra.moveFolderTitle', { name: movingFolder.name })}
          onConfirm={handleMoveFolder}
          onClose={() => setMovingFolder(null)}
        />
      )}

      {sharingFolder && (
        <ShareFolderModal folder={sharingFolder} onClose={() => setSharingFolder(null)} />
      )}

      {versionsDoc && (
        <VersionHistoryModal docId={versionsDoc.id} docName={versionsDoc.name} onClose={() => setVersionsDoc(null)} />
      )}

      {deleteFolderTarget && (
        <DeleteFolderConfirmModal
          folder={deleteFolderTarget}
          onConfirm={() => handleDeleteFolderRecursive(deleteFolderTarget)}
          onClose={() => setDeleteFolderTarget(null)}
        />
      )}

      {viewingDocId && (
        <DocumentViewerModal docId={viewingDocId} onClose={() => setViewingDocId(null)} />
      )}

      {editingDoc && (
        <TextEditorModal
          docId={editingDoc.id}
          docName={editingDoc.name}
          onClose={() => { setEditingDoc(null); navigateTo(activePaneId, activeFolderInPane); }}
        />
      )}

      {officeDoc && (
        <OnlyOfficeEditor
          docId={officeDoc.id}
          docName={officeDoc.name}
          onClose={() => setOfficeDoc(null)}
        />
      )}

      {ctxMenu && (
        <ContextMenuPopup x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />
      )}

      {/* ── Toolbar ── */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginRight: 4 }}>
          Documente
        </span>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth={2} strokeLinecap="round" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="dp-search"
            placeholder="Caută fișiere..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
              searchDebounceRef.current = setTimeout(() => setSearch(e.target.value), 200);
            }}
            style={{ paddingLeft: 30, paddingRight: 10, width: '100%', height: 32, fontSize: 12.5 }}
          />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* New folder */}
          <button onClick={() => setShowCreateFolder(true)} className="btn-ghost" style={{ height: 32, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
            Folder nou
          </button>

          {/* Upload folder */}
          <button onClick={() => setShowFolderUpload(activePaneId)} className="btn-ghost" style={{ height: 32, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              <polyline points="16 8 12 4 8 8"/><line x1="12" y1="4" x2="12" y2="14"/>
            </svg>
            ↑ Folder
          </button>

          {/* Upload file */}
          <button onClick={() => setShowUpload(activePaneId)} className="btn-primary" style={{ height: 32, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
            </svg>
            ↑ Fișier
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          {/* Toggle dual pane */}
          <button
            onClick={() => setDualPane(p => !p)}
            title={dualPane ? 'Pane unic' : 'Dual pane'}
            style={{
              width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)',
              background: dualPane ? 'rgba(34,197,94,0.1)' : 'var(--surface)',
              color: dualPane ? 'var(--green)' : 'var(--text-2)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <rect x="3" y="3" width="8" height="18" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/>
            </svg>
          </button>

          {/* Toggle detail */}
          <button
            onClick={() => setShowDetail(p => !p)}
            title="Detalii"
            style={{
              width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)',
              background: showDetail ? 'rgba(34,197,94,0.1)' : 'var(--surface)',
              color: showDetail ? 'var(--green)' : 'var(--text-2)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>

        {/* ── Folder sidebar ── */}
        <div style={{ flexShrink: 0, padding: '12px 0 12px 12px' }}>
          <FolderSidebar
            folders={allFolders}
            sites={sites}
            selectedFolder={activeFolderInPane}
            onSelect={folder => navigateTo(activePaneId, folder)}
            onNewFolder={() => setShowCreateFolder(true)}
            onFolderRenamed={async updated => {
              await reloadFolders();
            }}
            onFolderDeleted={async folderId => {
              await reloadFolders();
              if (pane1.folderId === folderId) navigateTo(1, null);
              if (pane2.folderId === folderId) navigateTo(2, null);
            }}
            onMoveFolder={folder => setMovingFolder(folder)}
            onShare={folder => setSharingFolder(folder)}
          />
        </div>

        {/* ── Panes ── */}
        <div style={{ flex: 1, padding: 12, display: 'flex', gap: 8, overflow: 'hidden', minWidth: 0 }}>
          <FileListPane
            paneState={pane1}
            paneId={1}
            isActive={activePaneId === 1}
            allFolders={allFolders}
            search={search}
            dragState={dragState}
            dropTargetKey={dropTargetKey}
            onActivate={() => setActivePaneId(1)}
            onNavigate={folder => navigateTo(1, folder)}
            onDocSelect={doc => {
              setActivePaneId(1);
              setPane1(p => ({ ...p, selected: doc }));
              if (showDetail) setDetailDoc(doc);
            }}
            onDocDblClick={doc => { setViewingDocId(doc.id); }}
            onDocContextMenu={(e, doc) => openDocContextMenu(e, doc, 1)}
            onFolderContextMenu={(e, folder) => openFolderContextMenu(e, folder)}
            onDragStart={(e, type, id) => handleDragStart(e, type, id, 1)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onSortChange={col => setPane1(p => ({ ...p, sortCol: col, sortDir: p.sortCol === col ? (p.sortDir === 'asc' ? 'desc' : 'asc') : 'asc' }))}
            onPaneDropTarget={e => handleDragOver(e, 'pane-1')}
          />

          {dualPane && (
            <FileListPane
              paneState={pane2}
              paneId={2}
              isActive={activePaneId === 2}
              allFolders={allFolders}
              search={search}
              dragState={dragState}
              dropTargetKey={dropTargetKey}
              onActivate={() => setActivePaneId(2)}
              onNavigate={folder => navigateTo(2, folder)}
              onDocSelect={doc => {
                setActivePaneId(2);
                setPane2(p => ({ ...p, selected: doc }));
                if (showDetail) setDetailDoc(doc);
              }}
              onDocDblClick={doc => { setViewingDocId(doc.id); }}
              onDocContextMenu={(e, doc) => openDocContextMenu(e, doc, 2)}
              onFolderContextMenu={(e, folder) => openFolderContextMenu(e, folder)}
              onDragStart={(e, type, id) => handleDragStart(e, type, id, 2)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onSortChange={col => setPane2(p => ({ ...p, sortCol: col, sortDir: p.sortCol === col ? (p.sortDir === 'asc' ? 'desc' : 'asc') : 'asc' }))}
              onPaneDropTarget={e => handleDragOver(e, 'pane-2')}
            />
          )}

          {/* ── Detail panel ── */}
          {showDetail && detailDoc && (
            <div style={{ width: 280, flexShrink: 0, overflowY: 'auto' }}>
              <DocDetail
                doc={detailDoc}
                catMap={catMap}
                onDelete={() => { handleDocDelete(detailDoc, activePaneId); setDetailDoc(null); setShowDetail(false); }}
                onClose={() => { setShowDetail(false); setDetailDoc(null); }}
                onView={() => setViewingDocId(detailDoc.id)}
                onEdit={() => setEditingDoc({ id: detailDoc.id, name: detailDoc.name })}
                onOfficeEdit={() => setOfficeDoc({ id: detailDoc.id, name: detailDoc.name })}
                onMove={() => setMovingDoc(detailDoc)}
                onMetaUpdated={updated => {
                  setDetailDoc(updated as any);
                  setPane1(p => ({ ...p, docs: p.docs.map(d => d.id === updated.id ? updated as Document : d) }));
                  setPane2(p => ({ ...p, docs: p.docs.map(d => d.id === updated.id ? updated as Document : d) }));
                }}
                onVersions={() => setVersionsDoc({ id: detailDoc.id, name: detailDoc.name })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
