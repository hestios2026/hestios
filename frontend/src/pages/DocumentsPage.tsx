import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { fetchDocuments, uploadDocument, deleteDocument } from '../api/documents';
import { fetchFolders, createFolder, deleteFolder, renameFolder, FolderItem } from '../api/folders';
import { fetchDocumentCategories, DocCategory } from '../api/settings';
import { fetchSites } from '../api/sites';
import { DocumentViewerModal } from '../components/DocumentViewerModal';
import { TextEditorModal } from '../components/TextEditorModal';
import type { Document, Site } from '../types';

// ─── Constants (fallback — overridden by API) ─────────────────────────────────

const DEFAULT_CATEGORIES: DocCategory[] = [
  { key: 'contract',  label: 'Contract',    color: '#1d4ed8', icon: '📄' },
  { key: 'invoice',   label: 'Rechnung',    color: '#7c3aed', icon: '🧾' },
  { key: 'other',     label: 'Altele',      color: '#64748b', icon: '📁' },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 };
const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 7, border: 'none',
  background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db',
  background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151',
};
const card: React.CSSProperties = { background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

function isPDF(contentType: string): boolean {
  return contentType === 'application/pdf';
}

function fileIcon(contentType: string): string {
  if (isImage(contentType)) return '🖼';
  if (isPDF(contentType)) return '📄';
  if (contentType.includes('word')) return '📝';
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊';
  if (contentType.includes('zip')) return '🗜';
  return '📁';
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
      const folder = await createFolder({
        name: name.trim(),
        site_id: siteId ? parseInt(siteId) : undefined,
        description: description.trim() || undefined,
      });
      toast.success(t('documentsExtra.folderCreated'));
      onCreated(folder);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...card, padding: 28, width: 420, maxWidth: '90vw' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>
          {t('documentsExtra.folderNew')}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>{t('documentsExtra.folderName')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={inp}
              placeholder={t('documentsExtra.folderNamePlaceholder')}
              autoFocus
              required
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>{t('documentsExtra.folderClient')}</label>
            <select value={siteId} onChange={e => setSiteId(e.target.value)} style={inp}>
              <option value="">{t('documentsExtra.folderNoClient')}</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>{t('documentsExtra.folderDescription')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ ...inp, height: 72, resize: 'vertical' }}
              placeholder={t('documents.descPlaceholder')}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }} disabled={saving}>
              {saving ? t('documentsExtra.folderCreating') : t('documentsExtra.folderCreate')}
            </button>
            <button type="button" style={btnSecondary} onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Folder Sidebar ───────────────────────────────────────────────────────────

