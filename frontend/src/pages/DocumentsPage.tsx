import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { fetchDocuments, uploadDocument, deleteDocument, moveDocument } from '../api/documents';
import { fetchFolders, createFolder, deleteFolder, renameFolder, FolderItem } from '../api/folders';
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
    `;
    document.head.appendChild(el);
    return () => { document.getElementById('docs-page-styles')?.remove(); };
  }, []);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
            Rădăcină (fără folder)
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

function FolderSidebar({ folders, sites, selectedFolder, onSelect, onNewFolder, onFolderRenamed, onFolderDeleted, onMoveFolder }: {
  folders: FolderItem[];
  sites: Site[];
  selectedFolder: FolderItem | null;
  onSelect: (folder: FolderItem | null) => void;
  onNewFolder: () => void;
  onFolderRenamed: (folder: FolderItem) => void;
  onFolderDeleted: (folderId: number) => void;
  onMoveFolder: (folder: FolderItem) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);

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
    if (!confirm(t('documentsExtra.folderDeleteConfirm', { name: folder.name }))) return;
    try {
      await deleteFolder(folder.id);
      toast.success(t('documentsExtra.folderDeleted'));
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
    <div style={{
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
  const [form, setForm] = useState({ category: 'other', description: '', site_id: '', notes: '', folder_id: '' });
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
          {doc.name}
        </div>
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

function DocDetail({ doc, catMap, onDelete, onClose, onView, onEdit, onOfficeEdit, onMove }: {
  doc: Document; catMap: Record<string, DocCategory>; onDelete: () => void; onClose: () => void;
  onView: () => void; onEdit: () => void; onOfficeEdit: () => void; onMove: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const cat = catMap[doc.category] || catMap['other'] || { key: doc.category, label: doc.category, color: '#64748b', icon: '📁' };
  const token = localStorage.getItem('hestios_token');
  const canView = isImage(doc.content_type) || isPDF(doc.content_type);
  const canEdit = doc.content_type.startsWith('text/');
  const canOfficeEdit = OFFICE_TYPES.has(doc.content_type);

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
              {doc.name}
            </div>
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
      </div>

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
              ✏ Editează
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
            ↗ Mută
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  useDocPageStyles();
  const { t } = useTranslation();
  const [docs, setDocs] = useState<Document[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [categories, setCategories] = useState<DocCategory[]>(DEFAULT_CATEGORIES);
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [selected, setSelected] = useState<Document | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [viewingDocId, setViewingDocId] = useState<number | null>(null);
  const [editingDoc, setEditingDoc] = useState<{ id: number; name: string } | null>(null);
  const [officeDoc, setOfficeDoc] = useState<{ id: number; name: string } | null>(null);
  const [movingDoc, setMovingDoc] = useState<Document | null>(null);
  const [movingFolder, setMovingFolder] = useState<FolderItem | null>(null);
  const [filterCat, setFilterCat] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [search, setSearch] = useState('');
  const [docsTotal, setDocsTotal] = useState(0);
  const [docsOffset, setDocsOffset] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const PAGE_SIZE = 100;
  const searchRef = useRef<HTMLInputElement>(null);

  const catMap = Object.fromEntries(categories.map(c => [c.key, c]));
  const hasFilter = !!(filterCat || filterSite || search);

  const loadDocs = (cat = filterCat, site = filterSite, q = search, folderId?: number | null, currentOffset = 0) => {
    const hasF = !!(cat || site || q);
    if (folderId === undefined && !hasF) { setDocs([]); setDocsTotal(0); setDocsOffset(0); return; }
    const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: currentOffset };
    if (cat) params.category = cat;
    if (site) params.site_id = parseInt(site);
    if (q) params.search = q;
    if (folderId !== undefined && folderId !== null) params.folder_id = folderId;
    setDocsLoading(true);
    fetchDocuments(params)
      .then(res => {
        if (currentOffset > 0) setDocs(prev => [...prev, ...res.items]);
        else setDocs(res.items);
        setDocsTotal(res.total);
        setDocsOffset(currentOffset + res.items.length);
      })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setDocsLoading(false));
  };

  useEffect(() => {
    fetchSites().then(setSites);
    fetchFolders().then(data => setFolders(flattenFolders(data)));
    fetchDocumentCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    loadDocs(filterCat, filterSite, search, selectedFolder ? selectedFolder.id : undefined);
  }, [selectedFolder]);

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(t('documents.confirmDelete', { name: selected.name }))) return;
    try {
      await deleteDocument(selected.id);
      toast.success(t('documents.deletedOk'));
      setSelected(null);
      loadDocs(filterCat, filterSite, search, selectedFolder?.id);
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
  }

  function handleFolderRenamed(updated: FolderItem) {
    setFolders(prev => prev.map(f => f.id === updated.id ? updated : f));
    if (selectedFolder?.id === updated.id) setSelectedFolder(updated);
  }

  function handleFolderDeleted(folderId: number) {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    if (selectedFolder?.id === folderId) setSelectedFolder(null);
  }

  async function handleMoveDoc(targetFolderId: number | null) {
    if (!movingDoc) return;
    try {
      await moveDocument(movingDoc.id, targetFolderId);
      toast.success(t('documentsExtra.docMoved'));
      setMovingDoc(null); setSelected(null);
      loadDocs(filterCat, filterSite, search, selectedFolder ? selectedFolder.id : undefined);
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('documentsExtra.docMoveError')); }
  }

  async function handleMoveFolder(targetParentId: number | null) {
    if (!movingFolder) return;
    try {
      const updated = await renameFolder(movingFolder.id, targetParentId === null ? { clear_parent: true } : { parent_id: targetParentId });
      toast.success(t('documentsExtra.folderRenamed'));
      setMovingFolder(null);
      fetchFolders().then(data => setFolders(flattenFolders(data)));
      if (selectedFolder?.id === movingFolder.id) setSelectedFolder(updated);
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('documentsExtra.folderMoveError')); }
  }

  const catCounts = categories.map(c => ({ ...c, count: docs.filter(d => d.category === c.key).length }));
  // always show all categories (count is just informational)
  const subfolders = selectedFolder ? folders.filter(f => f.parent_id === selectedFolder.id) : folders.filter(f => f.parent_id === null);

  function getFolderPath(folder: FolderItem | null): FolderItem[] {
    if (!folder) return [];
    const path: FolderItem[] = [];
    let cur: FolderItem | undefined = folder;
    while (cur) { path.unshift(cur); cur = cur.parent_id ? folders.find(f => f.id === cur!.parent_id) : undefined; }
    return path;
  }
  const breadcrumb = getFolderPath(selectedFolder);

  function doSearch() {
    loadDocs(filterCat, filterSite, search, selectedFolder ? selectedFolder.id : undefined);
  }

  return (
    <div className="page-root" style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0 }}>

      {/* ── Top bar ── */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            {t('documents.title')}
          </h1>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth={2} strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchRef}
              className="dp-search"
              placeholder={t('documents.searchPlaceholder')}
              value={search}
              onChange={e => {
                const val = e.target.value;
                setSearch(val);
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = setTimeout(() => {
                  loadDocs(filterCat, filterSite, val, selectedFolder?.id);
                }, 400);
              }}
              onKeyDown={e => { if (e.key === 'Enter') { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); loadDocs(filterCat, filterSite, search, selectedFolder?.id); } }}
              style={{ paddingLeft: 32, paddingRight: 10, width: 220, height: 34, fontSize: 13 }}
            />
          </div>
          <select
            value={filterSite}
            onChange={e => { const v = e.target.value; setFilterSite(v); if (v) { setSelectedFolder(null); loadDocs(filterCat, v, search, undefined); } else { loadDocs(filterCat, '', search, selectedFolder?.id); } }}
            style={{ height: 34, fontSize: 12.5, paddingLeft: 10, paddingRight: 10, minWidth: 170 }}
          >
            <option value="">{t('documents.allSites')}</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
          </select>
          {hasFilter && (
            <button
              className="btn-ghost"
              onClick={() => { setFilterCat(''); setFilterSite(''); setSearch(''); loadDocs('', '', '', selectedFolder?.id); }}
              style={{ height: 34, padding: '0 12px', fontSize: 12, color: 'var(--red)' }}
            >
              ✕ Reset
            </button>
          )}
        </div>

        {/* Upload toggle */}
        <button
          className="btn-primary"
          onClick={() => { setShowUpload(p => !p); setSelected(null); }}
          style={{ height: 34, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {showUpload ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              {t('documents.cancelUpload')}
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {t('documents.upload')}
            </>
          )}
        </button>
      </div>

      {/* ── Category filter chips ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          className="dp-cat-chip"
          onClick={() => { setFilterCat(''); loadDocs('', filterSite, search, selectedFolder?.id); }}
          style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
            background: filterCat === '' ? 'var(--green)' : 'var(--surface-2)',
            color: filterCat === '' ? '#fff' : 'var(--text-2)',
            border: filterCat === '' ? 'none' : '1px solid var(--border)',
          }}
        >
          {t('documents.filterAll', { count: docs.length })}
        </button>
        {catCounts.map(c => (
          <button
            key={c.key}
            className="dp-cat-chip"
            onClick={() => { setFilterCat(c.key); loadDocs(c.key, filterSite, search, selectedFolder?.id); }}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              background: filterCat === c.key ? c.color : 'var(--surface-2)',
              color: filterCat === c.key ? '#fff' : 'var(--text-2)',
              border: filterCat === c.key ? 'none' : '1px solid var(--border)',
            }}
          >
            {t(`documents.categories.${c.key}` as any, c.label)} {c.count > 0 && `(${c.count})`}
          </button>
        ))}
      </div>

      {/* ── Upload panel ── */}
      {showUpload && (
        <div className="dp-fade-in" style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '20px 20px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {t('documents.uploadTitle')}
          </div>
          <UploadForm
            sites={sites} folders={folders} categories={categories}
            onUploaded={doc => { setShowUpload(false); loadDocs(filterCat, filterSite, search, selectedFolder?.id); setSelected(doc); }}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      )}

      {/* ── Three-panel layout ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1 }}>

        {/* LEFT: Folder sidebar */}
        <FolderSidebar
          folders={folders}
          sites={sites}
          selectedFolder={selectedFolder}
          onSelect={folder => { setSelectedFolder(folder); setSelected(null); }}
          onNewFolder={() => setShowCreateFolder(true)}
          onFolderRenamed={handleFolderRenamed}
          onFolderDeleted={handleFolderDeleted}
          onMoveFolder={setMovingFolder}
        />

        {/* MIDDLE: Content browser */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Breadcrumb */}
          {breadcrumb.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', padding: '2px 0' }}>
              <button
                onClick={() => { setSelectedFolder(null); setSelected(null); }}
                style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                </svg>
                <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                  {t('documentsExtra.allDocuments')}
                </span>
              </button>
              {breadcrumb.map((f, i) => (
                <span key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={2} strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  {i < breadcrumb.length - 1 ? (
                    <button
                      onClick={() => setSelectedFolder(f)}
                      style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', borderRadius: 4 }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>{f.name}</span>
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, padding: '2px 4px' }}>{f.name}</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Content panel */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            maxHeight: 'calc(100vh - 230px)',
            overflowY: 'auto',
          }}>

            {/* Subfolders grid */}
            {subfolders.length > 0 && !hasFilter && (
              <div style={{ padding: '12px 12px 8px' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                  {subfolders.length} {subfolders.length === 1 ? 'subfolder' : 'subfoldere'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6, marginBottom: docs.length > 0 ? 12 : 0 }}>
                  {subfolders.map(sf => (
                    <div
                      key={sf.id}
                      className="dp-subfolder-card"
                      onClick={() => { setSelectedFolder(sf); setSelected(null); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px',
                        borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--surface-2)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(34,197,94,0.2)" stroke="var(--green)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                      </svg>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sf.name}
                      </span>
                      {sf.doc_count > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--surface-3)', color: 'var(--text-2)', borderRadius: 8, padding: '1px 5px', flexShrink: 0 }}>
                          {sf.doc_count}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Divider between folders and docs */}
            {subfolders.length > 0 && !hasFilter && docs.length > 0 && (
              <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />
            )}

            {/* Document section header */}
            {docs.length > 0 && (
              <div style={{ padding: '10px 14px 6px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {docs.length}{docsTotal > docs.length ? ` / ${docsTotal}` : ''} {docs.length === 1 ? 'document' : 'documente'}
              </div>
            )}

            {/* Document rows */}
            {docs.map(d => (
              <DocRow
                key={d.id}
                doc={d as any}
                selected={selected?.id === d.id}
                catMap={catMap}
                onClick={() => { setSelected(d); setShowUpload(false); }}
              />
            ))}

            {/* Load more */}
            {docs.length < docsTotal && (
              <div style={{ padding: '12px 14px', textAlign: 'center' }}>
                <button
                  onClick={() => loadDocs(filterCat, filterSite, search, selectedFolder?.id, docsOffset)}
                  disabled={docsLoading}
                  style={{ padding: '7px 20px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, cursor: docsLoading ? 'default' : 'pointer', opacity: docsLoading ? 0.6 : 1 }}
                >
                  {docsLoading ? t('common.loading') : t('documentsExtra.loadMore', { count: docsTotal - docs.length })}
                </button>
              </div>
            )}
            {docsLoading && docs.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>{t('documentsExtra.loadingDocs')}</div>
            )}

            {/* Empty states */}
            {docs.length === 0 && subfolders.length === 0 && (
              hasFilter ? (
                <EmptyState
                  icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                  text={t('documents.noDocumentsFiltered')}
                  sub="Încearcă alt termen de căutare"
                />
              ) : selectedFolder ? (
                <EmptyState
                  icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>}
                  text={t('documents.noDocuments')}
                  sub="Folderul este gol"
                />
              ) : (
                <EmptyState
                  icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>}
                  text="Selectează un folder"
                  sub="sau folosește căutarea pentru a găsi documente"
                />
              )
            )}

            {/* When no folder, no filter, but there are subfolders — show hint */}
            {docs.length === 0 && subfolders.length > 0 && !hasFilter && !selectedFolder && (
              <div style={{ padding: '8px 14px 14px', fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                Dă click pe un folder pentru a vedea documentele
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Detail panel */}
        <div style={{ width: 300, flexShrink: 0 }}>
          {selected ? (
            <DocDetail
              doc={selected} catMap={catMap}
              onDelete={handleDelete}
              onClose={() => setSelected(null)}
              onView={() => setViewingDocId(selected.id)}
              onEdit={() => setEditingDoc({ id: selected.id, name: selected.name })}
              onOfficeEdit={() => setOfficeDoc({ id: selected.id, name: selected.name })}
              onMove={() => setMovingDoc(selected)}
            />
          ) : (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '40px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.5 }}>
                {t('documents.selectDocument')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {viewingDocId !== null && <DocumentViewerModal docId={viewingDocId} onClose={() => setViewingDocId(null)} />}
      {editingDoc !== null && <TextEditorModal docId={editingDoc.id} docName={editingDoc.name} onClose={() => setEditingDoc(null)} />}
      {officeDoc !== null && (
        <OnlyOfficeEditor
          docId={officeDoc.id} docName={officeDoc.name}
          onClose={() => { setOfficeDoc(null); loadDocs(filterCat, filterSite, search, selectedFolder?.id); }}
        />
      )}
      {movingDoc && (
        <MovePicker
          folders={folders} currentFolderId={movingDoc.folder_id ?? null}
          title={`Mută: ${movingDoc.name}`}
          onConfirm={handleMoveDoc} onClose={() => setMovingDoc(null)}
        />
      )}
      {movingFolder && (
        <MovePicker
          folders={folders} currentFolderId={movingFolder.parent_id}
          excludeFolderId={movingFolder.id}
          title={`Mută folderul: ${movingFolder.name}`}
          onConfirm={handleMoveFolder} onClose={() => setMovingFolder(null)}
        />
      )}
      {showCreateFolder && (
        <CreateFolderModal
          sites={sites}
          onCreated={folder => { setFolders(prev => [...prev, folder]); setShowCreateFolder(false); }}
          onClose={() => setShowCreateFolder(false)}
        />
      )}
    </div>
  );
}
