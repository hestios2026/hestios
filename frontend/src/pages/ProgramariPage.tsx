import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { fetchProgramari, createProgramare, updateProgramare, deleteProgramare } from '../api/programari';
import { fetchSites } from '../api/sites';
import { fetchUsers } from '../api/users';
import { fetchConnectionTypes } from '../api/settings';
import type { Site } from '../types';

interface Programare {
  id: number;
  client_name: string;
  client_phone: string | null;
  address: string;
  city: string | null;
  connection_type: string | null;
  status: 'new' | 'scheduled' | 'in_progress' | 'done' | 'cancelled';
  scheduled_date: string;
  assigned_site_id: number | null;
  assigned_site_name: string | null;
  assigned_team_id: number | null;
  assigned_team_name: string | null;
  notes: string | null;
}

interface AppUser { id: number; full_name: string; role: string; }

const STATUS_COLORS: Record<string, [string, string]> = {
  new:         ['#eff6ff', '#1d4ed8'],
  scheduled:   ['#fef3c7', '#d97706'],
  in_progress: ['#dbeafe', '#2563eb'],
  done:        ['#d1fae5', '#059669'],
  cancelled:   ['#f1f5f9', '#94a3b8'],
};

const DEFAULT_CONN_TYPES = ['Fiber', 'Gas', 'Curent', 'Apă', 'Altele'];

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
};

const today = () => new Date().toISOString().split('T')[0];