function FolderSidebar({ folders, selectedFolder, onSelect, onNewFolder, onFolderRenamed, onFolderDeleted }: {
  folders: FolderItem[];
  selectedFolder: FolderItem | null;
  onSelect: (folder: FolderItem | null) => void;
  onNewFolder: () => void;
  onFolderRenamed: (folder: FolderItem) => void;
  onFolderDeleted: (folderId: number) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Group top-level folders by site
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

  siteMap.forEach((val, key) => {
    grouped.push({ siteKey: key, siteLabel: val.label, items: val.items });
  });

  function getChildren(parentId: number): FolderItem[] {
    return folders.filter(f => f.parent_id === parentId);
  }

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function startRename(folder: FolderItem) {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  }

  async function commitRename(folder: FolderItem) {
    if (!renameValue.trim() || renameValue.trim() === folder.name) {
      setRenamingId(null);
      return;
    }
    try {
      const updated = await renameFolder(folder.id, { name: renameValue.trim() });
      toast.success(t('documentsExtra.folderRenamed'));
      onFolderRenamed(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    } finally {
      setRenamingId(null);
    }
  }

  async function handleDelete(folder: FolderItem) {
    if (!confirm(t('documentsExtra.folderDeleteConfirm', { name: folder.name }))) return;
    try {
      await deleteFolder(folder.id);
      toast.success(t('documentsExtra.folderDeleted'));
      onFolderDeleted(folder.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    }
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
          onMouseEnter={() => setHoveredId(folder.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: `5px 8px 5px ${12 + depth * 14}px`,
            borderRadius: 6, cursor: 'pointer',
            background: isSelected ? '#dbeafe' : isHovered ? '#f1f5f9' : 'transparent',
            marginBottom: 1,
          }}
          onClick={() => {
            if (!isRenaming) onSelect(folder);
          }}
        >
          {children.length > 0 ? (
            <span
              style={{ fontSize: 10, color: '#94a3b8', width: 14, textAlign: 'center', flexShrink: 0 }}
              onClick={e => { e.stopPropagation(); toggleExpand(folder.id); }}
            >
              {isExpanded ? '▾' : '▸'}
            </span>
          ) : (
            <span style={{ width: 14, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 14, flexShrink: 0 }}>📁</span>
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={() => commitRename(folder)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename(folder);
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onClick={e => e.stopPropagation()}
              style={{ ...inp, padding: '2px 6px', fontSize: 12, flex: 1 }}
            />
          ) : (
            <span style={{
              fontSize: 12, color: isSelected ? '#1d4ed8' : '#1e293b',
              fontWeight: isSelected ? 700 : 500, flex: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {folder.name}
            </span>
          )}
          {folder.doc_count != null && !isRenaming && (
            <span style={{
              fontSize: 10, fontWeight: 700, background: '#e2e8f0', color: '#64748b',
              borderRadius: 10, padding: '1px 6px', flexShrink: 0,
            }}>
              {folder.doc_count}
            </span>
          )}
          {isHovered && !isRenaming && (
            <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              <button
                title={t('common.rename')}
                onClick={e => { e.stopPropagation(); startRename(folder); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '0 2px', color: '#64748b' }}
              >
                ✏
              </button>
              <button
                title={t('common.delete')}
                onClick={e => { e.stopPropagation(); handleDelete(folder); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '0 2px', color: '#ef4444' }}
              >
                🗑
              </button>
            </span>
          )}
        </div>
        {isExpanded && children.map(child => renderFolder(child, depth + 1))}
      </div>
    );
  }

  return (
    <div style={{
      width: 220, flexShrink: 0, ...card,
      display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('documentsExtra.foldersHeader')}</span>
        <button
          onClick={onNewFolder}
          title={t('documentsExtra.folderNew')}
          style={{ ...btnPrimary, padding: '4px 10px', fontSize: 11, borderRadius: 5 }}
        >
          {t('documentsExtra.newBtn')}
        </button>
      </div>

      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {/* All Documents */}
        <div
          onClick={() => onSelect(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
            background: selectedFolder === null ? '#dbeafe' : '#f8fafc',
            border: selectedFolder === null ? '1px solid #bfdbfe' : '1px solid transparent',
          }}
        >
          <span style={{ fontSize: 14 }}>🗂</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: selectedFolder === null ? '#1d4ed8' : '#374151' }}>
            {t('documentsExtra.allDocuments')}
          </span>
        </div>

        {/* Grouped folders */}
        {grouped.length === 0 && (
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '16px 8px' }}>
            {t('documentsExtra.noFolders')}
          </div>
        )}
        {grouped.map(group => (
          <div key={group.siteKey} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 8px 2px' }}>
              {group.siteLabel}
            </div>
            {group.items.map(f => renderFolder(f, 0))}
          </div>
        ))}
      </div>
    </div>
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
  const [form, setForm] = useState({
    category: 'other', description: '', site_id: '', employee_id: '', equipment_id: '', notes: '', folder_id: '',
  });

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
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
      if (form.employee_id) fd.append('employee_id', form.employee_id);
      if (form.notes) fd.append('notes', form.notes);
      if (form.folder_id) fd.append('folder_id', form.folder_id);
      const doc = await uploadDocument(fd);
      toast.success(t('documents.uploadedOk'));
      onUploaded(doc);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#1d4ed8' : '#d1d5db'}`,
          borderRadius: 10, padding: '32px 20px', textAlign: 'center',
          cursor: 'pointer', marginBottom: 20,
          background: dragging ? '#eff6ff' : '#f8fafc',
          transition: 'all 0.15s',
        }}
      >
        <input ref={fileRef} type="file" style={{ display: 'none' }}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.zip"
          onChange={e => e.target.files?.[0] && setSelectedFile(e.target.files[0])} />
        {selectedFile ? (
          <div>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{fileIcon(selectedFile.type)}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{selectedFile.name}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{formatSize(selectedFile.size)}</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 14, color: '#64748b' }}>{t('documents.dragText')} <strong style={{ color: '#1d4ed8' }}>{t('documents.dragSelect')}</strong></div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{t('documents.fileTypes')}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={lbl}>{t('common.category')}</label>
          <select value={form.category} onChange={e => f('category', e.target.value)} style={inp}>
            {categories.map(c => <option key={c.key} value={c.key}>{c.icon} {t(`documents.categories.${c.key}` as any, c.label)}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>{t('documents.siteAssoc')}</label>
          <select value={form.site_id} onChange={e => f('site_id', e.target.value)} style={inp}>
            <option value="">{t('common.noSite')}</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>{t('documentsExtra.folderLabel')}</label>
          <select value={form.folder_id} onChange={e => f('folder_id', e.target.value)} style={inp}>
            <option value="">{t('documentsExtra.folderNone')}</option>
            {folders.map(fl => <option key={fl.id} value={fl.id}>{fl.name}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={lbl}>{t('documents.shortDesc')}</label>
          <input value={form.description} onChange={e => f('description', e.target.value)} style={inp} placeholder={t('documents.descPlaceholder')} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={lbl}>{t('documents.internalNotes')}</label>
          <input value={form.notes} onChange={e => f('notes', e.target.value)} style={inp} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button type="submit" style={{ ...btnPrimary, opacity: uploading ? 0.7 : 1 }} disabled={uploading}>
          {uploading ? t('documents.uploading') : t('documents.uploadBtn')}
        </button>
        <button type="button" style={btnSecondary} onClick={onCancel}>{t('documents.cancelUpload')}</button>
      </div>
    </form>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────

function DocCard({ doc, selected, catMap, onClick }: { doc: Document & { folder_id?: number; folder_name?: string }; selected: boolean; catMap: Record<string, DocCategory>; onClick: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const cat = catMap[doc.category] || catMap['other'] || { key: doc.category, label: doc.category, color: '#64748b', icon: '📁' };
  return (
    <div onClick={onClick} style={{
      padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
      background: selected ? '#eff6ff' : '#fff', display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{fileIcon(doc.content_type)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {doc.name}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ background: cat.color + '18', color: cat.color, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
            {cat.icon} {t(`documents.categories.${cat.key}` as any, cat.label)}
          </span>
          {doc.site_name && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{doc.site_name}</span>
          )}
          {doc.folder_name && (
            <span style={{ fontSize: 10, background: '#f0fdf4', color: '#16a34a', fontWeight: 600, padding: '1px 7px', borderRadius: 10 }}>
              📁 {doc.folder_name}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
          {formatSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString(locale)}
          {doc.uploader_name && ` · ${doc.uploader_name}`}
        </div>
      </div>
    </div>
  );
}

// ─── Document Detail ──────────────────────────────────────────────────────────

function DocDetail({ doc, catMap, onDelete, onClose, onView, onEdit }: {
  doc: Document; catMap: Record<string, DocCategory>; onDelete: () => void; onClose: () => void;
  onView: () => void; onEdit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const cat = catMap[doc.category] || catMap['other'] || { key: doc.category, label: doc.category, color: '#64748b', icon: '📁' };
  const token = localStorage.getItem('hestios_token');
  const canView = isImage(doc.content_type) || isPDF(doc.content_type);
  const canEdit = doc.content_type.startsWith('text/');

  return (
    <div style={{ ...card, padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ fontSize: 40 }}>{fileIcon(doc.content_type)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', wordBreak: 'break-word' }}>{doc.name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ background: cat.color + '18', color: cat.color, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>
              {cat.icon} {t(`documents.categories.${cat.key}` as any, cat.label)}
            </span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatSize(doc.file_size)}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{doc.content_type}</span>
          </div>
        </div>
      </div>

      {/* Metadata grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          [t('documents.uploadedBy'), doc.uploader_name || '—'],
          [t('common.date'), new Date(doc.created_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })],
          [t('documents.siteAssoc'), doc.site_name || '—'],
          [t('hr.tabs.employees'), doc.employee_name || '—'],
          [t('equipment.title'), doc.equipment_name || '—'],
          [t('documents.fileSize'), formatSize(doc.file_size)],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>

      {doc.description && (
        <div style={{ background: '#fffbeb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#475569' }}>
          {doc.description}
        </div>
      )}
      {doc.notes && (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#64748b' }}>
          {doc.notes}
        </div>
      )}

      {/* Preview for images */}
      {isImage(doc.content_type) && doc.download_url && (
        <div style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <img src={doc.download_url} alt={doc.name} style={{ width: '100%', maxHeight: 300, objectFit: 'contain', background: '#f8fafc' }} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canView && (
          <button style={btnPrimary} onClick={onView}>{t('documents.viewBtn')}</button>
        )}
        {canEdit && (
          <button style={{ ...btnSecondary, color: '#1d4ed8', fontWeight: 700 }} onClick={onEdit}>{t('documents.editBtn')}</button>
        )}
        <a
          href={`/api/documents/${doc.id}/download/`}
          target="_blank"
          rel="noreferrer"
          onClick={e => {
            e.preventDefault();
            fetch(`/api/documents/${doc.id}/download/`, {
              headers: { Authorization: `Bearer ${token}` },
              redirect: 'follow',
            }).then(r => r.blob()).then(blob => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = doc.name; a.click();
              URL.revokeObjectURL(url);
            });
          }}
          style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {t('documents.downloadBtn')}
        </a>
        <button style={{ ...btnSecondary, color: '#dc2626', marginLeft: 'auto' }} onClick={onDelete}>{t('common.delete')}</button>
        <button style={btnSecondary} onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DocumentsPage() {
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

  const [filterCat, setFilterCat] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [search, setSearch] = useState('');

  const catMap = Object.fromEntries(categories.map(c => [c.key, c]));

  const loadDocs = (cat = filterCat, site = filterSite, q = search, folderId?: number) => {
    const params: Record<string, string | number> = {};
    if (cat) params.category = cat;
    if (site) params.site_id = parseInt(site);
    if (q) params.search = q;
    if (folderId !== undefined) params.folder_id = folderId;
    fetchDocuments(params).then(setDocs).catch(() => toast.error(t('common.error')));
  };

  useEffect(() => {
    loadDocs();
    fetchSites().then(setSites);
    fetchFolders().then(setFolders);
    fetchDocumentCategories().then(setCategories).catch(() => {});
  }, []);

  // Reload docs when selected folder changes
  useEffect(() => {
    loadDocs(filterCat, filterSite, search, selectedFolder?.id);
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
    if (selectedFolder?.id === folderId) {
      setSelectedFolder(null);
    }
  }

  // Counts per category
  const catCounts = categories.map(c => ({
    ...c,
    count: docs.filter(d => d.category === c.key).length,
  }));

  return (
    <div className="page-root">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>{t('documents.title')}</h1>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            {t('documents.subtitle', { count: docs.length })}
          </div>
        </div>
        <button style={btnPrimary} onClick={() => { setShowUpload(p => !p); setSelected(null); }}>
          {showUpload ? t('documents.cancelUpload') : t('documents.upload')}
        </button>
      </div>

      {/* Category chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => { setFilterCat(''); loadDocs('', filterSite, search, selectedFolder?.id); }}
          style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: filterCat === '' ? '#1d4ed8' : '#f1f5f9',
            color: filterCat === '' ? '#fff' : '#475569',
            borderColor: filterCat === '' ? '#1d4ed8' : '#e2e8f0',
          }}>
          {t('documents.filterAll', { count: docs.length })}
        </button>
        {catCounts.filter(c => c.count > 0 || filterCat === c.key).map(c => (
          <button key={c.key} onClick={() => { setFilterCat(c.key); loadDocs(c.key, filterSite, search, selectedFolder?.id); }}
            style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filterCat === c.key ? c.color : '#f1f5f9',
              color: filterCat === c.key ? '#fff' : '#475569',
              borderColor: filterCat === c.key ? c.color : '#e2e8f0',
            }}>
            {c.icon} {t(`documents.categories.${c.key}` as any, c.label)} ({c.count})
          </button>
        ))}
      </div>

      {/* Upload form */}
      {showUpload && (
        <div style={{ ...card, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>{t('documents.uploadTitle')}</div>
          <UploadForm
            sites={sites}
            folders={folders}
            categories={categories}
            onUploaded={doc => { setShowUpload(false); loadDocs(filterCat, filterSite, search, selectedFolder?.id); setSelected(doc); }}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder={t('documents.searchPlaceholder')}
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadDocs(filterCat, filterSite, search, selectedFolder?.id)}
          style={{ ...inp, width: 220 }}
        />
        <select value={filterSite} onChange={e => { setFilterSite(e.target.value); loadDocs(filterCat, e.target.value, search, selectedFolder?.id); }}
          style={{ ...inp, width: 220 }}>
          <option value="">{t('documents.allSites')}</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
        </select>
        <button style={btnPrimary} onClick={() => loadDocs(filterCat, filterSite, search, selectedFolder?.id)}>{t('documents.searchBtn')}</button>
        <button style={btnSecondary} onClick={() => {
          setFilterCat(''); setFilterSite(''); setSearch('');
          loadDocs('', '', '', selectedFolder?.id);
        }}>{t('common.reset')}</button>
      </div>

      {/* Three-column layout */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Left: Folder Sidebar */}
        <FolderSidebar
          folders={folders}
          selectedFolder={selectedFolder}
          onSelect={folder => setSelectedFolder(folder)}
          onNewFolder={() => setShowCreateFolder(true)}
          onFolderRenamed={handleFolderRenamed}
          onFolderDeleted={handleFolderDeleted}
        />

        {/* Middle: Document List */}
        <div style={{ width: 380, flexShrink: 0 }}>
          <div style={card}>
            {docs.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                {filterCat || filterSite || search ? t('documents.noDocumentsFiltered') : t('documents.noDocuments')}
              </div>
            ) : docs.map(d => (
              <DocCard key={d.id} doc={d as any} selected={selected?.id === d.id} catMap={catMap} onClick={() => { setSelected(d); setShowUpload(false); }} />
            ))}
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div style={{ flex: 1 }}>
          {selected ? (
            <DocDetail
              doc={selected}
              catMap={catMap}
              onDelete={handleDelete}
              onClose={() => setSelected(null)}
              onView={() => setViewingDocId(selected.id)}
              onEdit={() => setEditingDoc({ id: selected.id, name: selected.name })}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94a3b8', fontSize: 14 }}>
              {t('documents.selectDocument')}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {viewingDocId !== null && (
        <DocumentViewerModal docId={viewingDocId} onClose={() => setViewingDocId(null)} />
      )}
      {editingDoc !== null && (
        <TextEditorModal
          docId={editingDoc.id}
          docName={editingDoc.name}
          onClose={() => setEditingDoc(null)}
        />
      )}
      {showCreateFolder && (
        <CreateFolderModal
          sites={sites}
          onCreated={folder => {
            setFolders(prev => [...prev, folder]);
            setShowCreateFolder(false);
          }}
          onClose={() => setShowCreateFolder(false)}
        />
      )}
    </div>
  );
}
