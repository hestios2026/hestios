import { useEffect, useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  anmeldung_status: string | null;
  heiratsort: string | null;
  heiratsdatum: string | null;
  schuhgroesse: string | null;
  kleidergroesse: string | null;
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
  <div style={{ gridColumn: '1/-1', marginTop: 8, paddingBottom: 6, borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 12, color: '#22C55E', textTransform: 'uppercase', letterSpacing: 1 }}>
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
  const [editingCell, setEditingCell] = useState<{ empId: number; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [savingCell, setSavingCell]   = useState<string | null>(null);
  const [sortCol, setSortCol]         = useState<string | null>(null);
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('asc');
  const [colFilters, setColFilters]   = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showExport, setShowExport]   = useState(false);
  const [exportFields, setExportFields] = useState<Set<string>>(new Set());

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

  async function saveCell(emp: Employee, field: string, rawValue: string) {
    const cellKey = `${emp.id}-${field}`;
    setSavingCell(cellKey);
    setEditingCell(null);
    try {
      let parsed: string | number | null = rawValue === '' ? null : rawValue;
      if (['kinder_anzahl', 'steuerklasse', 'lohngruppe', 'urlaubsanspruch_tage'].includes(field))
        parsed = rawValue === '' ? null : parseInt(rawValue) || 0;
      if (['tariflohn', 'bauzuschlag', 'stunden_pro_woche'].includes(field))
        parsed = rawValue === '' ? null : parseFloat(rawValue) || 0;
      await updateEmployee(emp.id, { [field]: parsed });
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, [field]: parsed } : e));
    } catch { toast.error(t('common.error')); }
    finally { setSavingCell(null); }
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
  const fmtDateStr = (v: string | null) => {
    if (!v) return '';
    const [y, m, d] = v.split('T')[0].split('-');
    return `${d}.${m}.${y}`;
  };

  const filtered = useMemo(() => {
    let list = employees.filter(e =>
      !filter ||
      `${e.vorname} ${e.nachname}`.toLowerCase().includes(filter.toLowerCase()) ||
      (e.personalnummer || '').toLowerCase().includes(filter.toLowerCase())
    );
    // column filters
    for (const [field, val] of Object.entries(colFilters)) {
      if (!val) continue;
      list = list.filter(e => {
        const raw = (e as any)[field];
        if (raw == null) return false;
        return String(raw).toLowerCase().includes(val.toLowerCase());
      });
    }
    // sort
    if (sortCol) {
      list = [...list].sort((a, b) => {
        const av = (a as any)[sortCol] ?? '';
        const bv = (b as any)[sortCol] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [employees, filter, colFilters, sortCol, sortDir]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0)
      setSelectedIds(new Set());
    else
      setSelectedIds(new Set(filtered.map(e => e.id)));
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  const EXPORT_COLS: { key: string; label: string }[] = [
    { key: 'nachname',              label: 'Nume' },
    { key: 'vorname',               label: 'Prenume' },
    { key: 'geburtsdatum',          label: 'Data nașterii' },
    { key: 'geburtsort',            label: 'Loc naștere' },
    { key: 'arbeitsbeginn',         label: 'Început contract' },
    { key: 'befristung_bis',        label: 'Sfârșit contract' },
    { key: 'steuer_id',             label: 'Identifikationsnr.' },
    { key: 'sozialversicherungsnr', label: 'SV-Nr.' },
    { key: 'adresse',               label: 'Anmeldung Adresse' },
    { key: 'anmeldung_status',      label: 'Anmeldung Status' },
    { key: 'familienstand',         label: 'Stare civilă' },
    { key: 'heiratsort',            label: 'Loc căsătorie' },
    { key: 'heiratsdatum',          label: 'Data căsătoriei' },
    { key: 'kinder_anzahl',         label: 'Copii' },
    { key: 'heimatadresse',         label: 'Adresă domiciliu' },
    { key: 'tariflohn',             label: 'Lohn (€/h)' },
    { key: 'iban',                  label: 'Cont bancar' },
    { key: 'taetigkeit',            label: 'Beruf' },
    { key: 'schuhgroesse',          label: 'Bocanci' },
    { key: 'kleidergroesse',        label: 'Haine' },
    { key: 'telefon',               label: 'Telefon' },
    { key: 'email',                 label: 'E-Mail' },
    { key: 'nationalitaet',         label: 'Naționalitate' },
    { key: 'krankenkasse',          label: 'Krankenkasse' },
    { key: 'personalnummer',        label: 'Personalnummer' },
    { key: 'notes',                 label: 'Comentarii' },
  ];

  function getCellValue(emp: Employee, key: string): string {
    const v = (emp as any)[key];
    if (v == null) return '';
    if (key.includes('datum') || key === 'arbeitsbeginn' || key === 'befristung_bis') return fmtDateStr(v);
    if (key === 'tariflohn') return `€${Number(v).toFixed(2)}`;
    return String(v);
  }

  function exportToExcel() {
    const toExport = filtered.filter(e => selectedIds.size === 0 || selectedIds.has(e.id));
    const activeCols = EXPORT_COLS.filter(c => exportFields.has(c.key));
    const headers = activeCols.map(c => c.label);
    const rows = toExport.map(emp => activeCols.map(c => getCellValue(emp, c.key)));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // column widths
    ws['!cols'] = activeCols.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Angajați');
    XLSX.writeFile(wb, `angajati_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExport(false);
  }

  function exportToPDF() {
    const toExport = filtered.filter(e => selectedIds.size === 0 || selectedIds.has(e.id));
    const activeCols = EXPORT_COLS.filter(c => exportFields.has(c.key));
    const doc = new jsPDF({ orientation: activeCols.length > 8 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(13);
    doc.text('Angajați — HestiOS', 14, 15);
    doc.setFontSize(9);
    doc.text(`Export: ${new Date().toLocaleDateString('ro-RO')} · ${toExport.length} persoane`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [activeCols.map(c => c.label)],
      body: toExport.map(emp => activeCols.map(c => getCellValue(emp, c.key))),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    doc.save(`angajati_${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExport(false);
  }

  const tabBtn = (key: typeof formTab, label: string) => (
    <button type="button" onClick={() => setFormTab(key)} style={{
      padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
      fontWeight: formTab === key ? 700 : 500,
      background: formTab === key ? '#fff' : 'transparent',
      color: formTab === key ? '#22C55E' : '#64748b',
      boxShadow: formTab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    }}>{label}</button>
  );

  const mainTabBtn = (key: typeof mainTab, label: string) => (
    <button onClick={() => setMainTab(key)} style={{
      padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: mainTab === key ? 700 : 500,
      background: mainTab === key ? '#22C55E' : 'transparent',
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>
              {t('hr.tabs.employees')}
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginLeft: 6 }}>
                ({employees.filter(e => e.is_active).length} activi · {filtered.length} afișați)
              </span>
            </span>
            <input
              placeholder="Caută după nume / nr..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ ...inp, width: 200, fontSize: 12 }}
            />
            {Object.values(colFilters).some(Boolean) && (
              <button onClick={() => setColFilters({})} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                ✕ Resetează filtre
              </button>
            )}
            {selectedIds.size > 0 && (
              <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 700 }}>{selectedIds.size} selectați</span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setShowExport(true);
                  setExportFields(new Set(EXPORT_COLS.map(c => c.key)));
                }}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#1e293b', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >↓ Export</button>
              <button
                onClick={() => { setShowForm(true); setSelected(null); setFormTab('personal'); }}
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >+ {t('common.new')}</button>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 0 24px 0' }}>
            {(() => {
              const COLS: { key: string; label: string; type: string; options?: string[]; width: number }[] = [
                { key: 'nr',                   label: 'Nr',                 type: 'readonly', width: 42 },
                { key: 'nachname',             label: 'Nume',               type: 'text',     width: 110 },
                { key: 'vorname',              label: 'Prenume',            type: 'text',     width: 110 },
                { key: 'geburtsdatum',         label: 'Data nașterii',      type: 'date',     width: 110 },
                { key: 'arbeitsbeginn',        label: 'Început contract',   type: 'date',     width: 110 },
                { key: 'befristung_bis',       label: 'Sfârșit contract',   type: 'date',     width: 110 },
                { key: 'steuer_id',            label: 'Identifikationsnr.', type: 'text',     width: 130 },
                { key: 'sozialversicherungsnr',label: 'SV-Nr.',             type: 'text',     width: 130 },
                { key: 'adresse',              label: 'Anmeldung Adresse',  type: 'text',     width: 180 },
                { key: 'anmeldung_status',     label: 'Anmeldung Status',   type: 'select',   width: 120,
                  options: ['', 'angemeldet', 'abgemeldet', 'ausstehend'] },
                { key: 'geburtsort',           label: 'Loc naștere',        type: 'text',     width: 120 },
                { key: 'familienstand',        label: 'Stare civilă',       type: 'select',   width: 110,
                  options: ['', 'ledig', 'verheiratet', 'geschieden', 'verwitwet'] },
                { key: 'heiratsort',           label: 'Loc căsătorie',      type: 'text',     width: 120 },
                { key: 'heiratsdatum',         label: 'Data căsătoriei',    type: 'date',     width: 110 },
                { key: 'kinder_anzahl',        label: 'Copii',              type: 'number',   width: 60 },
                { key: 'heimatadresse',        label: 'Adresă domiciliu',   type: 'text',     width: 180 },
                { key: 'tariflohn',            label: 'Lohn (€/h)',         type: 'number',   width: 90 },
                { key: 'iban',                 label: 'Cont bancar',        type: 'text',     width: 180 },
                { key: 'taetigkeit',           label: 'Beruf',              type: 'text',     width: 130 },
                { key: 'schuhgroesse',         label: 'Bocanci',            type: 'text',     width: 80 },
                { key: 'kleidergroesse',       label: 'Haine',              type: 'text',     width: 80 },
                { key: 'notes',                label: 'Comentarii',         type: 'text',     width: 200 },
                { key: 'actions',              label: '',                   type: 'readonly', width: 100 },
              ];

              const fmtDate = (v: string | null) => {
                if (!v) return '';
                const [y, m, d] = v.split('T')[0].split('-');
                return `${d}.${m}.${y}`;
              };

              const cellKey = (empId: number, field: string) => `${empId}-${field}`;

              const startEdit = (emp: Employee, field: string) => {
                const raw = (emp as any)[field];
                setEditingCell({ empId: emp.id, field });
                setEditingValue(raw === null || raw === undefined ? '' : String(raw));
              };

              const renderCellContent = (emp: Employee, col: typeof COLS[0]) => {
                if (col.key === 'nr') return null; // handled outside
                if (col.key === 'actions') return null; // handled outside
                const isEditing = editingCell?.empId === emp.id && editingCell?.field === col.key;
                const isSaving = savingCell === cellKey(emp.id, col.key);
                const raw = (emp as any)[col.key];

                const cellStyle: React.CSSProperties = {
                  padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center',
                  cursor: 'text', minWidth: col.width,
                  background: isSaving ? '#f0fdf4' : isEditing ? '#eff6ff' : undefined,
                  outline: isEditing ? '2px solid #22C55E' : undefined,
                  outlineOffset: -2,
                };

                if (isEditing) {
                  if (col.type === 'select') {
                    return (
                      <div style={cellStyle}>
                        <select
                          autoFocus
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onBlur={() => saveCell(emp, col.key, editingValue)}
                          onKeyDown={e => { if (e.key === 'Enter') saveCell(emp, col.key, editingValue); if (e.key === 'Escape') setEditingCell(null); }}
                          style={{ border: 'none', background: 'transparent', fontSize: 12, width: '100%', outline: 'none', cursor: 'pointer' }}
                        >
                          {col.options!.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                        </select>
                      </div>
                    );
                  }
                  return (
                    <div style={cellStyle}>
                      <input
                        autoFocus
                        type={col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'}
                        step={col.key === 'tariflohn' || col.key === 'bauzuschlag' ? '0.01' : undefined}
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={() => saveCell(emp, col.key, editingValue)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCell(emp, col.key, editingValue); if (e.key === 'Escape') setEditingCell(null); }}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, width: '100%', outline: 'none' }}
                      />
                    </div>
                  );
                }

                let display = '';
                if (col.type === 'date') display = fmtDate(raw);
                else if (col.key === 'tariflohn') display = raw != null ? `€${Number(raw).toFixed(2)}` : '';
                else display = raw != null ? String(raw) : '';

                const isEmpty = !display;
                return (
                  <div
                    style={{ ...cellStyle, color: isEmpty ? '#cbd5e1' : '#1e293b' }}
                    onClick={() => { if (col.type !== 'readonly') startEdit(emp, col.key); }}
                    title={isEmpty ? 'Click pentru editare' : display}
                  >
                    {isSaving ? (
                      <span style={{ fontSize: 10, color: '#22C55E' }}>●</span>
                    ) : (
                      <span style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: col.width - 16 }}>
                        {isEmpty ? '—' : display}
                      </span>
                    )}
                  </div>
                );
              };

              const allSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));
              const stickyHd: React.CSSProperties = { background: '#f8fafc', position: 'sticky', zIndex: 3, left: 0 };

              return (
                <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 4 }}>
                    {/* Sort row */}
                    <tr style={{ background: '#f8fafc' }}>
                      {/* checkbox sticky */}
                      <th style={{ ...stickyHd, width: 36, minWidth: 36, padding: '8px 8px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                      </th>
                      {COLS.map(col => {
                        const isSorted = sortCol === col.key;
                        const sortable = col.type !== 'readonly' && col.key !== 'actions';
                        return (
                          <th key={col.key} onClick={() => sortable && toggleSort(col.key)}
                            style={{
                              padding: '8px 8px', textAlign: 'left', fontWeight: 700, fontSize: 11,
                              color: isSorted ? '#22C55E' : '#64748b',
                              borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                              minWidth: col.width, width: col.width,
                              background: '#f8fafc',
                              cursor: sortable ? 'pointer' : 'default',
                              userSelect: 'none',
                            }}>
                            {col.label}
                            {isSorted && <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                          </th>
                        );
                      })}
                    </tr>
                    {/* Filter row */}
                    <tr style={{ background: '#fff' }}>
                      <th style={{ ...stickyHd, borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }} />
                      {COLS.map(col => {
                        const filterable = col.type !== 'readonly' && col.key !== 'actions' && col.key !== 'nr';
                        return (
                          <th key={col.key} style={{ padding: '3px 4px', borderBottom: '2px solid #e2e8f0', background: '#fff', minWidth: col.width }}>
                            {filterable && (
                              col.type === 'select' ? (
                                <select
                                  value={colFilters[col.key] || ''}
                                  onChange={e => setColFilters(p => ({ ...p, [col.key]: e.target.value }))}
                                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 10, padding: '2px 4px', background: colFilters[col.key] ? '#eff6ff' : '#fff' }}
                                >
                                  <option value="">Toate</option>
                                  {col.options!.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input
                                  value={colFilters[col.key] || ''}
                                  onChange={e => setColFilters(p => ({ ...p, [col.key]: e.target.value }))}
                                  placeholder="Filtrează..."
                                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 10, padding: '2px 4px', background: colFilters[col.key] ? '#eff6ff' : '#fff', boxSizing: 'border-box' }}
                                />
                              )
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((emp, idx) => {
                      const isSelected = selectedIds.has(emp.id);
                      return (
                        <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9', background: isSelected ? '#f0fdf4' : emp.is_active ? '#fff' : '#fafafa', opacity: emp.is_active ? 1 : 0.55 }}>
                          <td style={{ padding: '0 8px', height: 36, background: isSelected ? '#f0fdf4' : '#f8fafc', position: 'sticky', left: 0, zIndex: 1, borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(emp.id)} style={{ cursor: 'pointer' }} />
                          </td>
                          {COLS.map(col => {
                            if (col.key === 'nr') return (
                              <td key="nr" style={{ padding: '0 8px', height: 36, fontSize: 11, color: '#94a3b8', fontWeight: 600, minWidth: 42 }}>
                                {idx + 1}
                              </td>
                            );
                            if (col.key === 'actions') return (
                              <td key="actions" style={{ padding: '0 8px', height: 36, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  onClick={() => handleDownloadContract(emp)}
                                  title="Descarcă contract"
                                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700,
                                    background: '#dbeafe', color: '#1d4ed8' }}
                                >📄</button>
                                <button
                                  onClick={() => toggleActive(emp)}
                                  title={emp.is_active ? 'Dezactivează' : 'Activează'}
                                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700,
                                    background: emp.is_active ? '#fee2e2' : '#d1fae5', color: emp.is_active ? '#dc2626' : '#059669' }}
                                >{emp.is_active ? 'OFF' : 'ON'}</button>
                              </td>
                            );
                            return (
                              <td key={col.key} style={{ height: 36, padding: 0, maxWidth: col.width }}>
                                {renderCellContent(emp, col)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {!filtered.length && (
                      <tr><td colSpan={COLS.length + 1} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                        Niciun rezultat
                      </td></tr>
                    )}
                  </tbody>
                </table>
              );
            })()}
          </div>

          {/* Export modal */}
          {showExport && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
              onClick={e => { if (e.target === e.currentTarget) setShowExport(false); }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 560, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Export angajați</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                  {selectedIds.size > 0 ? `${selectedIds.size} selectați` : `Toți (${filtered.length})`} · alege câmpurile de inclus
                </div>

                {/* Field checkboxes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', maxHeight: 320, overflowY: 'auto', marginBottom: 20 }}>
                  {EXPORT_COLS.map(c => (
                    <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', padding: '3px 0' }}>
                      <input
                        type="checkbox"
                        checked={exportFields.has(c.key)}
                        onChange={() => setExportFields(prev => {
                          const s = new Set(prev);
                          s.has(c.key) ? s.delete(c.key) : s.add(c.key);
                          return s;
                        })}
                        style={{ cursor: 'pointer' }}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setExportFields(new Set(EXPORT_COLS.map(c => c.key)))}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                      Toate
                    </button>
                    <button onClick={() => setExportFields(new Set())}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                      Niciunul
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowExport(false)}
                      style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                      Anulează
                    </button>
                    <button onClick={exportToExcel} disabled={exportFields.size === 0}
                      style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: exportFields.size ? 'pointer' : 'not-allowed', opacity: exportFields.size ? 1 : 0.5 }}>
                      ↓ Excel
                    </button>
                    <button onClick={exportToPDF} disabled={exportFields.size === 0}
                      style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: exportFields.size ? 'pointer' : 'not-allowed', opacity: exportFields.size ? 1 : 0.5 }}>
                      ↓ PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New employee modal */}
          {showForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
              onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setForm(EMPTY_FORM); } }}>
              <div style={{ background: '#f8fafc', borderRadius: 14, padding: 28, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>{t('hr.addEmployee')}</div>
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 4, width: 'fit-content', marginBottom: 20 }}>
                  {tabBtn('personal', t('hr.tabs.personal'))}
                  {tabBtn('angajare', t('hr.tabs.employment'))}
                  {tabBtn('financiar', t('hr.tabs.financial'))}
                </div>
                <form onSubmit={submitForm}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
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
                        <button type="button" onClick={() => setFormTab(formTab === 'personal' ? 'angajare' : 'financiar')} style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: '#e0e7ff', color: '#22C55E', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t('common.next')} →</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t('common.save')}</button>
                      <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>{t('common.cancel')}</button>
                    </div>
                  </div>
                  </div>
                </form>
              </div>
            </div>
        )}

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
              <button onClick={() => fileRef.current?.click()} style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t('hr.importExcel')}</button>
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
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#22C55E' }}>
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
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{t('hr.leaveRecord')}</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={leaveFilter} onChange={e => setLeaveFilter(e.target.value)} style={{ ...inp, minWidth: 140 }}>
                <option value="">{t('hr.allStatuses')}</option>
                <option value="pending">{t('hr.leaveStatus.pending')}</option>
                <option value="approved">{t('hr.leaveStatus.approved')}</option>
                <option value="rejected">{t('hr.leaveStatus.rejected')}</option>
              </select>
              <button onClick={() => setShowLeaveForm(true)} style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ {t('hr.addLeave')}</button>
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
                  <button type="submit" style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t('common.save')}</button>
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
              <select value={salMonth} onChange={e => setSalMonth(Number(e.target.value))} style={{ ...inp, minWidth: 120 }}>
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
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12, color: p.hours_vacation > 0 ? '#22C55E' : '#94a3b8' }}>{p.hours_vacation > 0 ? p.hours_vacation.toFixed(1) : '—'}</td>
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
                          <button onClick={() => handleLockPayroll(p.id)} style={{ padding: '3px 10px', border: 'none', borderRadius: 4, background: '#e0e7ff', color: '#22C55E', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{t('hr.lockPayroll')}</button>
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