export function ProgramariPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const STATUS_KEYS = ['new', 'scheduled', 'in_progress', 'done', 'cancelled'] as const;

  const [items, setItems]       = useState<Programare[]>([]);
  const [sites, setSites]       = useState<Site[]>([]);
  const [users, setUsers]       = useState<AppUser[]>([]);
  const [connTypes, setConnTypes] = useState<string[]>(DEFAULT_CONN_TYPES);
  const [selected, setSelected] = useState<Programare | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterDay, setFilterDay] = useState(today());
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({
    client_name: '', client_phone: '', address: '', city: '', zip_code: '',
    connection_type: 'Fiber', scheduled_date: '', scheduled_time: '08:00',
    assigned_site_id: '', assigned_team_id: '', notes: '',
  });

  const load = async () => {
    const params: Record<string, string> = {};
    if (filterDay) params.day = filterDay;
    if (filterStatus) params.status = filterStatus;
    fetchProgramari(params).then(setItems).catch(() => {});
  };

  useEffect(() => { load(); }, [filterDay, filterStatus]);
  useEffect(() => {
    fetchSites(false).then(setSites).catch(() => {});
    fetchUsers().then(setUsers).catch(() => {});
    fetchConnectionTypes().then(setConnTypes).catch(() => {});
  }, []);

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      const scheduled_date = `${form.scheduled_date}T${form.scheduled_time}:00`;
      const payload: Record<string, unknown> = {
        client_name: form.client_name,
        address: form.address,
        scheduled_date,
      };
      if (form.client_phone)    payload.client_phone    = form.client_phone;
      if (form.city)            payload.city            = form.city;
      if (form.zip_code)        payload.zip_code        = form.zip_code;
      if (form.connection_type) payload.connection_type = form.connection_type;
      if (form.assigned_site_id) payload.assigned_site_id = parseInt(form.assigned_site_id);
      if (form.assigned_team_id) payload.assigned_team_id = parseInt(form.assigned_team_id);
      if (form.notes)           payload.notes           = form.notes;

      await createProgramare(payload);
      toast.success(t('hausanschluss.saved'));
      setShowForm(false);
      setForm({ client_name: '', client_phone: '', address: '', city: '', zip_code: '',
        connection_type: 'Fiber', scheduled_date: '', scheduled_time: '08:00',
        assigned_site_id: '', assigned_team_id: '', notes: '' });
      load();
    } catch { toast.error(t('common.error')); }
  }

  async function changeStatus(item: Programare, status: string) {
    try {
      await updateProgramare(item.id, { status });
      toast.success(t('hausanschluss.statusUpdated'));
      if (selected?.id === item.id) setSelected({ ...item, status: status as Programare['status'] });
      load();
    } catch { toast.error(t('common.error')); }
  }

  async function doDelete(item: Programare) {
    if (!confirm(t('hausanschluss.confirmDelete', { name: item.client_name }))) return;
    try {
      await deleteProgramare(item.id);
      toast.success(t('hausanschluss.deleted'));
      if (selected?.id === item.id) setSelected(null);
      load();
    } catch { toast.error(t('common.error')); }
  }

  // Group by date for calendar-like view
  const grouped: Record<string, Programare[]> = {};
  for (const item of items) {
    const d = item.scheduled_date.split('T')[0];
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(item);
  }

  return (
    <div className="split-layout">

      {/* Left: filters + list */}
      <div className="split-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{t('hausanschluss.title')}</span>
            <button onClick={() => { setShowForm(true); setSelected(null); }} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none',
              background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>+ {t('common.new')}</button>
          </div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="date" value={filterDay} onChange={e => setFilterDay(e.target.value)}
              style={{ ...inp, flex: 1, fontSize: 12 }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ ...inp, width: 110, fontSize: 12 }}>
              <option value="">{t('common.all')}</option>
              {STATUS_KEYS.map(k => <option key={k} value={k}>{t(`hausanschluss.status.${k}`)}</option>)}
            </select>
          </div>
          <button onClick={() => setFilterDay('')} style={{
            marginTop: 6, fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>
            {filterDay
              ? t('hausanschluss.allDays')
              : t('hausanschluss.today', { date: today() })}
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {!items.length && (
            <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>{t('hausanschluss.noSchedules')}</div>
          )}
          {Object.entries(grouped).sort().map(([day, dayItems]) => (
            <div key={day}>
              <div style={{ padding: '6px 16px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>
                {new Date(day + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                <span style={{ marginLeft: 8, color: '#94a3b8', fontWeight: 500 }}>({dayItems.length})</span>
              </div>
              {dayItems.map(item => {
                const [bg, fg] = STATUS_COLORS[item.status];
                const time = item.scheduled_date.split('T')[1]?.slice(0, 5) || '';
                return (
                  <div key={item.id} onClick={() => { setSelected(item); setShowForm(false); }} style={{
                    padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                    background: selected?.id === item.id ? '#eff6ff' : '#fff',
                    borderLeft: selected?.id === item.id ? '3px solid #1d4ed8' : '3px solid transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1d4ed8', fontFamily: 'monospace' }}>{time}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: bg, color: fg }}>
                        {t(`hausanschluss.status.${item.status}`)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.client_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.address}{item.city ? `, ${item.city}` : ''}</div>
                    {item.assigned_team_name && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.assigned_team_name}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Right: form or detail */}
      <div className="split-content page-root">

        {/* Add form */}
        {showForm && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>{t('hausanschluss.newSchedule')}</div>
            <form onSubmit={submitForm} style={{
              background: '#fff', borderRadius: 12, padding: 24, maxWidth: 560,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
            }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('hausanschluss.clientName')} *</label>
                <input required value={form.client_name} onChange={e => f('client_name', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('hausanschluss.clientPhone')}</label>
                <input type="tel" value={form.client_phone} onChange={e => f('client_phone', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('hausanschluss.connectionType')}</label>
                <select value={form.connection_type} onChange={e => f('connection_type', e.target.value)} style={inp}>
                  {connTypes.map(ct => <option key={ct}>{ct}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('common.address')} *</label>
                <input required value={form.address} placeholder={t('common.streetPlaceholder')} onChange={e => f('address', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('hausanschluss.city')}</label>
                <input value={form.city} onChange={e => f('city', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('hausanschluss.zip')}</label>
                <input value={form.zip_code} onChange={e => f('zip_code', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('hausanschluss.scheduledDate')} *</label>
                <input type="date" required value={form.scheduled_date} onChange={e => f('scheduled_date', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('hausanschluss.scheduledTime')} *</label>
                <input type="time" required value={form.scheduled_time} onChange={e => f('scheduled_time', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('hausanschluss.assignedSite')}</label>
                <select value={form.assigned_site_id} onChange={e => f('assigned_site_id', e.target.value)} style={inp}>
                  <option value="">{t('hausanschluss.selectPlaceholder')}</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} – {s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('hausanschluss.assignedTeam')}</label>
                <select value={form.assigned_team_id} onChange={e => f('assigned_team_id', e.target.value)} style={inp}>
                  <option value="">{t('hausanschluss.selectPlaceholder')}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('common.notes')}</label>
                <textarea value={form.notes} rows={2} onChange={e => f('notes', e.target.value)}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
                <button type="submit" style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
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
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                  {selected.connection_type || t('hausanschluss.connectionType')}
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>{selected.client_name}</h2>
                {selected.client_phone && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{selected.client_phone}</div>}
              </div>
              <button onClick={() => doDelete(selected)} style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff',
                color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{t('common.delete')}</button>
            </div>

            {/* Info cards */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ background: '#fff', borderRadius: 8, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t('hausanschluss.detailDate')}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>
                  {new Date(selected.scheduled_date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' '}
                  <span style={{ color: '#1d4ed8' }}>{selected.scheduled_date.split('T')[1]?.slice(0, 5)}</span>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 8, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t('hausanschluss.detailAddress')}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                  {selected.address}{selected.city ? `, ${selected.city}` : ''}
                </div>
              </div>
              {selected.assigned_site_name && (
                <div style={{ background: '#fff', borderRadius: 8, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t('hausanschluss.detailSite')}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>{selected.assigned_site_name}</div>
                </div>
              )}
              {selected.assigned_team_name && (
                <div style={{ background: '#fff', borderRadius: 8, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t('hausanschluss.detailTeam')}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>{selected.assigned_team_name}</div>
                </div>
              )}
            </div>

            {selected.notes && (
              <div style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                {selected.notes}
              </div>
            )}

            {/* Status change */}
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>{t('hausanschluss.updateStatus')}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {STATUS_KEYS.map(k => {
                const [bg, fg] = STATUS_COLORS[k];
                return (
                  <button key={k} onClick={() => changeStatus(selected, k)} style={{
                    padding: '7px 16px', borderRadius: 20, border: '2px solid',
                    borderColor: selected.status === k ? fg : 'transparent',
                    background: selected.status === k ? bg : '#f8fafc',
                    color: selected.status === k ? fg : '#64748b',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>{t(`hausanschluss.status.${k}`)}</button>
                );
              })}
            </div>
          </div>
        )}

        {!showForm && !selected && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#94a3b8', fontSize: 15 }}>
            {t('common.selectLeft')}
          </div>
        )}
      </div>
    </div>
  );
}
