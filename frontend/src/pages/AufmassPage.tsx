import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { fetchEntries, createEntry, updateEntry, deleteEntry } from '../api/aufmass';
import { fetchSites } from '../api/sites';
import type { AufmassEntry, Site, User } from '../types';

// ─── Styles ───────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 };
const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 7, border: 'none',
  background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db',
  background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151',
};
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};

const STATUS_META: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#f1f5f9', color: '#475569' },
  submitted: { bg: '#fef3c7', color: '#92400e' },
  approved:  { bg: '#d1fae5', color: '#065f46' },
};

const UNITS = ['m', 'm²', 'm³', 'h', 'buc', 'kg', 't', 'pal', 'l', 'pauș'];

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const s = STATUS_META[status] || STATUS_META.draft;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {t(`aufmass.status.${status}`, status)}
    </span>
  );
}

// ─── Entry Form ───────────────────────────────────────────────────────────────

interface EntryFormProps {
  sites: Site[];
  initial?: Partial<AufmassEntry>;
  onSave: (data: object) => Promise<void>;
  onCancel: () => void;
}

function EntryForm({ sites, initial, onSave, onCancel }: EntryFormProps) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    site_id: initial?.site_id?.toString() || '',
    date: initial?.date || today,
    position: initial?.position || '',
    description: initial?.description || '',
    unit: initial?.unit || 'm',
    quantity: initial?.quantity?.toString() || '',
    unit_price: initial?.unit_price?.toString() || '',
    notes: initial?.notes || '',
  });

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const computedTotal = () => {
    const q = parseFloat(form.quantity) || 0;
    const p = parseFloat(form.unit_price) || 0;
    return q && p ? (q * p).toFixed(2) : '—';
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({
      site_id: parseInt(form.site_id),
      date: form.date,
      position: form.position,
      description: form.description,
      unit: form.unit,
      quantity: parseFloat(form.quantity),
      unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
      notes: form.notes || null,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={lbl}>{t('aufmass.fieldSite')} *</label>
          <select required value={form.site_id} onChange={e => f('site_id', e.target.value)} style={inp}>
            <option value="">{t('aufmass.selectPlaceholder')}</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>{t('aufmass.fieldDate')} *</label>
          <input required type="date" value={form.date} onChange={e => f('date', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>{t('aufmass.fieldPosition')} *</label>
          <input required value={form.position} onChange={e => f('position', e.target.value)} style={inp} placeholder="ex. 1.1" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={lbl}>{t('aufmass.fieldDescription')} *</label>
          <textarea required value={form.description} onChange={e => f('description', e.target.value)}
            style={{ ...inp, height: 72, resize: 'vertical' }} placeholder={t('aufmass.descriptionPlaceholder')} />
        </div>
        <div>
          <label style={lbl}>{t('aufmass.fieldUnit')}</label>
          <select value={form.unit} onChange={e => f('unit', e.target.value)} style={inp}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>{t('aufmass.fieldQuantity')} *</label>
          <input required type="number" step="0.001" value={form.quantity} onChange={e => f('quantity', e.target.value)} style={inp} placeholder="0.00" />
        </div>
        <div>
          <label style={lbl}>{t('aufmass.fieldUnitPrice')}</label>
          <input type="number" step="0.01" value={form.unit_price} onChange={e => f('unit_price', e.target.value)} style={inp} placeholder="0.00" />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {t('aufmass.totalLabel', { total: computedTotal() })}
          </div>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={lbl}>{t('common.notes')}</label>
          <input value={form.notes} onChange={e => f('notes', e.target.value)} style={inp} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" style={btnPrimary}>{initial?.id ? t('common.save') : t('aufmass.addEntry')}</button>
        <button type="button" style={btnSecondary} onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailProps {
  entry: AufmassEntry;
  user: User;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function EntryDetail({ entry, user, onStatusChange, onEdit, onDelete }: DetailProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const canEdit = user.role !== 'aufmass' || (entry.recorder_name === user.full_name && entry.status === 'draft');
  const canApprove = ['director', 'projekt_leiter'].includes(user.role);

  return (
    <div style={{ ...card, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
            {entry.site_kostenstelle} — {entry.site_name}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>
            Pos. {entry.position}
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
            {new Date(entry.date).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}
            {entry.recorder_name && ` · ${entry.recorder_name}`}
          </div>
        </div>
        <StatusBadge status={entry.status} />
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 14, color: '#1e293b', lineHeight: 1.6 }}>
        {entry.description}
      </div>

      {/* Measurement row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          [t('aufmass.colQty'), `${entry.quantity} ${entry.unit}`],
          [t('aufmass.colUnitPrice'), entry.unit_price != null ? `${entry.unit_price.toFixed(2)} EUR/${entry.unit}` : '—'],
          [t('aufmass.colTotal'), entry.total_price != null ? `${entry.total_price.toFixed(2)} EUR` : '—'],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#f1f5f9', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{value}</div>
          </div>
        ))}
      </div>

      {entry.notes && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20, padding: '10px 14px', background: '#fffbeb', borderRadius: 8 }}>
          {entry.notes}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {entry.status === 'draft' && (
          <>
            {canEdit && <button style={btnSecondary} onClick={onEdit}>{t('common.edit')}</button>}
            <button style={{ ...btnPrimary, background: '#d97706' }} onClick={() => onStatusChange('submitted')}>
              {t('aufmass.submitBtn')}
            </button>
          </>
        )}
        {entry.status === 'submitted' && canApprove && (
          <>
            <button style={{ ...btnPrimary, background: '#16a34a' }} onClick={() => onStatusChange('approved')}>
              {t('aufmass.approveBtn')}
            </button>
            <button style={{ ...btnSecondary, color: '#475569' }} onClick={() => onStatusChange('draft')}>
              {t('aufmass.rejectBtn')}
            </button>
          </>
        )}
        {entry.status !== 'approved' && canEdit && (
          <button style={{ ...btnSecondary, color: '#dc2626', marginLeft: 'auto' }} onClick={onDelete}>
            {t('common.delete')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AufmassPage({ user }: { user: User }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const [entries, setEntries] = useState<AufmassEntry[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selected, setSelected] = useState<AufmassEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<AufmassEntry | null>(null);

  // Filters
  const [filterSite, setFilterSite] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const loadEntries = () => {
    const params: Record<string, string | number> = {};
    if (filterSite) params.site_id = parseInt(filterSite);
    if (filterStatus) params.status = filterStatus;
    if (filterFrom) params.date_from = filterFrom;
    if (filterTo) params.date_to = filterTo;
    fetchEntries(params).then(setEntries).catch(() => toast.error(t('common.error')));
  };

  useEffect(() => { loadEntries(); fetchSites().then(setSites); }, []);

  async function handleCreate(data: object) {
    try {
      await createEntry(data);
      toast.success(t('aufmass.entryAdded'));
      setShowForm(false);
      loadEntries();
    } catch { toast.error(t('common.error')); }
  }

  async function handleUpdate(data: object) {
    if (!editEntry) return;
    try {
      const updated = await updateEntry(editEntry.id, data);
      toast.success(t('aufmass.entrySaved'));
      setEditEntry(null);
      setSelected(updated);
      loadEntries();
    } catch { toast.error(t('common.error')); }
  }

  async function handleStatusChange(status: string) {
    if (!selected) return;
    try {
      const updated = await updateEntry(selected.id, { status });
      setSelected(updated);
      if (status === 'submitted') toast.success(t('aufmass.submitted'));
      else if (status === 'approved') toast.success(t('aufmass.approved'));
      else toast.success(t('aufmass.rejected'));
      loadEntries();
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(t('aufmass.confirmDelete'))) return;
    try {
      await deleteEntry(selected.id);
      toast.success(t('aufmass.entryDeleted'));
      setSelected(null);
      loadEntries();
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
  }

  // Group entries by date
  const grouped: Record<string, AufmassEntry[]> = {};
  entries.forEach(e => {
    const d = e.date;
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(e);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalApproved = entries
    .filter(e => e.status === 'approved' && e.total_price != null)
    .reduce((s, e) => s + (e.total_price || 0), 0);
  const totalAll = entries
    .filter(e => e.total_price != null)
    .reduce((s, e) => s + (e.total_price || 0), 0);

  return (
    <div className="page-root">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>{t('aufmass.title')}</h1>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{t('aufmass.subtitle')}</div>
        </div>
        <button style={btnPrimary} onClick={() => { setShowForm(p => !p); setEditEntry(null); }}>
          {showForm ? t('common.cancel') : t('aufmass.addEntry')}
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          [t('aufmass.kpi.total'),     entries.length,                                        '#22C55E'],
          [t('aufmass.kpi.draft'),     entries.filter(e => e.status === 'draft').length,     '#475569'],
          [t('aufmass.kpi.submitted'), entries.filter(e => e.status === 'submitted').length, '#d97706'],
          [t('aufmass.kpi.approved'),  entries.filter(e => e.status === 'approved').length,  '#16a34a'],
        ].map(([label, val, color]) => (
          <div key={String(label)} style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: String(color) }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Value strip */}
      {totalAll > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{t('aufmass.totalFiltered')}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{totalAll.toFixed(2)} EUR</span>
          </div>
          <div style={{ background: '#d1fae5', borderRadius: 10, padding: '14px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#065f46' }}>{t('aufmass.approvedValue')}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#065f46' }}>{totalApproved.toFixed(2)} EUR</span>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && !editEntry && (
        <div style={{ ...card, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>{t('aufmass.addEntry')}</div>
          <EntryForm sites={sites} onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={{ ...inp, width: 220 }}>
          <option value="">{t('aufmass.filterSite')}</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 160 }}>
          <option value="">{t('aufmass.filterStatus')}</option>
          <option value="draft">{t('aufmass.status.draft')}</option>
          <option value="submitted">{t('aufmass.status.submitted')}</option>
          <option value="approved">{t('aufmass.status.approved')}</option>
        </select>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ ...inp, width: 160 }} />
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ ...inp, width: 160 }} />
        <button style={btnPrimary} onClick={loadEntries}>{t('common.apply')}</button>
        <button style={btnSecondary} onClick={() => { setFilterSite(''); setFilterStatus(''); setFilterFrom(''); setFilterTo(''); }}>{t('common.reset')}</button>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Left: grouped list */}
        <div style={{ width: 420, flexShrink: 0 }}>
          {entries.length === 0 && (
            <div style={{ ...card, padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              {t('aufmass.noEntries')}
            </div>
          )}
          {sortedDates.map(date => (
            <div key={date} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8, paddingLeft: 4 }}>
                {new Date(date).toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
              </div>
              <div style={card}>
                {grouped[date].map(e => (
                  <div key={e.id} onClick={() => { setSelected(e); setEditEntry(null); setShowForm(false); }}
                    style={{
                      padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                      background: selected?.id === e.id ? '#eff6ff' : '#fff',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', background: '#eff6ff', padding: '1px 7px', borderRadius: 4 }}>
                          Pos. {e.position}
                        </span>
                        <StatusBadge status={e.status} />
                      </div>
                      {e.total_price != null && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{e.total_price.toFixed(2)} EUR</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#1e293b', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.description}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {e.quantity} {e.unit} · {e.site_name}
                      {e.recorder_name && ` · ${e.recorder_name}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: detail / edit */}
        <div style={{ flex: 1 }}>
          {editEntry ? (
            <div style={{ ...card, padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>
                {t('aufmass.editEntry', { position: editEntry.position })}
              </div>
              <EntryForm
                sites={sites}
                initial={editEntry}
                onSave={handleUpdate}
                onCancel={() => setEditEntry(null)}
              />
            </div>
          ) : selected ? (
            <EntryDetail
              entry={selected}
              user={user}
              onStatusChange={handleStatusChange}
              onEdit={() => setEditEntry(selected)}
              onDelete={handleDelete}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94a3b8', fontSize: 14 }}>
              {t('aufmass.selectEntry')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
