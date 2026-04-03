import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import toast from 'react-hot-toast';
import { fetchEmployees, createEmployee, updateEmployee } from '../api/employees';
import {
  fetchWeeklySummary, importTimesheetExcel,
  fetchLeaves, createLeave, approveLeave, rejectLeave,
  fetchPayroll, calculatePayroll, lockPayroll, downloadDatevExport,
} from '../api/timesheets';
import { downloadArbeitsvertrag } from '../api/contracts';
import type { User } from '../types';

interface Props { user: User; }

interface Employee {
  id: number;
  vorname: string;
  nachname: string;
  geburtsdatum: string;
  geburtsort: string | null;
  geburtsname: string | null;
  geschlecht: string | null;
  email: string | null;
  plz: string | null;
  adresse: string | null;
  heimatadresse: string | null;
  telefon: string | null;
  nationalitaet: string | null;
  notfallkontakt_name: string | null;
  notfallkontakt_telefon: string | null;
  reisepassnummer: string | null;
  reisepass_ablauf: string | null;
  befristung_bis: string | null;
  probezeit_end: string | null;
  familienstand: string | null;
  kinder: boolean;
  kinder_anzahl: number;
  kinder_pflegev: number;
  konfession: string | null;
  schulabschluss: string | null;
  berufsausbildung: string | null;
  beschaeftigungsart: string;
  arbeitsbeginn: string;
  taetigkeit: string;
  erlernter_beruf: string | null;
  lohngruppe: number;
  tariflohn: number;
  bauzuschlag: number;
  contract_type: string;
  iban: string | null;
  bic: string | null;
  kreditinstitut: string | null;
  krankenkasse: string | null;
  vorherige_krankenkasse: string | null;
  sozialversicherungsnr: string | null;
  steuer_id: string | null;
  steuerklasse: number;
  rentenversicherungsnr: string | null;
  personalnummer: string | null;
  is_active: boolean;
  notes: string | null;
  stunden_pro_woche?: number;
  urlaubsanspruch_tage?: number;
  soka_bau_nr?: string | null;
}

interface WeekRow {
  employee_id: number;
  employee_name: string;
  personalnummer: string | null;
  taetigkeit: string;
  days: Record<string, { hours_regular: number; hours_overtime: number; entry_type: string }>;
  total_regular: number;
  total_overtime: number;
  total_hours: number;
}

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name?: string;
  leave_type: string;
  date_from: string;
  date_to: string;
  days_count: number | null;
  status: string;
  notes: string | null;
}

interface PayrollRecord {
  id: number;
  employee_id: number;
  employee_name?: string;
  year: number;
  month: number;
  hours_regular: number;
  hours_overtime: number;
  hours_night: number;
  hours_sick: number;
  hours_vacation: number;
  days_worked: number;
  brutto_regular: number;
  brutto_overtime: number;
  brutto_night: number;
  brutto_bauzuschlag: number;
  brutto_total: number;
  ag_sv_anteil: number;
  soka_bau: number;
  total_employer_cost: number;
  status: string;
}

const EMPTY_FORM = {
  // Personal
  vorname: '', nachname: '', geburtsdatum: '', geburtsort: '', geburtsname: '',
  geschlecht: 'männlich', email: '', plz: '', adresse: '', heimatadresse: '',
  nationalitaet: '', familienstand: '', kinder: false, kinder_anzahl: 0, kinder_pflegev: 0,
  konfession: '', schulabschluss: '', berufsausbildung: '',
  telefon: '', notfallkontakt_name: '', notfallkontakt_telefon: '',
  reisepassnummer: '', reisepass_ablauf: '',
  // Angajare
  beschaeftigungsart: 'Hauptbeschäftigung',
  arbeitsbeginn: '', taetigkeit: 'Bauarbeiter', erlernter_beruf: '',
  lohngruppe: 1, tariflohn: '' as string | number, bauzuschlag: 0.72,
  contract_type: 'unbefristet', stunden_pro_woche: 40, probezeit_end: '',
  befristung_bis: '', urlaubsanspruch_tage: 30, personalnummer: '',
  // Financiar
  iban: '', bic: '', kreditinstitut: '',
  krankenkasse: '', vorherige_krankenkasse: '',
  sozialversicherungsnr: '', steuer_id: '', steuerklasse: 1,
  rentenversicherungsnr: '', soka_bau_nr: '',
  notes: '',
};

type FormState = typeof EMPTY_FORM;

const DAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const LEAVE_TYPES: Record<string, string> = {
  urlaub: 'Urlaub', krank: 'Krank', unbezahlt: 'Unbezahlt',
  sonderurlaub: 'Sonderurlaub', berufsschule: 'Berufsschule',
};

const LEAVE_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:  { bg: '#fef3c7', color: '#d97706' },
  approved: { bg: '#d1fae5', color: '#059669' },
  rejected: { bg: '#fee2e2', color: '#dc2626' },
};

function getMonthName(month: number): string {
  return new Date(2000, month - 1).toLocaleString(i18n.language, { month: 'long' });
}

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4,
};
const sectionHdr = (title: string) => (
  <div style={{ gridColumn: '1/-1', marginTop: 8, paddingBottom: 6, borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 12, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 1 }}>
    {title}
  </div>
);

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);
}

