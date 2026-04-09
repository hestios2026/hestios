import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { fetchDailyReports, createDailyReport, updateDailyReport, submitDailyReport, approveDailyReport } from '../api/daily_reports';
import { fetchSites } from '../api/sites';
import { fetchEmployees } from '../api/employees';
import { fetchEquipment } from '../api/equipment';
import type { Site } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DailyReport {
  id: number;
  site_id: number;
  report_date: string;
  created_by: number;
  status: 'draft' | 'submitted' | 'approved';
  weather: string;
  temperature_c: number | null;
  start_time: string;
  end_time: string;
  pause_min: number;
  notes: string | null;
  problems: string | null;
  submitted_at: string | null;
  workers: WorkerRow[];
  positions: PositionRow[];
  equipment: EquipRow[];
  materials: MatRow[];
}

interface WorkerRow   { id?: number; employee_id?: number|null; name: string; hours_worked: number; overtime_hours: number; role: string; absent: boolean; absent_reason: string; }
interface PositionRow { id?: number; position_type: string; description: string; unit: string; quantity: number; extra_data?: Record<string, unknown>|null; }
interface EquipRow    { id?: number; equipment_id?: number|null; name: string; hours_used: number; fuel_liters: number; notes: string; }
interface MatRow      { id?: number; material_name: string; unit: string; quantity: number; notes: string; }

// ─── Constants ───────────────────────────────────────────────────────────────

const POSITION_TYPES = ['Graben', 'Leerrohr', 'Kabelzug', 'HDD', 'Muffe', 'HAK', 'Kernbohrung', 'Hausanschluss', 'Asphalt', 'Pflaster', 'Sonstiges'];
const WEATHER_OPTIONS = ['sonnig', 'bewölkt', 'regen', 'schnee', 'sturm', 'frost'];
const WEATHER_ICONS: Record<string, string> = { sonnig: '☀️', 'bewölkt': '⛅', regen: '🌧', schnee: '❄️', sturm: '🌩', frost: '🧊' };

const STATUS_COLORS: Record<string, [string, string]> = {
  draft:     ['#fef3c7', '#d97706'],
  submitted: ['#dbeafe', '#2563eb'],
  approved:  ['#d1fae5', '#059669'],
};

const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 };
const btn = (bg: string, color = '#fff'): React.CSSProperties => ({ padding: '7px 14px', background: bg, color, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 });
const sectionTitle = (t: string) => (
  <div style={{ gridColumn: '1/-1', borderBottom: '2px solid #e2e8f0', paddingBottom: 4, marginTop: 8, fontWeight: 700, fontSize: 11, color: '#22C55E', textTransform: 'uppercase', letterSpacing: 1 }}>
    {t}
  </div>
);

const EMPTY_WORKER  = (): WorkerRow   => ({ name: '', hours_worked: 8, overtime_hours: 0, role: 'Bauarbeiter', absent: false, absent_reason: '', employee_id: null });
const EMPTY_POS     = (): PositionRow => ({ position_type: 'Graben', description: '', unit: 'm', quantity: 0 });
const EMPTY_EQUIP   = (): EquipRow    => ({ name: '', hours_used: 8, fuel_liters: 0, notes: '', equipment_id: null });
const EMPTY_MAT     = (): MatRow      => ({ material_name: '', unit: 'Stk', quantity: 0, notes: '' });

// ─── Component ───────────────────────────────────────────────────────────────

