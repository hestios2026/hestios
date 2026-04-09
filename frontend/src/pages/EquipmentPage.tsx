import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { fetchEquipment, createEquipment, updateEquipment, moveEquipment, fetchMovements } from '../api/equipment';
import { fetchSites } from '../api/sites';
import type { Site } from '../types';

interface Equipment {
  id: number;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  serial_number: string | null;
  status: 'active' | 'maintenance' | 'retired';
  current_site_id: number | null;
  current_site_name: string | null;
  service_due: string | null;
  itp_due: string | null;
  notes: string | null;
}

interface Movement {
  id: number;
  from_site: string;
  to_site: string;
  moved_by: string;
  moved_at: string;
  notes: string | null;
}

const CATEGORIES = ['utilaj', 'vehicul', 'unealta', 'altele'];

const STATUS_COLORS: Record<string, [string, string]> = {
  active:      ['#d1fae5', '#059669'],
  maintenance: ['#fef3c7', '#d97706'],
  retired:     ['#f1f5f9', '#64748b'],
};

const EMPTY_FORM = {
  name: '', category: 'utilaj', brand: '', model: '', year: '',
  serial_number: '', current_site_id: '', service_due: '', itp_due: '', notes: '',
};

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
};

export function EquipmentPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const [items, setItems]         = useState<Equipment[]>([]);
  const [sites, setSites]         = useState<Site[]>([]);
  const [selected, setSelected]   = useState<Equipment | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [showMove, setShowMove]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [moveForm, setMoveForm]   = useState({ to_site_id: '', notes: '' });
  const [filter, setFilter]       = useState('');

  useEffect(() => {
    fetchEquipment().then(setItems).catch(() => {});
    fetchSites(false).then(setSites).catch(() => {});
  }, []);

  async function selectItem(e: Equipment) {
    setSelected(e);
    setShowForm(false);
    setShowMove(false);
    const m = await fetchMovements(e.id);
    setMovements(m);
  }

  async function submitForm(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      const payload: Record<string, unknown> = { name: form.name, category: form.category };
      if (form.brand)          payload.brand          = form.brand;
      if (form.model)          payload.model          = form.model;
      if (form.year)           payload.year           = parseInt(form.year);
      if (form.serial_number)  payload.serial_number  = form.serial_number;
      if (form.current_site_id) payload.current_site_id = parseInt(form.current_site_id);
      if (form.service_due)    payload.service_due    = form.service_due;
      if (form.itp_due)        payload.itp_due        = form.itp_due;
      if (form.notes)          payload.notes          = form.notes;

      await createEquipment(payload);
      toast.success(t('equipment.saved'));
      const updated = await fetchEquipment();
      setItems(updated);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch { toast.error(t('common.error')); }
  }

  async function submitMove(ev: React.FormEvent) {
    ev.preventDefault();
    if (!selected) return;
    try {
      await moveEquipment(selected.id, {
        to_site_id: moveForm.to_site_id ? parseInt(moveForm.to_site_id) : null,
        notes: moveForm.notes || null,
      });
      toast.success(t('equipment.moved'));
      const updated = await fetchEquipment();
      setItems(updated);
      const refreshed = updated.find((e: Equipment) => e.id === selected.id) || null;
      setSelected(refreshed);
      const m = await fetchMovements(selected.id);
      setMovements(m);
      setShowMove(false);
      setMoveForm({ to_site_id: '', notes: '' });
    } catch { toast.error(t('common.error')); }
  }

  async function changeStatus(status: string) {
    if (!selected) return;
    try {
      const updated_eq = await updateEquipment(selected.id, { status });
      setSelected(updated_eq);
      const updated = await fetchEquipment();
      setItems(updated);
      toast.success(t('equipment.saved'));
    } catch { toast.error(t('common.error')); }
  }

  const filtered = items.filter(e =>
    !filter || e.name.toLowerCase().includes(filter.toLowerCase()) ||
    (e.brand || '').toLowerCase().includes(filter.toLowerCase()) ||
    (e.category || '').toLowerCase().includes(filter.toLowerCase())
  );

  const STATUS_LABELS: Record<string, string> = {
    active: t('equipment.status.active'),
    maintenance: t('equipment.status.maintenance'),
    retired: t('equipment.status.inactive'),
  };

  return (
    <div className="split-layout">
      {/* List */}
      <div className="split-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>
              {t('equipment.title')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>({items.length})</span>
            </span>
            <button onClick={() => { setShowForm(true); setSelected(null); }} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none',
              background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>+ {t('common.new')}</button>
          </div>
          <input
            placeholder={t('equipment.searchPlaceholder')}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ ...inp, fontSize: 12 }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.map(e => {
            const [bg, fg] = STATUS_COLORS[e.status] || ['#f1f5f9', '#64748b'];
            return (
              <div key={e.id} onClick={() => selectItem(e)} style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                background: selected?.id === e.id ? '#eff6ff' : '#fff',
                borderLeft: selected?.id === e.id ? '3px solid #22C55E' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{e.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: bg, color: fg, flexShrink: 0, marginLeft: 6 }}>
                    {STATUS_LABELS[e.status]}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {[e.brand, e.model, e.year].filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {e.current_site_name ? `@ ${e.current_site_name}` : t('common.noSite')}
                </div>
              </div>
            );
          })}
          {!filtered.length && (
            <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>
              {filter ? t('equipment.noResults') : t('equipment.noEquipment')}
            </div>
          )}
        </div>
      </div>

      {/* Detail / Form */}
      <div className="split-content page-root">

        {/* Add form */}
        {showForm && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>{t('equipment.newEquipment')}</div>
            <form onSubmit={submitForm} style={{
              background: '#fff', borderRadius: 12, padding: 24, maxWidth: 640,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
            }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('equipment.fieldName')} *</label>
                <input required value={form.name} placeholder="ex: Excavator Caterpillar 320"
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('equipment.category')}</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inp}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('equipment.currentSite')}</label>
                <select value={form.current_site_id} onChange={e => setForm(p => ({ ...p, current_site_id: e.target.value }))} style={inp}>
                  <option value="">{t('common.noSite')}</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} – {s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('equipment.brand')}</label>
                <input value={form.brand} placeholder="ex: Caterpillar"
                  onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('equipment.model')}</label>
                <input value={form.model} placeholder="ex: 320"
                  onChange={e => setForm(p => ({ ...p, model: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('equipment.year')}</label>
                <input type="number" min="1990" max="2030" value={form.year} placeholder="ex: 2019"
                  onChange={e => setForm(p => ({ ...p, year: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('equipment.serialNumber')}</label>
                <input value={form.serial_number} placeholder="ex: CAT-320-2019-001"
                  onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('equipment.serviceDue')}</label>
                <input type="date" value={form.service_due}
                  onChange={e => setForm(p => ({ ...p, service_due: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('equipment.itpDue')}</label>
                <input type="date" value={form.itp_due}
                  onChange={e => setForm(p => ({ ...p, itp_due: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('common.notes')}</label>
                <textarea value={form.notes} rows={2}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
                <button type="submit" style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {t('common.save')}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Detail */}
        {!showForm && selected && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {selected.category}
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '4px 0' }}>{selected.name}</h2>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    {[selected.brand, selected.model, selected.year].filter(Boolean).join(' · ')}
                    {selected.serial_number && <span style={{ marginLeft: 8, fontFamily: 'monospace', color: '#94a3b8' }}>#{selected.serial_number}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Status buttons */}
                  {(['active','maintenance','retired'] as const).map(s => (
                    <button key={s} onClick={() => changeStatus(s)} style={{
                      padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      background: selected.status === s ? STATUS_COLORS[s][0] : '#f1f5f9',
                      color: selected.status === s ? STATUS_COLORS[s][1] : '#94a3b8',
                    }}>{STATUS_LABELS[s]}</button>
                  ))}
                  <button onClick={() => setShowMove(!showMove)} style={{
                    padding: '6px 14px', borderRadius: 20, border: '1px solid #22C55E',
                    background: '#fff', color: '#22C55E', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                  }}>{t('equipment.moveEquipment')}</button>
                </div>
              </div>

              {/* Location + due dates */}
              <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t('equipment.currentLocation')}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                    {selected.current_site_name || t('common.noSite')}
                  </div>
                </div>
                {selected.service_due && (
                  <div style={{ background: '#fff', borderRadius: 8, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t('equipment.serviceDue')}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: new Date(selected.service_due) < new Date() ? '#dc2626' : '#1e293b', marginTop: 2 }}>
                      {new Date(selected.service_due).toLocaleDateString(locale)}
                    </div>
                  </div>
                )}
                {selected.itp_due && (
                  <div style={{ background: '#fff', borderRadius: 8, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t('equipment.itpDue')}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: new Date(selected.itp_due) < new Date() ? '#dc2626' : '#1e293b', marginTop: 2 }}>
                      {new Date(selected.itp_due).toLocaleDateString(locale)}
                    </div>
                  </div>
                )}
              </div>

              {selected.notes && (
                <div style={{ marginTop: 12, fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>{selected.notes}</div>
              )}
            </div>

            {/* Move form */}
            {showMove && (
              <form onSubmit={submitMove} style={{
                background: '#eff6ff', borderRadius: 10, padding: 16, marginBottom: 24,
                display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#22C55E', display: 'block', marginBottom: 4 }}>{t('equipment.moveTo')}</label>
                  <select value={moveForm.to_site_id} onChange={e => setMoveForm(p => ({ ...p, to_site_id: e.target.value }))} style={inp}>
                    <option value="">{t('common.noSite')}</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} – {s.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#22C55E', display: 'block', marginBottom: 4 }}>{t('equipment.moveReason')}</label>
                  <input value={moveForm.notes} placeholder={t('common.optional')}
                    onChange={e => setMoveForm(p => ({ ...p, notes: e.target.value }))} style={inp} />
                </div>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: '#22C55E', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  {t('common.confirm')}
                </button>
                <button type="button" onClick={() => setShowMove(false)} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                  ✕
                </button>
              </form>
            )}

            {/* Movement history */}
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 10 }}>
              {t('equipment.movementHistory')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>({movements.length})</span>
            </div>
            <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              {!movements.length ? (
                <div style={{ padding: 20, color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>{t('equipment.noMovements')}</div>
              ) : movements.map(m => (
                <div key={m.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(m.moved_at).toLocaleDateString(locale)}
                  </span>
                  <span style={{ fontSize: 13, flex: 1 }}>
                    <span style={{ color: '#94a3b8' }}>{m.from_site}</span>
                    <span style={{ margin: '0 8px', color: '#22C55E' }}>→</span>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{m.to_site}</span>
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{m.moved_by}</span>
                  {m.notes && <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>{m.notes}</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {!showForm && !selected && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#94a3b8', fontSize: 15 }}>
            {t('equipment.selectEquipment')}
          </div>
        )}
      </div>
    </div>
  );
}