function getWeekDates(week: number, year: number): Date[] {
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (week - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateFmt(d: Date) { return d.toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit' }); }

export function HRPage({ user }: Props) {
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState<'angajati' | 'pontaj' | 'concedii' | 'salarii'>('angajati');

  // ── Angajați state ──────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected]   = useState<Employee | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [formTab, setFormTab]     = useState<'personal' | 'angajare' | 'financiar'>('personal');
  const [filter, setFilter]       = useState('');

  // ── Pontaj state ────────────────────────────────────────────────────────────
  const now = new Date();
  const [pontajWeek, setPontajWeek] = useState(getISOWeek(now));
  const [pontajYear, setPontajYear] = useState(now.getFullYear());
  const [weekRows, setWeekRows]     = useState<WeekRow[]>([]);
  const [pontajLoading, setPontajLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Concedii state ──────────────────────────────────────────────────────────
  const [leaves, setLeaves]           = useState<LeaveRequest[]>([]);
  const [leaveFilter, setLeaveFilter] = useState<string>('');
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    employee_id: '', leave_type: 'urlaub', date_from: '', date_to: '', notes: '',
  });

  // ── Salarii state ───────────────────────────────────────────────────────────
  const [salYear, setSalYear]   = useState(now.getFullYear());
  const [salMonth, setSalMonth] = useState(now.getMonth() + 1);
  const [payroll, setPayroll]   = useState<PayrollRecord[]>([]);
  const [salLoading, setSalLoading] = useState(false);

  useEffect(() => {
    fetchEmployees().then(setEmployees).catch(() => {});
  }, []);

  // ── Pontaj load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mainTab !== 'pontaj') return;
    setPontajLoading(true);
    fetchWeeklySummary(pontajWeek, pontajYear)
      .then(setWeekRows)
      .catch(() => { toast.error(t('common.error')); })
      .finally(() => setPontajLoading(false));
  }, [mainTab, pontajWeek, pontajYear]);

  // ── Concedii load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mainTab !== 'concedii') return;
    fetchLeaves(leaveFilter ? { status: leaveFilter } : {}).then(setLeaves).catch(() => {});
  }, [mainTab, leaveFilter]);

  // ── Salarii load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mainTab !== 'salarii') return;
    setSalLoading(true);
    fetchPayroll(salYear, salMonth).then(setPayroll).catch(() => {}).finally(() => setSalLoading(false));
  }, [mainTab, salYear, salMonth]);

  // ── Employee form ───────────────────────────────────────────────────────────
  const f = (key: keyof FormState, val: unknown) => setForm(p => ({ ...p, [key]: val }));

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {
        vorname: form.vorname, nachname: form.nachname,
        geburtsdatum: form.geburtsdatum, arbeitsbeginn: form.arbeitsbeginn,
        tariflohn: parseFloat(form.tariflohn as string),
        lohngruppe: Number(form.lohngruppe), steuerklasse: Number(form.steuerklasse),
        kinder_anzahl: Number(form.kinder_anzahl), bauzuschlag: Number(form.bauzuschlag),
        kinder: form.kinder, taetigkeit: form.taetigkeit,
        beschaeftigungsart: form.beschaeftigungsart, contract_type: form.contract_type,
      };
      const optStr = [
        'geburtsort','geburtsname','geschlecht','email','plz','adresse','heimatadresse',
        'nationalitaet','familienstand','konfession','schulabschluss','berufsausbildung',
        'erlernter_beruf','telefon','notfallkontakt_name','notfallkontakt_telefon',
        'reisepassnummer','reisepass_ablauf','probezeit_end','befristung_bis',
        'iban','bic','kreditinstitut','krankenkasse','vorherige_krankenkasse',
        'sozialversicherungsnr','steuer_id','rentenversicherungsnr','personalnummer',
        'soka_bau_nr','notes',
      ];
      for (const k of optStr) {
        if ((form as Record<string, unknown>)[k]) payload[k] = (form as Record<string, unknown>)[k];
      }
      payload.kinder_pflegev = Number(form.kinder_pflegev);
      payload.stunden_pro_woche = Number(form.stunden_pro_woche);
      payload.urlaubsanspruch_tage = Number(form.urlaubsanspruch_tage);
      await createEmployee(payload);
      toast.success(t('hr.employeeCreated'));
      const updated = await fetchEmployees();
      setEmployees(updated);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setFormTab('personal');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : t('common.error'));
    }
  }

  async function toggleActive(emp: Employee) {
    try {
      await updateEmployee(emp.id, { is_active: !emp.is_active });
      const updated = await fetchEmployees();
      setEmployees(updated);
      setSelected(updated.find((e: Employee) => e.id === emp.id) || null);
    } catch { toast.error(t('common.error')); }
  }

  async function handleDownloadContract(emp: Employee) {
    try {
      await downloadArbeitsvertrag(emp.id, `Arbeitsvertrag_${emp.nachname}_${emp.vorname}.docx`);
      toast.success(t('common.success'));
    } catch { toast.error(t('common.error')); }
  }

  // ── Pontaj import ─────────────────────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await importTimesheetExcel(file, pontajWeek, pontajYear);
      toast.success(t('common.success'));
      const rows = await fetchWeeklySummary(pontajWeek, pontajYear);
      setWeekRows(rows);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ── Leave form ─────────────────────────────────────────────────────────────
  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createLeave({
        employee_id: Number(leaveForm.employee_id),
        leave_type: leaveForm.leave_type,
        date_from: leaveForm.date_from,
        date_to: leaveForm.date_to,
        notes: leaveForm.notes || undefined,
      });
      toast.success(t('hr.leaveSaved'));
      setShowLeaveForm(false);
      setLeaveForm({ employee_id: '', leave_type: 'urlaub', date_from: '', date_to: '', notes: '' });
      const updated = await fetchLeaves(leaveFilter ? { status: leaveFilter } : {});
      setLeaves(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    }
  }

  async function handleLeaveAction(id: number, action: 'approve' | 'reject') {
    try {
      if (action === 'approve') await approveLeave(id);
      else await rejectLeave(id);
      toast.success(action === 'approve' ? t('hr.leaveStatus.approved') : t('hr.leaveStatus.rejected'));
      const updated = await fetchLeaves(leaveFilter ? { status: leaveFilter } : {});
      setLeaves(updated);
    } catch { toast.error(t('common.error')); }
  }

  // ── Payroll ────────────────────────────────────────────────────────────────
  async function handleCalculatePayroll() {
    try {
      setSalLoading(true);
      const result = await calculatePayroll(salYear, salMonth);
      toast.success(t('common.success'));
      const updated = await fetchPayroll(salYear, salMonth);
      setPayroll(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    } finally { setSalLoading(false); }
  }

  async function handleLockPayroll(id: number) {
    try {
      await lockPayroll(id);
      toast.success(t('hr.payrollLocked'));
      const updated = await fetchPayroll(salYear, salMonth);
      setPayroll(updated);
    } catch { toast.error(t('common.error')); }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const filtered = employees.filter(e =>
    !filter ||
    `${e.vorname} ${e.nachname}`.toLowerCase().includes(filter.toLowerCase()) ||
    (e.personalnummer || '').toLowerCase().includes(filter.toLowerCase())
  );

  const tabBtn = (key: typeof formTab, label: string) => (
    <button type="button" onClick={() => setFormTab(key)} style={{
      padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
      fontWeight: formTab === key ? 700 : 500,
      background: formTab === key ? '#fff' : 'transparent',
      color: formTab === key ? '#1d4ed8' : '#64748b',
      boxShadow: formTab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    }}>{label}</button>
  );

  const mainTabBtn = (key: typeof mainTab, label: string) => (
    <button onClick={() => setMainTab(key)} style={{
      padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: mainTab === key ? 700 : 500,
      background: mainTab === key ? '#1d4ed8' : 'transparent',
      color: mainTab === key ? '#fff' : '#64748b',
      borderRadius: 6,
    }}>{label}</button>
  );

  const weekDates = getWeekDates(pontajWeek, pontajYear);

  const ENTRY_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
    work:     { bg: '#fff', color: '#1e293b' },
    sick:     { bg: '#fef9c3', color: '#854d0e' },
    vacation: { bg: '#dbeafe', color: '#1e40af' },
    holiday:  { bg: '#ede9fe', color: '#6d28d9' },
    absent:   { bg: '#fee2e2', color: '#dc2626' },
    training: { bg: '#d1fae5', color: '#065f46' },
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>

      {/* Top bar with main tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4, height: 48, flexShrink: 0 }}>
        {mainTabBtn('angajati', t('hr.tabs.employees'))}
        {mainTabBtn('pontaj',   t('hr.tabs.timesheets'))}
        {mainTabBtn('concedii', t('hr.tabs.leaves'))}
        {mainTabBtn('salarii',  t('hr.tabs.payroll'))}
      </div>

      {/* ── ANGAJAȚI ─────────────────────────────────────────────────────────── */}
      {mainTab === 'angajati' && (
        <div className="split-layout" style={{ flex: 1 }}>
          {/* Left list */}
          <div className="split-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>
                  {t('hr.tabs.employees')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>({employees.filter(e => e.is_active).length} {t('common.active').toLowerCase()})</span>
                </span>
                <button onClick={() => { setShowForm(true); setSelected(null); setFormTab('personal'); }} style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none',
                  background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}>+ {t('common.new')}</button>
              </div>
              <input placeholder={t('hr.searchPlaceholder')} value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inp, fontSize: 12 }} />
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {filtered.map(e => (
                <div key={e.id} onClick={() => { setSelected(e); setShowForm(false); }} style={{
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                  background: selected?.id === e.id ? '#eff6ff' : '#fff',
                  borderLeft: selected?.id === e.id ? '3px solid #1d4ed8' : '3px solid transparent',
                  opacity: e.is_active ? 1 : 0.5,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{e.nachname} {e.vorname}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{e.taetigkeit}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: e.is_active ? '#d1fae5' : '#f1f5f9', color: e.is_active ? '#059669' : '#94a3b8' }}>
                      {e.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>LG {e.lohngruppe} · €{e.tariflohn.toFixed(2)}/h</span>
                  </div>
                </div>
              ))}
              {!filtered.length && (
                <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>
                  {filter ? t('common.noResults') : t('hr.noEmployees')}
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="split-content page-root">

            {/* New employee form */}
            {showForm && (
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>{t('hr.addEmployee')}</div>
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 4, width: 'fit-content', marginBottom: 20 }}>
                  {tabBtn('personal', t('hr.tabs.personal'))}
                  {tabBtn('angajare', t('hr.tabs.employment'))}
                  {tabBtn('financiar', t('hr.tabs.financial'))}
                </div>
                <form onSubmit={submitForm} style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {formTab === 'personal' && <>
                      {sectionHdr(t('hr.sections.identity'))}
                      <div><label style={lbl}>{t('hr.firstName')} *</label><input required value={form.vorname} onChange={e => f('vorname', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>{t('hr.lastName')} *</label><input required value={form.nachname} onChange={e => f('nachname', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>Geburtsname (Mädchenname)</label><input value={form.geburtsname} onChange={e => f('geburtsname', e.target.value)} style={inp} /></div>
                      <div>
                        <label style={lbl}>Geschlecht</label>
                        <select value={form.geschlecht} onChange={e => f('geschlecht', e.target.value)} style={inp}>
                          <option value="männlich">männlich</option>
                          <option value="weiblich">weiblich</option>
                          <option value="divers">divers</option>
                          <option value="unbestimmt">unbestimmt</option>
                        </select>
                      </div>
                      <div><label style={lbl}>{t('hr.dateOfBirth')} *</label><input type="date" required value={form.geburtsdatum} onChange={e => f('geburtsdatum', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>{t('hr.placeOfBirth')}</label><input value={form.geburtsort} onChange={e => f('geburtsort', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>Nationalität</label><input value={form.nationalitaet} onChange={e => f('nationalitaet', e.target.value)} style={inp} /></div>
                      <div>
                        <label style={lbl}>{t('hr.maritalStatus')}</label>
                        <select value={form.familienstand} onChange={e => f('familienstand', e.target.value)} style={inp}>
                          <option value="">—</option>
                          <option>ledig</option><option>verheiratet</option><option>geschieden</option><option>verwitwet</option>
                        </select>
                      </div>

                      {sectionHdr('Kontakt & Adresse')}
                      <div><label style={lbl}>E-Mail</label><input type="email" value={form.email} onChange={e => f('email', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>Telefon (WhatsApp)</label><input value={form.telefon} placeholder="+49..." onChange={e => f('telefon', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>PLZ</label><input value={form.plz} placeholder="z.B. 73230" onChange={e => f('plz', e.target.value)} style={inp} /></div>
                      <div style={{ gridColumn: '1/-1' }}><label style={lbl}>{t('common.address')} (DE)</label><input value={form.adresse} placeholder="Straße, Nr., PLZ, Ort" onChange={e => f('adresse', e.target.value)} style={inp} /></div>
                      <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Heimatadresse (Herkunftsland)</label><input value={form.heimatadresse} placeholder={t('common.homeAddress')} onChange={e => f('heimatadresse', e.target.value)} style={inp} /></div>

                      {sectionHdr('Notfallkontakt')}
                      <div><label style={lbl}>Name</label><input value={form.notfallkontakt_name} onChange={e => f('notfallkontakt_name', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>Telefon</label><input value={form.notfallkontakt_telefon} onChange={e => f('notfallkontakt_telefon', e.target.value)} style={inp} /></div>

                      {sectionHdr('Reisedokumente / A1')}
                      <div><label style={lbl}>Reisepassnummer</label><input value={form.reisepassnummer} onChange={e => f('reisepassnummer', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>Reisepass gültig bis</label><input type="date" value={form.reisepass_ablauf} onChange={e => f('reisepass_ablauf', e.target.value)} style={inp} /></div>

                      {sectionHdr('Familie & Konfession')}
                      <div>
                        <label style={lbl}>{t('hr.children')}</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="checkbox" checked={form.kinder} onChange={e => f('kinder', e.target.checked)} style={{ width: 16, height: 16 }} />
                          <span style={{ fontSize: 13 }}>{t('common.yes')}, {t('hr.childrenCount')}:</span>
                          <input type="number" min="0" max="20" value={form.kinder_anzahl} onChange={e => f('kinder_anzahl', parseInt(e.target.value) || 0)} style={{ ...inp, width: 70 }} disabled={!form.kinder} />
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>Kinder unter 25 (Pflegevers.)</label>
                        <input type="number" min="0" max="20" value={form.kinder_pflegev} onChange={e => f('kinder_pflegev', parseInt(e.target.value) || 0)} style={inp} />
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Für BKK Mitgliedsantrag Pflegeversicherungsbeitrag</span>
                      </div>
                      <div><label style={lbl}>{t('hr.confession')}</label><input value={form.konfession} placeholder="ex: ev, rk, —" onChange={e => f('konfession', e.target.value)} style={inp} /></div>

                      {sectionHdr(t('hr.sections.education'))}
                      <div><label style={lbl}>{t('hr.education')}</label><input value={form.schulabschluss} onChange={e => f('schulabschluss', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>{t('hr.qualification')}</label><input value={form.berufsausbildung} onChange={e => f('berufsausbildung', e.target.value)} style={inp} /></div>
                    </>}

                    {formTab === 'angajare' && <>
                      {sectionHdr(t('hr.contract'))}
                      <div><label style={lbl}>{t('hr.startDate')} *</label><input type="date" required value={form.arbeitsbeginn} onChange={e => f('arbeitsbeginn', e.target.value)} style={inp} /></div>
                      <div>
                        <label style={lbl}>{t('hr.contractType')}</label>
                        <select value={form.contract_type} onChange={e => f('contract_type', e.target.value)} style={inp}>
                          <option value="unbefristet">{t('hr.contractUnlimited')}</option>
                          <option value="befristet">{t('hr.contractFixed')}</option>
                          <option value="minijob">Minijob</option>
                        </select>
                      </div>
                      {form.contract_type === 'befristet' && (
                        <div><label style={lbl}>Befristung bis</label><input type="date" value={form.befristung_bis || ''} onChange={e => f('befristung_bis', e.target.value)} style={inp} /></div>
                      )}
                      <div>
                        <label style={lbl}>{t('hr.employmentType')}</label>
                        <select value={form.beschaeftigungsart} onChange={e => f('beschaeftigungsart', e.target.value)} style={inp}>
                          <option>Hauptbeschäftigung</option><option>Nebenbeschäftigung</option>
                        </select>
                      </div>
                      <div><label style={lbl}>Stunden/Woche</label><input type="number" step="0.5" min="1" max="60" value={form.stunden_pro_woche} onChange={e => f('stunden_pro_woche', parseFloat(e.target.value) || 40)} style={inp} /></div>
                      <div><label style={lbl}>Probezeit bis</label><input type="date" value={form.probezeit_end} onChange={e => f('probezeit_end', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>Urlaubsanspruch (Tage/Jahr)</label><input type="number" min="0" max="365" value={form.urlaubsanspruch_tage} onChange={e => f('urlaubsanspruch_tage', parseInt(e.target.value) || 30)} style={inp} /></div>
                      <div><label style={lbl}>{t('hr.jobTitle')}</label><input value={form.taetigkeit} onChange={e => f('taetigkeit', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>{t('hr.learnedProfession')}</label><input value={form.erlernter_beruf} onChange={e => f('erlernter_beruf', e.target.value)} style={inp} /></div>
                      {sectionHdr(t('hr.tabs.payroll'))}
                      <div>
                        <label style={lbl}>{t('hr.wageGroup')}</label>
                        <select value={form.lohngruppe} onChange={e => f('lohngruppe', parseInt(e.target.value))} style={inp}>
                          {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>Tariflohn (€/h) *</label><input type="number" step="0.01" min="0" required value={form.tariflohn} onChange={e => f('tariflohn', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>Bauzuschlag (€/h)</label><input type="number" step="0.01" min="0" value={form.bauzuschlag} onChange={e => f('bauzuschlag', parseFloat(e.target.value) || 0)} style={inp} /></div>
                      {sectionHdr('Administration')}
                      <div><label style={lbl}>{t('hr.personnelNr')}</label><input value={form.personalnummer} onChange={e => f('personalnummer', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>SOKA-BAU Nummer</label><input value={form.soka_bau_nr || ''} onChange={e => f('soka_bau_nr', e.target.value)} style={inp} /></div>
                    </>}

                    {formTab === 'financiar' && <>
                      {sectionHdr(t('hr.sections.bank'))}
                      <div style={{ gridColumn: '1/-1' }}><label style={lbl}>{t('hr.iban')}</label><input value={form.iban} placeholder="DE..." onChange={e => f('iban', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>{t('hr.bic')}</label><input value={form.bic} onChange={e => f('bic', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>{t('hr.bankName')}</label><input value={form.kreditinstitut} onChange={e => f('kreditinstitut', e.target.value)} style={inp} /></div>
                      {sectionHdr(t('hr.sections.fiscal'))}
                      <div>
                        <label style={lbl}>{t('hr.taxClass')}</label>
                        <select value={form.steuerklasse} onChange={e => f('steuerklasse', parseInt(e.target.value))} style={inp}>
                          {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>{t('hr.taxId')}</label><input value={form.steuer_id} onChange={e => f('steuer_id', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>{t('hr.socialNr')}</label><input value={form.sozialversicherungsnr} onChange={e => f('sozialversicherungsnr', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>{t('hr.pensionNr')}</label><input value={form.rentenversicherungsnr} onChange={e => f('rentenversicherungsnr', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>Krankenkasse</label><input value={form.krankenkasse} onChange={e => f('krankenkasse', e.target.value)} style={inp} /></div>
                      <div><label style={lbl}>Vorherige Krankenkasse</label><input value={form.vorherige_krankenkasse || ''} onChange={e => f('vorherige_krankenkasse', e.target.value)} style={inp} /><span style={{ fontSize: 11, color: '#94a3b8' }}>Für BKK Mitgliedsantrag</span></div>
                      {sectionHdr(t('common.notes'))}
                      <div style={{ gridColumn: '1/-1' }}><textarea value={form.notes} rows={3} onChange={e => f('notes', e.target.value)} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} /></div>
                    </>}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {formTab !== 'personal' && (
                        <button type="button" onClick={() => setFormTab(formTab === 'financiar' ? 'angajare' : 'personal')} style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>← {t('common.back')}</button>
                      )}
                      {formTab !== 'financiar' && (
                        <button type="button" onClick={() => setFormTab(formTab === 'personal' ? 'angajare' : 'financiar')} style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: '#e0e7ff', color: '#1d4ed8', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t('common.next')} →</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t('common.save')}</button>
                      <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>{t('common.cancel')}</button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Employee detail */}
            {!showForm && selected && (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>{selected.nachname} {selected.vorname}</h2>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{selected.taetigkeit} · LG {selected.lohngruppe}</div>
                    {selected.personalnummer && <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>#{selected.personalnummer}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleDownloadContract(selected)} style={{
                      padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11,
                      background: '#dbeafe', color: '#1d4ed8',
                    }}>{t('hr.downloadContract')}</button>
                    <button onClick={() => toggleActive(selected)} style={{
                      padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11,
                      background: selected.is_active ? '#fee2e2' : '#d1fae5', color: selected.is_active ? '#dc2626' : '#059669',
                    }}>{selected.is_active ? t('common.inactive') : t('common.active')}</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                  {[
                    ['Tariflohn', `€${selected.tariflohn.toFixed(2)}/h`],
                    ['Bauzuschlag', `€${selected.bauzuschlag.toFixed(2)}/h`],
                    ['Total/h', `€${(selected.tariflohn + selected.bauzuschlag).toFixed(2)}`],
                    ['Steuerklasse', selected.steuerklasse],
                    [t('hr.startDate'), new Date(selected.arbeitsbeginn).toLocaleDateString(i18n.language)],
                    [t('hr.contract'), selected.contract_type === 'unbefristet' ? t('hr.contractUnlimited') : selected.contract_type === 'befristet' ? t('hr.contractFixed') : 'Minijob'],
                  ].map(([label, val]) => (
                    <div key={label as string} style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 12 }}>{t('hr.sections.personalData')}</div>
                    {[
                      [t('hr.dateOfBirth'), selected.geburtsdatum ? new Date(selected.geburtsdatum).toLocaleDateString(i18n.language) : '—'],
                      [t('hr.placeOfBirth'), selected.geburtsort || '—'],
                      ...(selected.geburtsname ? [['Geburtsname', selected.geburtsname]] : []),
                      ...(selected.geschlecht ? [['Geschlecht', selected.geschlecht]] : []),
                      ...(selected.email ? [['E-Mail', selected.email]] : []),
                      ...(selected.telefon ? [['Telefon', selected.telefon]] : []),
                      [t('common.address'), selected.adresse || '—'],
                      [t('hr.nationality'), selected.nationalitaet || '—'],
                      [t('hr.maritalStatus'), selected.familienstand || '—'],
                      [t('hr.children'), selected.kinder ? `${t('common.yes')} (${selected.kinder_anzahl})` : t('common.no')],
                      ...(selected.kinder_pflegev ? [['Kinder u. 25 (Pflegev.)', String(selected.kinder_pflegev)]] : []),
                      [t('hr.confession'), selected.konfession || '—'],
                      ...(selected.reisepassnummer ? [['Reisepass Nr.', selected.reisepassnummer]] : []),
                      ...(selected.notfallkontakt_name ? [['Notfallkontakt', `${selected.notfallkontakt_name}${selected.notfallkontakt_telefon ? ' · ' + selected.notfallkontakt_telefon : ''}`]] : []),
                    ].map(([k, v]) => (
                      <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
                        <span style={{ color: '#64748b' }}>{k}</span>
                        <span style={{ fontWeight: 600, color: '#1e293b', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 12 }}>{t('hr.sections.fiscalBank')}</div>
                    {[
                      [t('hr.iban'), selected.iban || '—'],
                      [t('hr.bankName'), selected.kreditinstitut || '—'],
                      ['Krankenkasse', selected.krankenkasse || '—'],
                      ...(selected.vorherige_krankenkasse ? [['Vorh. Krankenkasse', selected.vorherige_krankenkasse]] : []),
                      [t('hr.taxId'), selected.steuer_id || '—'],
                      ['SV-Nr.', selected.sozialversicherungsnr || '—'],
                      ['Rentenvers.-Nr.', selected.rentenversicherungsnr || '—'],
                    ].map(([k, v]) => (
                      <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
                        <span style={{ color: '#64748b' }}>{k}</span>
                        <span style={{ fontWeight: 600, color: '#1e293b', fontFamily: (k as string).includes('IBAN') || (k as string).includes('Nr') ? 'monospace' : 'inherit', fontSize: 12 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.notes && (
                  <div style={{ marginTop: 16, background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                    {selected.notes}
                  </div>
                )}
              </div>
            )}

            {!showForm && !selected && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#94a3b8', fontSize: 15 }}>
                {t('hr.selectEmployee')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PONTAJ ───────────────────────────────────────────────────────────── */}
      {mainTab === 'pontaj' && (
        <div className="split-content page-root">
          {/* Controls */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{t('hr.weeklyTimesheet')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7 * (getISOWeek(d) - pontajWeek + (pontajYear - d.getFullYear()) * 52)); setPontajWeek(w => { const nw = w - 1; if (nw < 1) { setPontajYear(y => y - 1); return 52; } return nw; }); }} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>←</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', minWidth: 100, textAlign: 'center' }}>KW {pontajWeek} / {pontajYear}</span>
              <button onClick={() => setPontajWeek(w => { const nw = w + 1; if (nw > 52) { setPontajYear(y => y + 1); return 1; } return nw; })} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>→</button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t('hr.importExcel')}</button>
            </div>
          </div>

          {/* Week header info */}
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            {dateFmt(weekDates[0])} — {dateFmt(weekDates[6])} · {weekRows.length} {t('hr.tabs.employees').toLowerCase()}
          </div>

          {pontajLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{t('common.loading')}</div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{t('hr.tabs.employees')}</th>
                    {DAYS_DE.map((d, i) => (
                      <th key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: i >= 5 ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap' }}>
                        {d}<br /><span style={{ fontWeight: 400 }}>{dateFmt(weekDates[i])}</span>
                      </th>
                    ))}
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#64748b' }}>{t('common.total')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#64748b' }}>{t('hr.overtime')}</th>
                  </tr>
                </thead>
                <tbody>
                  {weekRows.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{t('hr.noTimesheets')}</td></tr>
                  ) : weekRows.map(row => {
                    const isoKeys = weekDates.map(d => d.toISOString().split('T')[0]);
                    return (
                      <tr key={row.employee_id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{row.employee_name}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{row.personalnummer || row.taetigkeit}</div>
                        </td>
                        {isoKeys.map(key => {
                          const day = row.days?.[key];
                          const type = day?.entry_type || 'absent';
                          const style = ENTRY_TYPE_STYLE[type] || ENTRY_TYPE_STYLE.absent;
                          return (
                            <td key={key} style={{ padding: '6px 4px', textAlign: 'center' }}>
                              {day ? (
                                <div style={{ background: style.bg, color: style.color, borderRadius: 4, padding: '3px 6px', fontSize: 12, fontWeight: 600, display: 'inline-block', minWidth: 36 }}>
                                  {type === 'work' ? (day.hours_regular || 0) : type.charAt(0).toUpperCase()}
                                  {day.hours_overtime > 0 && <span style={{ fontSize: 9, color: '#d97706', display: 'block' }}>+{day.hours_overtime}</span>}
                                </div>
                              ) : (
                                <span style={{ color: '#e2e8f0', fontSize: 11 }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#1e293b' }}>{row.total_regular.toFixed(0)}h</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: row.total_overtime > 0 ? '#d97706' : '#94a3b8' }}>
                          {row.total_overtime > 0 ? `+${row.total_overtime.toFixed(0)}h` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {weekRows.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 12, color: '#64748b' }}>TOTAL</td>
                      {weekDates.map(d => {
                        const key = d.toISOString().split('T')[0];
                        const totalH = weekRows.reduce((s, r) => s + (r.days?.[key]?.hours_regular || 0), 0);
                        return <td key={key} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: '#1e293b' }}>{totalH > 0 ? totalH : '—'}</td>;
                      })}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#1d4ed8' }}>
                        {weekRows.reduce((s, r) => s + r.total_regular, 0).toFixed(0)}h
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: '#d97706' }}>
                        {weekRows.reduce((s, r) => s + r.total_overtime, 0) > 0
                          ? `+${weekRows.reduce((s, r) => s + r.total_overtime, 0).toFixed(0)}h` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            {Object.entries({ work: t('hr.legend.work'), sick: t('hr.legend.sick'), vacation: t('hr.legend.vacation'), holiday: t('hr.legend.holiday'), absent: t('hr.legend.absent'), training: t('hr.legend.training') }).map(([type, label]) => {
              const s = ENTRY_TYPE_STYLE[type];
              return (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: s.bg, border: '1px solid #e2e8f0' }} />
                  <span style={{ color: '#64748b' }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CONCEDII ─────────────────────────────────────────────────────────── */}
      {mainTab === 'concedii' && (
        <div className="split-content page-root">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{t('hr.leaveRecord')}</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <select value={leaveFilter} onChange={e => setLeaveFilter(e.target.value)} style={{ ...inp, width: 160 }}>
                <option value="">{t('hr.allStatuses')}</option>
                <option value="pending">{t('hr.leaveStatus.pending')}</option>
                <option value="approved">{t('hr.leaveStatus.approved')}</option>
                <option value="rejected">{t('hr.leaveStatus.rejected')}</option>
              </select>
              <button onClick={() => setShowLeaveForm(true)} style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ {t('hr.addLeave')}</button>
            </div>
          </div>

          {/* New leave form */}
          {showLeaveForm && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, maxWidth: 560, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 14 }}>{t('hr.addLeave')}</div>
              <form onSubmit={submitLeave}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lbl}>{t('hr.tabs.employees')} *</label>
                    <select required value={leaveForm.employee_id} onChange={e => setLeaveForm(p => ({ ...p, employee_id: e.target.value }))} style={inp}>
                      <option value="">{t('hr.selectEmployee')}</option>
                      {employees.filter(e => e.is_active).map(e => (
                        <option key={e.id} value={e.id}>{e.nachname} {e.vorname}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>{t('common.type')} *</label>
                    <select value={leaveForm.leave_type} onChange={e => setLeaveForm(p => ({ ...p, leave_type: e.target.value }))} style={inp}>
                      {Object.entries(LEAVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>{t('common.from')} *</label>
                    <input type="date" required value={leaveForm.date_from} onChange={e => setLeaveForm(p => ({ ...p, date_from: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>{t('common.to')} *</label>
                    <input type="date" required value={leaveForm.date_to} onChange={e => setLeaveForm(p => ({ ...p, date_to: e.target.value }))} style={inp} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lbl}>{t('common.notes')}</label>
                    <input value={leaveForm.notes} onChange={e => setLeaveForm(p => ({ ...p, notes: e.target.value }))} style={inp} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button type="submit" style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t('common.save')}</button>
                  <button type="button" onClick={() => setShowLeaveForm(false)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer' }}>{t('common.cancel')}</button>
                </div>
              </form>
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {[t('hr.tabs.employees'), t('hr.colType'), t('common.from'), t('common.to'), t('hr.days'), t('hr.colStatus'), t('common.actions')].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaves.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{t('hr.noLeaves')}</td></tr>
                ) : leaves.map((l: LeaveRequest) => {
                  const s = LEAVE_STATUS_STYLE[l.status] || LEAVE_STATUS_STYLE.pending;
                  return (
                    <tr key={l.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{l.employee_name || `#${l.employee_id}`}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{LEAVE_TYPES[l.leave_type] || l.leave_type}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace' }}>{l.date_from}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace' }}>{l.date_to}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>{l.days_count ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>{t(`hr.leaveStatus.${l.status}` as any) || l.status}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {l.status === 'pending' && user.role === 'director' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleLeaveAction(l.id, 'approve')} style={{ padding: '3px 10px', border: 'none', borderRadius: 4, background: '#d1fae5', color: '#059669', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{t('hr.approve')}</button>
                            <button onClick={() => handleLeaveAction(l.id, 'reject')} style={{ padding: '3px 10px', border: 'none', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{t('hr.reject')}</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── STATE DE PLATĂ ────────────────────────────────────────────────────── */}
      {mainTab === 'salarii' && (
        <div className="split-content page-root">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{t('hr.payrollState')}</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={salMonth} onChange={e => setSalMonth(Number(e.target.value))} style={{ ...inp, width: 140 }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i+1} value={i+1}>{getMonthName(i+1)}</option>
                ))}
              </select>
              <input type="number" min="2020" max="2030" value={salYear} onChange={e => setSalYear(Number(e.target.value))} style={{ ...inp, width: 80 }} />
              {user.role === 'director' && (
                <button onClick={handleCalculatePayroll} disabled={salLoading} style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#059669', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {salLoading ? t('common.loading') : t('hr.calculatePayroll')}
                </button>
              )}
              <button onClick={async () => { try { await downloadDatevExport(salYear, salMonth); } catch { toast.error(t('common.error')); } }}
                style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', color: '#1e293b' }}>
                {t('hr.datevExport')}
              </button>
            </div>
          </div>

          {salLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{t('common.loading')}</div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {[t('hr.tabs.employees'), t('hr.days'), t('hr.hoursReg'), t('hr.hoursOT'), t('hr.hoursSick'), t('hr.hoursVac'), t('hr.bruttoReg'), 'Brutto OT', 'Bauzuschl.', 'BRUTTO', 'AN SV', 'SOKA', t('hr.totalCost'), t('hr.colStatus'), ''].map(h => (
                      <th key={h} style={{ padding: '10px 10px', textAlign: h === t('hr.tabs.employees') ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payroll.length === 0 ? (
                    <tr><td colSpan={15} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                      {t('hr.noPayroll')}
                      {user.role === 'director' && ` ${t('hr.calculatePayrollHint', { button: t('hr.calculatePayroll') })}`}
                    </td></tr>
                  ) : payroll.map((p: PayrollRecord) => (
                    <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.employee_name || `#${p.employee_id}`}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12 }}>{p.days_worked}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12 }}>{p.hours_regular.toFixed(1)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12, color: p.hours_overtime > 0 ? '#d97706' : '#94a3b8' }}>{p.hours_overtime > 0 ? p.hours_overtime.toFixed(1) : '—'}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12, color: p.hours_sick > 0 ? '#854d0e' : '#94a3b8' }}>{p.hours_sick > 0 ? p.hours_sick.toFixed(1) : '—'}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12, color: p.hours_vacation > 0 ? '#1d4ed8' : '#94a3b8' }}>{p.hours_vacation > 0 ? p.hours_vacation.toFixed(1) : '—'}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12 }}>€{p.brutto_regular.toFixed(2)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12, color: p.brutto_overtime > 0 ? '#d97706' : '#94a3b8' }}>{p.brutto_overtime > 0 ? `€${p.brutto_overtime.toFixed(2)}` : '—'}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12 }}>€{p.brutto_bauzuschlag.toFixed(2)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#1e293b' }}>€{p.brutto_total.toFixed(2)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 11, color: '#64748b' }}>€{p.ag_sv_anteil.toFixed(2)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 11, color: '#64748b' }}>€{p.soka_bau.toFixed(2)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: '#059669' }}>€{p.total_employer_cost.toFixed(2)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: p.status === 'locked' ? '#d1fae5' : '#fef3c7', color: p.status === 'locked' ? '#059669' : '#d97706' }}>
                          {p.status === 'locked' ? t('hr.locked') : 'Draft'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                        {p.status === 'draft' && user.role === 'director' && (
                          <button onClick={() => handleLockPayroll(p.id)} style={{ padding: '3px 10px', border: 'none', borderRadius: 4, background: '#e0e7ff', color: '#1d4ed8', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{t('hr.lockPayroll')}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {payroll.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                      <td style={{ padding: '10px 10px', fontWeight: 700, fontSize: 12, color: '#64748b' }}>TOTAL</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{payroll.reduce((s, p) => s + p.days_worked, 0)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{payroll.reduce((s, p) => s + p.hours_regular, 0).toFixed(1)}</td>
                      <td colSpan={3} />
                      <td colSpan={2} />
                      <td />
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#1e293b' }}>€{payroll.reduce((s, p) => s + p.brutto_total, 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: '#64748b' }}>€{payroll.reduce((s, p) => s + p.ag_sv_anteil, 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: '#64748b' }}>€{payroll.reduce((s, p) => s + p.soka_bau, 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#059669' }}>€{payroll.reduce((s, p) => s + p.total_employer_cost, 0).toFixed(2)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