export function TagesberichtPage({ userRole }: { userRole: string }) {
  const { t } = useTranslation();
  const [reports, setReports]       = useState<DailyReport[]>([]);
  const [sites, setSites]           = useState<Site[]>([]);
  const [employees, setEmployees]   = useState<{ id: number; vorname: string; nachname: string }[]>([]);
  const [equipList, setEquipList]   = useState<{ id: number; name: string }[]>([]);
  const [selected, setSelected]     = useState<DailyReport | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [filterSite, setFilterSite] = useState<number | ''>('');
  const [filterDate, setFilterDate] = useState('');

  // Form state
  const [fSiteId, setFSiteId]       = useState<number | ''>('');
  const [fDate, setFDate]           = useState(new Date().toISOString().slice(0, 10));
  const [fWeather, setFWeather]     = useState('sonnig');
  const [fTemp, setFTemp]           = useState('');
  const [fStart, setFStart]         = useState('07:00');
  const [fEnd, setFEnd]             = useState('16:00');
  const [fPause, setFPause]         = useState(30);
  const [fNotes, setFNotes]         = useState('');
  const [fProblems, setFProblems]   = useState('');
  const [fWorkers, setFWorkers]     = useState<WorkerRow[]>([EMPTY_WORKER()]);
  const [fPositions, setFPositions] = useState<PositionRow[]>([EMPTY_POS()]);
  const [fEquip, setFEquip]         = useState<EquipRow[]>([]);
  const [fMats, setFMats]           = useState<MatRow[]>([]);
  const [formTab, setFormTab]       = useState<'workers' | 'positions' | 'equipment' | 'materials'>('workers');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    load();
    fetchSites().then(d => setSites((d as Site[]).filter((s: Site) => s.is_baustelle)));
    fetchEmployees().then(d => setEmployees(d.filter((e: any) => e.is_active)));
    fetchEquipment().then(d => setEquipList(d));
  }, []);

  function load() {
    const params: Record<string, unknown> = {};
    if (filterSite)  params.site_id = filterSite;
    if (filterDate)  params.report_date = filterDate;
    fetchDailyReports(params).then(setReports).catch(() => toast.error(t('common.error')));
  }

  useEffect(() => { load(); }, [filterSite, filterDate]); // eslint-disable-line react-hooks/exhaustive-deps

  function openNew() {
    setSelected(null);
    setFSiteId('');
    setFDate(new Date().toISOString().slice(0, 10));
    setFWeather('sonnig');
    setFTemp('');
    setFStart('07:00');
    setFEnd('16:00');
    setFPause(30);
    setFNotes('');
    setFProblems('');
    setFWorkers([EMPTY_WORKER()]);
    setFPositions([EMPTY_POS()]);
    setFEquip([]);
    setFMats([]);
    setFormTab('workers');
    setShowForm(true);
  }

  function openEdit(r: DailyReport) {
    setSelected(r);
    setFSiteId(r.site_id);
    setFDate(r.report_date);
    setFWeather(r.weather);
    setFTemp(r.temperature_c !== null ? String(r.temperature_c) : '');
    setFStart(r.start_time);
    setFEnd(r.end_time);
    setFPause(r.pause_min);
    setFNotes(r.notes || '');
    setFProblems(r.problems || '');
    setFWorkers(r.workers.length ? r.workers.map(w => ({ ...w, absent_reason: w.absent_reason || '' })) : [EMPTY_WORKER()]);
    setFPositions(r.positions.length ? r.positions.map(p => ({ ...p, description: p.description || '' })) : [EMPTY_POS()]);
    setFEquip(r.equipment.length ? r.equipment.map(e => ({ ...e, notes: e.notes || '', equipment_id: e.equipment_id || null })) : []);
    setFMats(r.materials.length ? r.materials.map(m => ({ ...m, notes: m.notes || '' })) : []);
    setFormTab('workers');
    setShowForm(true);
  }

  async function save() {
    if (!fSiteId) { toast.error(t('tagesbericht.fieldSite')); return; }
    setSaving(true);
    const payload = {
      site_id: fSiteId,
      report_date: fDate,
      weather: fWeather,
      temperature_c: fTemp !== '' ? parseFloat(fTemp) : null,
      start_time: fStart,
      end_time: fEnd,
      pause_min: fPause,
      notes: fNotes || null,
      problems: fProblems || null,
      workers: fWorkers.filter(w => w.name.trim()),
      positions: fPositions.filter(p => p.quantity > 0),
      equipment: fEquip.filter(e => e.name.trim()),
      materials: fMats.filter(m => m.material_name.trim()),
    };
    try {
      if (selected) {
        await updateDailyReport(selected.id, payload);
        toast.success(t('tagesbericht.saved'));
      } else {
        await createDailyReport(payload);
        toast.success(t('tagesbericht.saved'));
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(r: DailyReport) {
    try {
      await submitDailyReport(r.id);
      toast.success(t('tagesbericht.submitted'));
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('common.error'));
    }
  }

  async function handleApprove(r: DailyReport) {
    try {
      await approveDailyReport(r.id);
      toast.success(t('tagesbericht.approved'));
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('common.error'));
    }
  }

  function siteName(id: number) {
    return sites.find(s => s.id === id)?.name || `KST ${id}`;
  }

  // ── Worker row helpers ─────────────────────────────────────────────────────
  function setWorker(i: number, patch: Partial<WorkerRow>) {
    setFWorkers(ws => ws.map((w, idx) => idx === i ? { ...w, ...patch } : w));
  }
  function addWorkerFromEmployee(empId: number) {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    setFWorkers(ws => [...ws, { ...EMPTY_WORKER(), employee_id: empId, name: `${emp.vorname} ${emp.nachname}` }]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (showForm) return <FormView />;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{t('tagesbericht.title')}</h2>
        <button style={btn('#22C55E')} onClick={openNew}>{t('tagesbericht.newReport')}</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select style={{ ...inp, width: 220 }} value={filterSite} onChange={e => setFilterSite(e.target.value ? Number(e.target.value) : '')}>
          <option value="">{t('tagesbericht.filterSite')}</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" style={{ ...inp, width: 160 }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        {filterDate && <button style={btn('#64748b')} onClick={() => setFilterDate('')}>×</button>}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>{t('tagesbericht.colDate')}</th>
              <th style={th}>{t('tagesbericht.colSite')}</th>
              <th style={th}>{t('tagesbericht.colWeather')}</th>
              <th style={th}>{t('tagesbericht.colWorkers')}</th>
              <th style={th}>{t('tagesbericht.colPositions')}</th>
              <th style={th}>{t('tagesbericht.colStatus')}</th>
              <th style={th}>{t('tagesbericht.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>{t('tagesbericht.noReports')}</td></tr>
            )}
            {reports.map(r => {
              const [bg, fg] = STATUS_COLORS[r.status] || ['#f1f5f9', '#64748b'];
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => openEdit(r)}>
                  <td style={td}><strong>{r.report_date}</strong></td>
                  <td style={td}>{siteName(r.site_id)}</td>
                  <td style={td}>{WEATHER_ICONS[r.weather] || r.weather} {r.temperature_c !== null ? `${r.temperature_c}°C` : ''}</td>
                  <td style={td}>{r.workers.length}</td>
                  <td style={td}>{r.positions.length} ({r.positions.reduce((s, p) => s + p.quantity, 0).toFixed(1)} m/Stk)</td>
                  <td style={td}>
                    <span style={{ background: bg, color: fg, padding: '2px 8px', borderRadius: 12, fontWeight: 700, fontSize: 11 }}>
                      {t(`tagesbericht.status.${r.status}`)}
                    </span>
                  </td>
                  <td style={td} onClick={e => e.stopPropagation()}>
                    {r.status === 'draft' && (
                      <button style={{ ...btn('#2563eb'), fontSize: 11, padding: '4px 10px' }} onClick={() => handleSubmit(r)}>{t('tagesbericht.submitBtn')}</button>
                    )}
                    {r.status === 'submitted' && ['director', 'projekt_leiter'].includes(userRole) && (
                      <button style={{ ...btn('#059669'), fontSize: 11, padding: '4px 10px' }} onClick={() => handleApprove(r)}>{t('tagesbericht.approveBtn')}</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Form ───────────────────────────────────────────────────────────────────
  function FormView() {
    const tabStyle = (active: boolean): React.CSSProperties => ({
      padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400,
      borderBottom: active ? '2px solid #22C55E' : '2px solid transparent',
      color: active ? '#22C55E' : '#64748b', background: 'none', border: 'none',
    });

    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
            {selected ? `Tagesbericht ${selected.report_date}` : `Tagesbericht ${t('common.new')}`}
          </h2>
          <button style={btn('#64748b')} onClick={() => setShowForm(false)}>{t('tagesbericht.back')}</button>
        </div>

        {/* Base info */}
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div>
              <label style={lbl}>{t('tagesbericht.fieldSite')} *</label>
              <select style={inp} value={fSiteId} onChange={e => setFSiteId(Number(e.target.value))} disabled={!!selected}>
                <option value="">— {t('common.select')} —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{t('tagesbericht.fieldDate')} *</label>
              <input type="date" style={inp} value={fDate} onChange={e => setFDate(e.target.value)} disabled={!!selected} />
            </div>
            <div>
              <label style={lbl}>{t('tagesbericht.fieldWeather')}</label>
              <select style={inp} value={fWeather} onChange={e => setFWeather(e.target.value)}>
                {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{WEATHER_ICONS[w]} {w}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{t('tagesbericht.fieldTemp')}</label>
              <input style={inp} type="number" value={fTemp} onChange={e => setFTemp(e.target.value)} placeholder="e.g. 12" />
            </div>
            <div>
              <label style={lbl}>{t('tagesbericht.fieldStart')}</label>
              <input style={inp} type="time" value={fStart} onChange={e => setFStart(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>{t('tagesbericht.fieldEnd')}</label>
              <input style={inp} type="time" value={fEnd} onChange={e => setFEnd(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>{t('tagesbericht.fieldPause')}</label>
              <input style={inp} type="number" value={fPause} onChange={e => setFPause(Number(e.target.value))} />
            </div>
            <div style={{ gridColumn: '2/4' }}>
              <label style={lbl}>{t('tagesbericht.fieldProblems')}</label>
              <input style={inp} value={fProblems} onChange={e => setFProblems(e.target.value)} placeholder="e.g. Regenwetter, Tiefbau gesperrt..." />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>{t('tagesbericht.fieldNotes')}</label>
              <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={fNotes} onChange={e => setFNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 16px' }}>
            {(['workers', 'positions', 'equipment', 'materials'] as const).map(tab => (
              <button key={tab} style={tabStyle(formTab === tab)} onClick={() => setFormTab(tab)}>
                {tab === 'workers' ? `${t('tagesbericht.tabWorkers')} (${fWorkers.filter(w => w.name).length})` :
                 tab === 'positions' ? `${t('tagesbericht.tabProduction')} (${fPositions.filter(p => p.quantity > 0).length})` :
                 tab === 'equipment' ? `${t('tagesbericht.tabEquipment')} (${fEquip.filter(e => e.name).length})` :
                 `${t('tagesbericht.tabMaterials')} (${fMats.filter(m => m.material_name).length})`}
              </button>
            ))}
          </div>

          <div style={{ padding: 16 }}>
            {/* Workers tab */}
            {formTab === 'workers' && (
              <div>
                <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
                  <select style={{ ...inp, width: 220 }} onChange={e => { if (e.target.value) { addWorkerFromEmployee(Number(e.target.value)); e.target.value = ''; } }}>
                    <option value="">{t('tagesbericht.addWorker')}</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.vorname} {e.nachname}</option>)}
                  </select>
                  <button style={btn('#f1f5f9', '#374151')} onClick={() => setFWorkers(ws => [...ws, EMPTY_WORKER()])}>+ Manual</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={th}>{t('tagesbericht.colWorkerName')}</th><th style={th}>{t('tagesbericht.colRole')}</th><th style={th}>{t('tagesbericht.colHours')}</th><th style={th}>{t('tagesbericht.colOvertime')}</th><th style={th}>{t('tagesbericht.colAbsent')}</th><th style={th}>{t('tagesbericht.colReason')}</th><th style={th}>×</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fWorkers.map((w, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={td}><input style={inp} value={w.name} onChange={e => setWorker(i, { name: e.target.value })} placeholder="Nume complet" /></td>
                        <td style={td}><input style={{ ...inp, width: 100 }} value={w.role} onChange={e => setWorker(i, { role: e.target.value })} /></td>
                        <td style={td}><input style={{ ...inp, width: 70 }} type="number" step="0.5" value={w.hours_worked} onChange={e => setWorker(i, { hours_worked: parseFloat(e.target.value) })} /></td>
                        <td style={td}><input style={{ ...inp, width: 70 }} type="number" step="0.5" value={w.overtime_hours} onChange={e => setWorker(i, { overtime_hours: parseFloat(e.target.value) })} /></td>
                        <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={w.absent} onChange={e => setWorker(i, { absent: e.target.checked })} /></td>
                        <td style={td}><input style={inp} value={w.absent_reason} onChange={e => setWorker(i, { absent_reason: e.target.value })} disabled={!w.absent} placeholder="Krank/Urlaub..." /></td>
                        <td style={td}><button style={{ ...btn('#fee2e2', '#dc2626'), padding: '3px 8px' }} onClick={() => setFWorkers(ws => ws.filter((_, idx) => idx !== i))}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Positions tab */}
            {formTab === 'positions' && (
              <div>
                <button style={{ ...btn('#f1f5f9', '#374151'), marginBottom: 10 }} onClick={() => setFPositions(ps => [...ps, EMPTY_POS()])}>{t('tagesbericht.addPosition')}</button>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={th}>{t('tagesbericht.colPosType')}</th><th style={th}>{t('tagesbericht.colDescription')}</th><th style={th}>{t('tagesbericht.colUnit')}</th><th style={th}>{t('tagesbericht.colQty')}</th><th style={th}>×</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fPositions.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={td}>
                          <select style={inp} value={p.position_type} onChange={e => setFPositions(ps => ps.map((x, idx) => idx === i ? { ...x, position_type: e.target.value } : x))}>
                            {POSITION_TYPES.map(pt => <option key={pt}>{pt}</option>)}
                          </select>
                        </td>
                        <td style={td}><input style={inp} value={p.description} onChange={e => setFPositions(ps => ps.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Detalii..." /></td>
                        <td style={td}>
                          <select style={{ ...inp, width: 70 }} value={p.unit} onChange={e => setFPositions(ps => ps.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x))}>
                            {['m', 'm²', 'm³', 'Stk', 'h', 't'].map(u => <option key={u}>{u}</option>)}
                          </select>
                        </td>
                        <td style={td}><input style={{ ...inp, width: 90 }} type="number" step="0.1" value={p.quantity} onChange={e => setFPositions(ps => ps.map((x, idx) => idx === i ? { ...x, quantity: parseFloat(e.target.value) } : x))} /></td>
                        <td style={td}><button style={{ ...btn('#fee2e2', '#dc2626'), padding: '3px 8px' }} onClick={() => setFPositions(ps => ps.filter((_, idx) => idx !== i))}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Equipment tab */}
            {formTab === 'equipment' && (
              <div>
                <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
                  <select style={{ ...inp, width: 240 }} onChange={e => {
                    if (!e.target.value) return;
                    const eq = equipList.find(x => x.id === Number(e.target.value));
                    if (eq) setFEquip(es => [...es, { ...EMPTY_EQUIP(), equipment_id: eq.id, name: eq.name }]);
                    e.target.value = '';
                  }}>
                    <option value="">{t('tagesbericht.addEquipment')}</option>
                    {equipList.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <button style={btn('#f1f5f9', '#374151')} onClick={() => setFEquip(es => [...es, EMPTY_EQUIP()])}>+ Manual</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={th}>{t('tagesbericht.colEquipment')}</th><th style={th}>{t('tagesbericht.colHoursUsed')}</th><th style={th}>{t('tagesbericht.colFuel')}</th><th style={th}>{t('tagesbericht.colNotes')}</th><th style={th}>×</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fEquip.map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={td}><input style={inp} value={e.name} onChange={ev => setFEquip(es => es.map((x, idx) => idx === i ? { ...x, name: ev.target.value } : x))} /></td>
                        <td style={td}><input style={{ ...inp, width: 90 }} type="number" step="0.5" value={e.hours_used} onChange={ev => setFEquip(es => es.map((x, idx) => idx === i ? { ...x, hours_used: parseFloat(ev.target.value) } : x))} /></td>
                        <td style={td}><input style={{ ...inp, width: 90 }} type="number" step="0.5" value={e.fuel_liters} onChange={ev => setFEquip(es => es.map((x, idx) => idx === i ? { ...x, fuel_liters: parseFloat(ev.target.value) } : x))} /></td>
                        <td style={td}><input style={inp} value={e.notes} onChange={ev => setFEquip(es => es.map((x, idx) => idx === i ? { ...x, notes: ev.target.value } : x))} /></td>
                        <td style={td}><button style={{ ...btn('#fee2e2', '#dc2626'), padding: '3px 8px' }} onClick={() => setFEquip(es => es.filter((_, idx) => idx !== i))}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Materials tab */}
            {formTab === 'materials' && (
              <div>
                <button style={{ ...btn('#f1f5f9', '#374151'), marginBottom: 10 }} onClick={() => setFMats(ms => [...ms, EMPTY_MAT()])}>{t('tagesbericht.addMaterial')}</button>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={th}>{t('tagesbericht.colMaterial')}</th><th style={th}>{t('tagesbericht.colUnit')}</th><th style={th}>{t('tagesbericht.colQty')}</th><th style={th}>{t('tagesbericht.colNotes')}</th><th style={th}>×</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fMats.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={td}><input style={inp} value={m.material_name} onChange={e => setFMats(ms => ms.map((x, idx) => idx === i ? { ...x, material_name: e.target.value } : x))} placeholder="e.g. Leerrohr 40mm" /></td>
                        <td style={td}>
                          <select style={{ ...inp, width: 80 }} value={m.unit} onChange={e => setFMats(ms => ms.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x))}>
                            {['Stk', 'm', 'kg', 't', 'L', 'm²', 'm³'].map(u => <option key={u}>{u}</option>)}
                          </select>
                        </td>
                        <td style={td}><input style={{ ...inp, width: 90 }} type="number" step="0.1" value={m.quantity} onChange={e => setFMats(ms => ms.map((x, idx) => idx === i ? { ...x, quantity: parseFloat(e.target.value) } : x))} /></td>
                        <td style={td}><input style={inp} value={m.notes} onChange={e => setFMats(ms => ms.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))} /></td>
                        <td style={td}><button style={{ ...btn('#fee2e2', '#dc2626'), padding: '3px 8px' }} onClick={() => setFMats(ms => ms.filter((_, idx) => idx !== i))}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btn('#64748b')} onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          <button style={btn('#22C55E')} onClick={save} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</button>
        </div>
      </div>
    );
  }
}

// ─── Table cell styles ────────────────────────────────────────────────────────
const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#64748b', borderBottom: '1px solid #e2e8f0' };
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' };
