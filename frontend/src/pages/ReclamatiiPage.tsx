import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { fetchReclamatii, createReclamatie, updateReclamatie, deleteReclamatie } from '../api/reclamatii';
import { fetchSites } from '../api/sites';
import { fetchUsers } from '../api/users';
import type { Site } from '../types';

interface Reclamatie {
  id: number;
  title: string;
  type: string;
  priority: string;
  status: string;
  description: string;
  resolution_notes: string | null;
  site_id: number | null;
  site_name: string | null;
  assigned_to: number | null;
  assigned_name: string | null;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
}

interface AppUser { id: number; full_name: string; role: string; }

const PRIORITY_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  urgent: { bg: '#fef2f2', color: '#dc2626', label: 'Urgent' },
  high:   { bg: '#fff7ed', color: '#ea580c', label: 'High' },
  normal: { bg: '#eff6ff', color: '#2563eb', label: 'Normal' },
  low:    { bg: '#f0fdf4', color: '#16a34a', label: 'Low' },
};

const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string }> = {
  open:        { bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444' },
  in_progress: { bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' },
  resolved:    { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  closed:      { bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
};

const TYPE_LABELS: Record<string, string> = {
  client: 'Client', equipment: 'Utilaje', site: 'Șantier',
  supplier: 'Furnizor', internal: 'Intern', other: 'Altele',
};

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#fff',
};

const sel: React.CSSProperties = { ...inp };

const EMPTY_FORM = {
  title: '', type: 'internal', priority: 'normal',
  description: '', site_id: '', assigned_to: '',
};

const EMPTY_UPDATE = {
  status: '', resolution_notes: '', assigned_to: '', priority: '',
};

export function ReclamatiiPage() {
  const { t } = useTranslation();

  const [items, setItems]           = useState<Reclamatie[]>([]);
  const [sites, setSites]           = useState<Site[]>([]);
  const [users, setUsers]           = useState<AppUser[]>([]);
  const [loading, setLoading]       = useState(true);

  // Filters
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterType,     setFilterType]     = useState('');

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem,   setEditItem]   = useState<Reclamatie | null>(null);
  const [detailItem, setDetailItem] = useState<Reclamatie | null>(null);

  // Forms
  const [form,   setForm]   = useState({ ...EMPTY_FORM });
  const [update, setUpdate] = useState({ ...EMPTY_UPDATE });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus)   params.status   = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      if (filterType)     params.type     = filterType;
      const data = await fetchReclamatii(params);
      setItems(data);
    } catch {
      toast.error('Eroare la încărcare reclamații');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterStatus, filterPriority, filterType]);

  useEffect(() => {
    fetchSites().then(d => setSites(d.filter((s: Site) => s.is_baustelle))).catch(() => {});
    fetchUsers().then(setUsers).catch(() => {});
  }, []);

  // Stats
  const stats = {
    open:        items.filter(r => r.status === 'open').length,
    in_progress: items.filter(r => r.status === 'in_progress').length,
    resolved:    items.filter(r => r.status === 'resolved').length,
    closed:      items.filter(r => r.status === 'closed').length,
  };

  async function handleCreate() {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Titlul și descrierea sunt obligatorii');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        type: form.type,
        priority: form.priority,
        description: form.description.trim(),
      };
      if (form.site_id)    body.site_id    = parseInt(form.site_id);
      if (form.assigned_to) body.assigned_to = parseInt(form.assigned_to);
      await createReclamatie(body);
      toast.success('Reclamație creată');
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch {
      toast.error('Eroare la creare');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editItem) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (update.status)          body.status           = update.status;
      if (update.resolution_notes !== '') body.resolution_notes = update.resolution_notes;
      if (update.priority)        body.priority         = update.priority;
      if (update.assigned_to)     body.assigned_to      = parseInt(update.assigned_to);
      await updateReclamatie(editItem.id, body);
      toast.success('Actualizat');
      setEditItem(null);
      setUpdate({ ...EMPTY_UPDATE });
      load();
    } catch {
      toast.error('Eroare la actualizare');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Ștergi această reclamație?')) return;
    try {
      await deleteReclamatie(id);
      toast.success('Șters');
      load();
    } catch {
      toast.error('Eroare la ștergere');
    }
  }

  function openEdit(r: Reclamatie) {
    setEditItem(r);
    setUpdate({
      status: r.status,
      resolution_notes: r.resolution_notes || '',
      assigned_to: r.assigned_to ? String(r.assigned_to) : '',
      priority: r.priority,
    });
  }

  function fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Reclamații</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Monitorizare și gestiune reclamații interne
          </p>
        </div>
        <button
          onClick={() => { setCreateOpen(true); setForm({ ...EMPTY_FORM }); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#1e3a8a', color: '#fff',
            border: 'none', borderRadius: 8, padding: '9px 16px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Reclamație nouă
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {([
          ['open', 'Deschise', '#fef2f2', '#b91c1c'],
          ['in_progress', 'În lucru', '#eff6ff', '#1d4ed8'],
          ['resolved', 'Rezolvate', '#f0fdf4', '#15803d'],
          ['closed', 'Închise', '#f8fafc', '#475569'],
        ] as [keyof typeof stats, string, string, string][]).map(([key, label, bg, color]) => (
          <div
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
            style={{
              background: filterStatus === key ? bg : '#fff',
              border: `1.5px solid ${filterStatus === key ? color : '#e2e8f0'}`,
              borderRadius: 10, padding: '14px 18px',
              cursor: 'pointer', transition: 'all 120ms',
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{stats[key]}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ ...sel, width: 140 }}>
          <option value="">Toate statusurile</option>
          <option value="open">Deschis</option>
          <option value="in_progress">În lucru</option>
          <option value="resolved">Rezolvat</option>
          <option value="closed">Închis</option>
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          style={{ ...sel, width: 140 }}>
          <option value="">Toate prioritățile</option>
          <option value="urgent">Urgent</option>
          <option value="high">Ridicat</option>
          <option value="normal">Normal</option>
          <option value="low">Scăzut</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ ...sel, width: 140 }}>
          <option value="">Toate tipurile</option>
          <option value="client">Client</option>
          <option value="equipment">Utilaje</option>
          <option value="site">Șantier</option>
          <option value="supplier">Furnizor</option>
          <option value="internal">Intern</option>
          <option value="other">Altele</option>
        </select>
        {(filterStatus || filterPriority || filterType) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterType(''); }}
            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#64748b', cursor: 'pointer' }}
          >
            Resetează filtre
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Se încarcă...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#f8fafc', borderRadius: 12, border: '1px dashed #e2e8f0' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚑</div>
          <div style={{ fontWeight: 500 }}>Nicio reclamație</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Adaugă prima reclamație folosind butonul de mai sus</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(r => {
            const pCfg = PRIORITY_CONFIG[r.priority] || PRIORITY_CONFIG.normal;
            const sCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.open;
            return (
              <div key={r.id} style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                {/* Priority stripe */}
                <div style={{ width: 4, borderRadius: 4, alignSelf: 'stretch', background: pCfg.color, flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      onClick={() => setDetailItem(r)}
                      style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', cursor: 'pointer' }}
                    >
                      {r.title}
                    </span>
                    {/* Status badge */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: sCfg.bg, color: sCfg.color,
                      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sCfg.dot, display: 'inline-block' }} />
                      {r.status === 'open' ? 'Deschis' : r.status === 'in_progress' ? 'În lucru' : r.status === 'resolved' ? 'Rezolvat' : 'Închis'}
                    </span>
                    {/* Priority badge */}
                    <span style={{
                      background: pCfg.bg, color: pCfg.color,
                      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
                    }}>
                      {pCfg.label}
                    </span>
                    {/* Type badge */}
                    <span style={{
                      background: '#f1f5f9', color: '#475569',
                      borderRadius: 20, padding: '2px 10px', fontSize: 11,
                    }}>
                      {TYPE_LABELS[r.type] || r.type}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, lineHeight: 1.4 }}>
                    {r.description.length > 120 ? r.description.slice(0, 120) + '…' : r.description}
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                    {r.site_name && (
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        <b style={{ color: '#334155' }}>Șantier:</b> {r.site_name}
                      </span>
                    )}
                    {r.assigned_name && (
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        <b style={{ color: '#334155' }}>Atribuit:</b> {r.assigned_name}
                      </span>
                    )}
                    {r.created_by_name && (
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        <b style={{ color: '#334155' }}>Creat de:</b> {r.created_by_name}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmtDate(r.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => openEdit(r)}
                    style={{
                      background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6,
                      padding: '6px 12px', fontSize: 12, color: '#334155', cursor: 'pointer',
                    }}
                  >
                    Editează
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    style={{
                      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
                      padding: '6px 12px', fontSize: 12, color: '#b91c1c', cursor: 'pointer',
                    }}
                  >
                    Șterge
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <Modal title="Reclamație nouă" onClose={() => setCreateOpen(false)}>
          <FormRow label="Titlu *">
            <input style={inp} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Descriere scurtă..." />
          </FormRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label="Tip">
              <select style={sel} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                <option value="internal">Intern</option>
                <option value="client">Client</option>
                <option value="equipment">Utilaje</option>
                <option value="site">Șantier</option>
                <option value="supplier">Furnizor</option>
                <option value="other">Altele</option>
              </select>
            </FormRow>
            <FormRow label="Prioritate">
              <select style={sel} value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                <option value="urgent">Urgent</option>
                <option value="high">Ridicat</option>
                <option value="normal">Normal</option>
                <option value="low">Scăzut</option>
              </select>
            </FormRow>
          </div>
          <FormRow label="Descriere *">
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Detalii..." />
          </FormRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label="Șantier">
              <select style={sel} value={form.site_id} onChange={e => setForm(p => ({ ...p, site_id: e.target.value }))}>
                <option value="">— Fără șantier —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormRow>
            <FormRow label="Atribuit la">
              <select style={sel} value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                <option value="">— Neatribuit —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </FormRow>
          </div>
          <ModalActions>
            <button onClick={() => setCreateOpen(false)} style={btnSecondary}>Anulează</button>
            <button onClick={handleCreate} disabled={saving} style={btnPrimary}>{saving ? 'Se salvează...' : 'Creează'}</button>
          </ModalActions>
        </Modal>
      )}

      {/* Edit/update modal */}
      {editItem && (
        <Modal title={`Actualizează: ${editItem.title}`} onClose={() => setEditItem(null)}>
          <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
            {editItem.description}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label="Status">
              <select style={sel} value={update.status} onChange={e => setUpdate(p => ({ ...p, status: e.target.value }))}>
                <option value="open">Deschis</option>
                <option value="in_progress">În lucru</option>
                <option value="resolved">Rezolvat</option>
                <option value="closed">Închis</option>
              </select>
            </FormRow>
            <FormRow label="Prioritate">
              <select style={sel} value={update.priority} onChange={e => setUpdate(p => ({ ...p, priority: e.target.value }))}>
                <option value="urgent">Urgent</option>
                <option value="high">Ridicat</option>
                <option value="normal">Normal</option>
                <option value="low">Scăzut</option>
              </select>
            </FormRow>
          </div>
          <FormRow label="Atribuit la">
            <select style={sel} value={update.assigned_to} onChange={e => setUpdate(p => ({ ...p, assigned_to: e.target.value }))}>
              <option value="">— Neatribuit —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </FormRow>
          <FormRow label="Note rezoluție">
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={update.resolution_notes}
              onChange={e => setUpdate(p => ({ ...p, resolution_notes: e.target.value }))} placeholder="Cum a fost rezolvat..." />
          </FormRow>
          <ModalActions>
            <button onClick={() => setEditItem(null)} style={btnSecondary}>Anulează</button>
            <button onClick={handleUpdate} disabled={saving} style={btnPrimary}>{saving ? 'Se salvează...' : 'Salvează'}</button>
          </ModalActions>
        </Modal>
      )}

      {/* Detail modal */}
      {detailItem && (
        <Modal title={detailItem.title} onClose={() => setDetailItem(null)}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {(() => {
              const sCfg = STATUS_CONFIG[detailItem.status] || STATUS_CONFIG.open;
              const pCfg = PRIORITY_CONFIG[detailItem.priority] || PRIORITY_CONFIG.normal;
              return (
                <>
                  <span style={{ background: sCfg.bg, color: sCfg.color, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                    {detailItem.status === 'open' ? 'Deschis' : detailItem.status === 'in_progress' ? 'În lucru' : detailItem.status === 'resolved' ? 'Rezolvat' : 'Închis'}
                  </span>
                  <span style={{ background: pCfg.bg, color: pCfg.color, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                    {pCfg.label}
                  </span>
                  <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 20, padding: '3px 12px', fontSize: 12 }}>
                    {TYPE_LABELS[detailItem.type] || detailItem.type}
                  </span>
                </>
              );
            })()}
          </div>

          <DetailField label="Descriere" value={detailItem.description} />
          {detailItem.resolution_notes && <DetailField label="Note rezoluție" value={detailItem.resolution_notes} />}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <DetailField label="Șantier" value={detailItem.site_name || '—'} />
            <DetailField label="Atribuit" value={detailItem.assigned_name || '—'} />
            <DetailField label="Creat de" value={detailItem.created_by_name || '—'} />
            <DetailField label="Creat la" value={fmtDate(detailItem.created_at)} />
            {detailItem.resolved_at && <DetailField label="Rezolvat la" value={fmtDate(detailItem.resolved_at)} />}
          </div>

          <ModalActions>
            <button onClick={() => { setDetailItem(null); openEdit(detailItem); }} style={btnSecondary}>Editează</button>
            <button onClick={() => setDetailItem(null)} style={btnPrimary}>Închide</button>
          </ModalActions>
        </Modal>
      )}
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 540,
        maxHeight: '90vh', overflowY: 'auto', padding: '24px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

function ModalActions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
      {children}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 8,
  padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
