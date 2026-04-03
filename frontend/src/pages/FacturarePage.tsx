import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  fetchInvoices, createInvoice, updateInvoice, deleteInvoice, getInvoice,
  registerPayment, releaseRetention, exportDATEV,
  getBillingConfig, saveBillingConfig,
  fetchSituatii, createSituatie, getSituatie, updateSituatie, deleteSituatie,
  getAvailableEntries, addEntriesToSituatie, removeEntryFromSituatie,
  generateInvoiceFromSituatie,
} from '../api/facturare';
import { fetchSites } from '../api/sites';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Site { id: number; name: string; kostenstelle: string; client: string; status: string; }
interface InvoiceItem {
  id: number; position: string; description: string; unit: string;
  quantity: number; unit_price: number; total_price: number;
  purchase_price?: number; admin_fee_pct?: number; aufmass_id?: number;
}
interface Invoice {
  id: number; invoice_number: string; invoice_type: string;
  site_id: number | null; site_name: string | null; site_kostenstelle: string | null;
  situatie_id: number | null; client_name: string; client_address: string | null;
  issue_date: string; due_date: string | null; status: string;
  subtotal: number; vat_rate: number; vat_amount: number; total: number;
  sicherheitseinbehalt_pct: number; sicherheitseinbehalt_amount: number;
  sicherheitseinbehalt_released: boolean; sicherheitseinbehalt_release_date: string | null;
  amount_payable: number; payment_ref: string | null; notes: string | null;
  paid_amount: number; payment_date: string | null; paid_at: string | null;
  items?: InvoiceItem[];
}
interface Situatie {
  id: number; site_id: number; site_name: string; site_kostenstelle: string;
  title: string; period_from: string; period_to: string; status: string;
  sent_at: string | null; approved_at: string | null; client_notes: string | null;
  entries?: AufmassEntry[]; total_netto?: number; entries_count?: number;
  invoice_ids?: number[];
}
interface AufmassEntry {
  id: number; date: string; position: string; description: string;
  unit: string; quantity: number; unit_price: number | null; total_price: number | null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 };
const card: React.CSSProperties = { background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 };
const btnPrimary: React.CSSProperties = { padding: '8px 18px', borderRadius: 7, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' };
const sectionHdr = (t: string) => (
  <div style={{ gridColumn: '1/-1', marginTop: 8, paddingBottom: 6, borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 11, color: '#1d4ed8', textTransform: 'uppercase' as const, letterSpacing: 1 }}>{t}</div>
);

const STATUS_INVOICE: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#f1f5f9', color: '#475569' },
  sent:      { bg: '#dbeafe', color: '#1e40af' },
  paid:      { bg: '#d1fae5', color: '#065f46' },
  overdue:   { bg: '#fee2e2', color: '#991b1b' },
  cancelled: { bg: '#fef3c7', color: '#92400e' },
};
const STATUS_SITUATIE: Record<string, { bg: string; color: string }> = {
  draft:         { bg: '#f1f5f9', color: '#475569' },
  sent:          { bg: '#dbeafe', color: '#1e40af' },
  modifications: { bg: '#fef3c7', color: '#92400e' },
  approved:      { bg: '#d1fae5', color: '#065f46' },
  invoiced:      { bg: '#ede9fe', color: '#5b21b6' },
};

const INVOICE_STATUS_KEYS: Record<string, string> = {
  draft: 'facturare.statusDraft', sent: 'facturare.statusSent', paid: 'facturare.statusPaid',
  overdue: 'facturare.statusOverdue', cancelled: 'facturare.statusCancelled',
};
const SITUATIE_STATUS_KEYS: Record<string, string> = {
  draft: 'facturare.statusDraft', sent: 'facturare.statusSent', modifications: 'facturare.statusModifications',
  approved: 'facturare.statusApproved', invoiced: 'facturare.statusInvoiced',
};

function Badge({ status, statusKeys }: { status: string; statusKeys: Record<string, string> }) {
  const { t } = useTranslation();
  const map = statusKeys === INVOICE_STATUS_KEYS ? STATUS_INVOICE : STATUS_SITUATIE;
  const s = map[status] || { bg: '#f1f5f9', color: '#475569' };
  const label = statusKeys[status] ? t(statusKeys[status]) : status;
  return <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{label}</span>;
}

function fmt(n: number) { return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('de-DE') : '—'; }

// ─── Main Page ────────────────────────────────────────────────────────────────
export function FacturarePage() {
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState<'situatii' | 'facturi' | 'configurare'>('situatii');
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    fetchSites().then(setSites).catch(() => {});
  }, []);

  const tabBtn = (key: typeof mainTab, label: string) => (
    <button onClick={() => setMainTab(key)} style={{
      padding: '10px 20px', borderRadius: 0, border: 'none', fontWeight: mainTab === key ? 700 : 400,
      background: 'none', cursor: 'pointer', fontSize: 13,
      borderBottom: mainTab === key ? '2px solid #1d4ed8' : '2px solid transparent',
      color: mainTab === key ? '#1d4ed8' : '#64748b',
    }}>{label}</button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', height: 48, flexShrink: 0 }}>
        {tabBtn('situatii', t('facturare.tabSituatii'))}
        {tabBtn('facturi', t('facturare.tabFacturi'))}
        {tabBtn('configurare', t('facturare.tabConfigurare'))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {mainTab === 'situatii'    && <SituatiiTab sites={sites} />}
        {mainTab === 'facturi'     && <FacturiTab sites={sites} />}
        {mainTab === 'configurare' && <ConfigurareTab sites={sites} />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SITUAȚII TAB
// ══════════════════════════════════════════════════════════════════════════════

function SituatiiTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const [situatii, setSituatii] = useState<Situatie[]>([]);
  const [selected, setSelected] = useState<Situatie | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterSite, setFilterSite] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const baustellen = sites.filter(s => s.status === 'active');

  useEffect(() => { loadSituatii(); }, []);

  async function loadSituatii() {
    try { setSituatii(await fetchSituatii()); } catch { toast.error(t('facturare.errorLoad')); }
  }

  async function selectSituatie(s: Situatie) {
    try { setSelected(await getSituatie(s.id)); setShowCreate(false); } catch { toast.error(t('common.error')); }
  }

  const filtered = situatii.filter(s =>
    (!filterSite || String(s.site_id) === filterSite) &&
    (!filterStatus || s.status === filterStatus)
  );

  return (
    <div className="split-layout" style={{ flex: 1 }}>
      {/* Left */}
      <div className="split-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>{t('facturare.situatii')} ({filtered.length})</span>
            <button onClick={() => { setShowCreate(true); setSelected(null); }} style={{ ...btnPrimary, padding: '4px 12px', fontSize: 12 }}>{t('facturare.addNew')}</button>
          </div>
          <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={{ ...inp, fontSize: 12, marginBottom: 6 }}>
            <option value="">{t('facturare.allSites')}</option>
            {baustellen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, fontSize: 12 }}>
            <option value="">{t('facturare.allStatuses')}</option>
            {Object.entries(SITUATIE_STATUS_KEYS).map(([k, tKey]) => <option key={k} value={k}>{t(tKey)}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.map(s => {
            const st = STATUS_SITUATIE[s.status] || STATUS_SITUATIE.draft;
            return (
              <div key={s.id} onClick={() => selectSituatie(s)} style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                background: selected?.id === s.id ? '#eff6ff' : '#fff',
                borderLeft: selected?.id === s.id ? '3px solid #1d4ed8' : '3px solid transparent',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{s.title}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.site_name} · KST {s.site_kostenstelle}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                  <span style={{ background: st.bg, color: st.color, padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{SITUATIE_STATUS_KEYS[s.status] ? t(SITUATIE_STATUS_KEYS[s.status]) : s.status}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{fmtDate(s.period_from)} – {fmtDate(s.period_to)}</span>
                </div>
              </div>
            );
          })}
          {!filtered.length && <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>{t('facturare.noSituatie')}</div>}
        </div>
      </div>

      {/* Right */}
      <div className="split-content page-root">
        {showCreate && <CreateSituatieForm sites={baustellen} onSave={async data => { await createSituatie(data); await loadSituatii(); setShowCreate(false); toast.success(t('facturare.situatieCreated')); }} onCancel={() => setShowCreate(false)} />}
        {!showCreate && selected && <SituatieDetail key={selected.id} situatie={selected} onReload={async () => { setSelected(await getSituatie(selected.id)); await loadSituatii(); }} />}
        {!showCreate && !selected && <EmptyState text={t('facturare.selectSituatie')} />}
      </div>
    </div>
  );
}

function CreateSituatieForm({ sites, onSave, onCancel }: { sites: Site[]; onSave: (d: object) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ site_id: '', title: '', period_from: today, period_to: today });
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.site_id) return toast.error(t('facturare.fieldSantier'));
    await onSave({ ...form, site_id: parseInt(form.site_id) });
  }
  return (
    <div style={card}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>{t('facturare.newSituatie')}</div>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={lbl}>{t('facturare.fieldSantier')}</label>
          <select required value={form.site_id} onChange={e => f('site_id', e.target.value)} style={inp}>
            <option value="">— {t('common.select')} —</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.kostenstelle})</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={lbl}>{t('facturare.fieldTitlu')}</label>
          <input required value={form.title} onChange={e => f('title', e.target.value)} placeholder="z.B. Abrechnung Okt 2024 – Tramo 3" style={inp} />
        </div>
        <div><label style={lbl}>{t('facturare.fieldPerioadaDe')}</label><input type="date" required value={form.period_from} onChange={e => f('period_from', e.target.value)} style={inp} /></div>
        <div><label style={lbl}>{t('facturare.fieldPerioadaPana')}</label><input type="date" required value={form.period_to} onChange={e => f('period_to', e.target.value)} style={inp} /></div>
        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="submit" style={btnPrimary}>{t('facturare.create')}</button>
          <button type="button" onClick={onCancel} style={btnGhost}>{t('common.cancel')}</button>
        </div>
      </form>
    </div>
  );
}

function SituatieDetail({ situatie, onReload }: { situatie: Situatie; onReload: () => Promise<void> }) {
  const { t } = useTranslation();
  const [available, setAvailable] = useState<AufmassEntry[]>([]);
  const [showAvailable, setShowAvailable] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [clientNotes, setClientNotes] = useState(situatie.client_notes || '');
  const [showModificari, setShowModificari] = useState(false);

  async function loadAvailable() {
    try { setAvailable(await getAvailableEntries(situatie.id)); setShowAvailable(true); } catch { toast.error(t('common.error')); }
  }

  async function addSelected() {
    if (!selectedEntries.size) return;
    try {
      await addEntriesToSituatie(situatie.id, Array.from(selectedEntries));
      setSelectedEntries(new Set()); setShowAvailable(false);
      await onReload();
    } catch { toast.error(t('common.error')); }
  }

  async function removeEntry(entryId: number) {
    try { await removeEntryFromSituatie(situatie.id, entryId); await onReload(); } catch { toast.error(t('common.error')); }
  }

  async function transition(status: string, extra?: object) {
    try {
      await updateSituatie(situatie.id, { status, ...extra });
      await onReload();
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
  }

  async function genInvoice() {
    try {
      const res = await generateInvoiceFromSituatie(situatie.id);
      await onReload();
      toast.success(t('billing.invoiceCreated', { number: res.invoice_number }));
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
  }

  const canEdit = ['draft', 'modifications'].includes(situatie.status);
  const entries = situatie.entries || [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: 0 }}>{situatie.title}</h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{situatie.site_name} · {fmtDate(situatie.period_from)} – {fmtDate(situatie.period_to)}</div>
          <div style={{ marginTop: 6 }}><Badge status={situatie.status} statusKeys={SITUATIE_STATUS_KEYS} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {situatie.status === 'draft' && <button onClick={() => transition('sent')} style={{ ...btnPrimary, background: '#0891b2' }}>{t('facturare.sendToClient')}</button>}
          {situatie.status === 'sent' && <>
            <button onClick={() => setShowModificari(true)} style={{ ...btnGhost, borderColor: '#f59e0b', color: '#92400e' }}>{t('facturare.requestModifications')}</button>
            <button onClick={() => transition('approved')} style={{ ...btnPrimary, background: '#059669' }}>{t('facturare.approve')}</button>
          </>}
          {situatie.status === 'modifications' && <button onClick={() => transition('sent')} style={{ ...btnPrimary, background: '#0891b2' }}>{t('facturare.resendToClient')}</button>}
          {situatie.status === 'approved' && <button onClick={genInvoice} style={btnPrimary}>{t('facturare.generateInvoice')}</button>}
        </div>
      </div>

      {/* Modificari modal */}
      {showModificari && (
        <div style={{ ...card, marginBottom: 20, border: '1px solid #fcd34d' }}>
          <label style={lbl}>{t('facturare.clientNotes')}</label>
          <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { transition('modifications', { client_notes: clientNotes }); setShowModificari(false); }} style={{ ...btnPrimary, background: '#f59e0b' }}>{t('facturare.confirmModifications')}</button>
            <button onClick={() => setShowModificari(false)} style={btnGhost}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {situatie.client_notes && situatie.status === 'modifications' && (
        <div style={{ background: '#fef3c7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
          <strong>{t('facturare.noteClient')}:</strong> {situatie.client_notes}
        </div>
      )}

      {/* Aufmass entries */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{t('facturare.aufmassPositions')} ({entries.length})</div>
          {canEdit && <button onClick={loadAvailable} style={{ ...btnGhost, fontSize: 12 }}>{t('facturare.addFromAufmass')}</button>}
        </div>

        {showAvailable && (
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8 }}>{t('facturare.availableAufmass')}</div>
            {available.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8' }}>{t('facturare.noAvailableEntries')}</div>}
            {available.map(e => (
              <label key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={selectedEntries.has(e.id)} onChange={ev => {
                  const s = new Set(selectedEntries);
                  ev.target.checked ? s.add(e.id) : s.delete(e.id);
                  setSelectedEntries(s);
                }} />
                <div>
                  <span style={{ fontWeight: 600 }}>{e.position}</span> — {e.description}
                  <span style={{ color: '#94a3b8', marginLeft: 8 }}>{e.quantity} {e.unit} × €{e.unit_price?.toFixed(2)} = €{e.total_price?.toFixed(2)}</span>
                  <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: 11 }}>{fmtDate(e.date)}</span>
                </div>
              </label>
            ))}
            {available.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={addSelected} style={{ ...btnPrimary, fontSize: 12 }}>{t('facturare.addSelected', { count: selectedEntries.size })}</button>
                <button onClick={() => setShowAvailable(false)} style={{ ...btnGhost, fontSize: 12 }}>{t('facturare.closePanel')}</button>
              </div>
            )}
          </div>
        )}

        {entries.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {[t('facturare.colPos'), t('facturare.colDescription'), t('common.date'), t('facturare.colUnit'), t('facturare.colQty'), t('facturare.colPriceUnit'), t('facturare.colTotal'), ...(canEdit ? [''] : [])].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{e.position}</td>
                    <td style={{ padding: '7px 10px', maxWidth: 300 }}>{e.description}</td>
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: '#64748b' }}>{fmtDate(e.date)}</td>
                    <td style={{ padding: '7px 10px' }}>{e.unit}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}>{e.quantity}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}>€{e.unit_price?.toFixed(2) ?? '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>€{e.total_price?.toFixed(2) ?? '—'}</td>
                    {canEdit && <td style={{ padding: '7px 10px' }}><button onClick={() => removeEntry(e.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 }}>×</button></td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                  <td colSpan={6} style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right' }}>{t('facturare.totalNetto')}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 800, color: '#1d4ed8' }}>€{fmt(situatie.total_netto || 0)}</td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {entries.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>{t('facturare.noPositionsHint')}</div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FACTURI TAB
// ══════════════════════════════════════════════════════════════════════════════

function FacturiTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<'lucrari' | 'materiale'>('materiale');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => { loadInvoices(); }, []);

  async function loadInvoices() {
    try { setInvoices(await fetchInvoices()); } catch { toast.error(t('facturare.errorLoad')); }
  }

  async function selectInvoice(inv: Invoice) {
    try {
      const full = await getInvoice(inv.id);
      setSelected(full); setShowCreate(false);
    } catch { toast.error(t('common.error')); }
  }

  function handleExportDATEV() {
    exportDATEV().then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'DATEV_export.csv'; a.click();
      URL.revokeObjectURL(url);
    }).catch(() => toast.error(t('common.error')));
  }

  const filtered = invoices.filter(inv =>
    (!filterStatus || inv.status === filterStatus) &&
    (!filterType || inv.invoice_type === filterType)
  );

  return (
    <div className="split-layout" style={{ flex: 1 }}>
      {/* Left */}
      <div className="split-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>{t('facturare.invoices')} ({filtered.length})</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={handleExportDATEV} style={{ ...btnGhost, fontSize: 11, padding: '3px 8px' }}>DATEV</button>
              <button onClick={() => { setCreateType('materiale'); setShowCreate(true); setSelected(null); }} style={{ ...btnPrimary, padding: '4px 10px', fontSize: 11, background: '#0891b2' }}>+ Mat.</button>
              <button onClick={() => { setCreateType('lucrari'); setShowCreate(true); setSelected(null); }} style={{ ...btnPrimary, padding: '4px 10px', fontSize: 11 }}>+ Luc.</button>
            </div>
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inp, fontSize: 12, marginBottom: 6 }}>
            <option value="">{t('facturare.allTypes')}</option>
            <option value="lucrari">{t('facturare.typeWorks')}</option>
            <option value="materiale">{t('facturare.typeMaterials')}</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, fontSize: 12 }}>
            <option value="">{t('facturare.allStatuses')}</option>
            {Object.entries(INVOICE_STATUS_KEYS).map(([k, tKey]) => <option key={k} value={k}>{t(tKey)}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.map(inv => {
            const st = STATUS_INVOICE[inv.status] || STATUS_INVOICE.draft;
            return (
              <div key={inv.id} onClick={() => selectInvoice(inv)} style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                background: selected?.id === inv.id ? '#eff6ff' : '#fff',
                borderLeft: selected?.id === inv.id ? '3px solid #1d4ed8' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', fontFamily: 'monospace' }}>{inv.invoice_number}</span>
                  <span style={{ background: inv.invoice_type === 'lucrari' ? '#dbeafe' : '#d1fae5', color: inv.invoice_type === 'lucrari' ? '#1e40af' : '#065f46', padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{inv.invoice_type}</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{inv.client_name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                  <span style={{ background: st.bg, color: st.color, padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{INVOICE_STATUS_KEYS[inv.status] ? t(INVOICE_STATUS_KEYS[inv.status]) : inv.status}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>€{fmt(inv.total)}</span>
                </div>
              </div>
            );
          })}
          {!filtered.length && <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>{t('facturare.noFactura')}</div>}
        </div>
      </div>

      {/* Right */}
      <div className="split-content page-root">
        {showCreate && <CreateInvoiceForm type={createType} sites={sites} onSave={async data => { await createInvoice(data); await loadInvoices(); setShowCreate(false); toast.success(t('facturare.tabFacturi')); }} onCancel={() => setShowCreate(false)} />}
        {!showCreate && selected && <InvoiceDetail key={selected.id} invoice={selected} onReload={async () => { const upd = await getInvoice(selected.id); setSelected(upd); await loadInvoices(); }} />}
        {!showCreate && !selected && <EmptyState text={t('facturare.selectFactura')} />}
      </div>
    </div>
  );
}

function CreateInvoiceForm({ type, sites, onSave, onCancel }: { type: 'lucrari' | 'materiale'; sites: Site[]; onSave: (d: object) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    site_id: '', client_name: '', client_address: '', issue_date: today,
    due_date: '', payment_ref: '', notes: '', sicherheitseinbehalt_pct: '0',
    vat_rate: type === 'materiale' ? '19' : '0',
  });
  const [items, setItems] = useState([{ position: '1', description: '', unit: 'm', quantity: '', unit_price: '', purchase_price: '' }]);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const addItem = () => setItems(p => [...p, { position: String(p.length + 1), description: '', unit: 'm', quantity: '', unit_price: '', purchase_price: '' }]);
  const setItem = (i: number, k: string, v: string) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      invoice_type: type,
      site_id: form.site_id ? parseInt(form.site_id) : undefined,
      client_name: form.client_name,
      client_address: form.client_address || undefined,
      issue_date: form.issue_date,
      due_date: form.due_date || undefined,
      vat_rate: parseFloat(form.vat_rate),
      sicherheitseinbehalt_pct: parseFloat(form.sicherheitseinbehalt_pct) || 0,
      payment_ref: form.payment_ref || undefined,
      notes: form.notes || undefined,
      items: items.map((it, idx) => ({
        position: it.position || String(idx + 1),
        description: it.description,
        unit: it.unit,
        quantity: parseFloat(it.quantity),
        unit_price: parseFloat(it.unit_price || it.purchase_price),
        purchase_price: type === 'materiale' ? parseFloat(it.purchase_price) : undefined,
        admin_fee_pct: type === 'materiale' ? 3.0 : undefined,
      })),
    };
    await onSave(payload);
  }

  // Auto-fill billing data from site selection
  async function handleSiteChange(siteId: string) {
    f('site_id', siteId);
    if (siteId) {
      try {
        const cfg = await getBillingConfig(parseInt(siteId));
        if (cfg.billing_name) f('client_name', cfg.billing_name);
        if (cfg.billing_address) f('client_address', cfg.billing_address);
        if (cfg.sicherheitseinbehalt_pct) f('sicherheitseinbehalt_pct', String(cfg.sicherheitseinbehalt_pct));
      } catch { /* no config yet */ }
    }
  }

  const subTotal = items.reduce((s, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = type === 'materiale'
      ? (parseFloat(it.purchase_price) || 0) * 1.03
      : (parseFloat(it.unit_price) || 0);
    return s + qty * price;
  }, 0);
  const vat = subTotal * (parseFloat(form.vat_rate) / 100);
  const einbehalt = subTotal * (parseFloat(form.sicherheitseinbehalt_pct) / 100);

  return (
    <div style={card}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
        {type === 'lucrari' ? t('facturare.invoiceWorks') : t('facturare.invoiceMaterials')}
      </div>
      {type === 'materiale' && <div style={{ fontSize: 12, color: '#0891b2', marginBottom: 16 }}>{t('facturare.materialsHint')}</div>}
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {sectionHdr('Client')}
        <div>
          <label style={lbl}>{t('facturare.fieldSite')}</label>
          <select value={form.site_id} onChange={e => handleSiteChange(e.target.value)} style={inp}>
            <option value="">— {t('common.select')} —</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.kostenstelle})</option>)}
          </select>
        </div>
        <div><label style={lbl}>{t('facturare.fieldClientName')}</label><input required value={form.client_name} onChange={e => f('client_name', e.target.value)} style={inp} /></div>
        <div style={{ gridColumn: '1/-1' }}><label style={lbl}>{t('facturare.fieldClientAddress')}</label><textarea value={form.client_address} onChange={e => f('client_address', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} /></div>

        {sectionHdr(t('common.details'))}
        <div><label style={lbl}>{t('facturare.fieldIssueDate')}</label><input type="date" required value={form.issue_date} onChange={e => f('issue_date', e.target.value)} style={inp} /></div>
        <div><label style={lbl}>{t('facturare.fieldDueDate')}</label><input type="date" value={form.due_date} onChange={e => f('due_date', e.target.value)} style={inp} /></div>
        <div><label style={lbl}>{t('facturare.fieldVAT')}</label><input type="number" min="0" max="30" step="0.1" value={form.vat_rate} onChange={e => f('vat_rate', e.target.value)} style={inp} /></div>
        {type === 'lucrari' && <div><label style={lbl}>Sicherheitseinbehalt %</label><input type="number" min="0" max="20" step="0.5" value={form.sicherheitseinbehalt_pct} onChange={e => f('sicherheitseinbehalt_pct', e.target.value)} style={inp} /></div>}
        <div style={{ gridColumn: '1/-1' }}><label style={lbl}>{t('facturare.fieldPaymentRef')}</label><input value={form.payment_ref} onChange={e => f('payment_ref', e.target.value)} style={inp} /></div>

        {sectionHdr(t('common.description'))}
        <div style={{ gridColumn: '1/-1' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', width: 60 }}>{t('facturare.colPos')}</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>{t('facturare.colDescription')}</th>
                <th style={{ padding: '6px 8px', width: 60 }}>{t('facturare.colUnit')}</th>
                <th style={{ padding: '6px 8px', width: 70 }}>{t('facturare.colQty')}</th>
                {type === 'materiale' ? <th style={{ padding: '6px 8px', width: 90 }}>{t('facturare.colPriceAch')}</th> : <th style={{ padding: '6px 8px', width: 90 }}>{t('facturare.colPriceUnit')}</th>}
                <th style={{ padding: '6px 8px', width: 90 }}>{t('facturare.colTotal')}</th>
                <th style={{ width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const qty = parseFloat(it.quantity) || 0;
                const price = type === 'materiale' ? (parseFloat(it.purchase_price) || 0) * 1.03 : (parseFloat(it.unit_price) || 0);
                const total = qty * price;
                return (
                  <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px' }}><input value={it.position} onChange={e => setItem(i, 'position', e.target.value)} style={{ ...inp, padding: '5px 6px' }} /></td>
                    <td style={{ padding: '4px' }}><input required value={it.description} onChange={e => setItem(i, 'description', e.target.value)} style={{ ...inp, padding: '5px 6px' }} /></td>
                    <td style={{ padding: '4px' }}><input value={it.unit} onChange={e => setItem(i, 'unit', e.target.value)} style={{ ...inp, padding: '5px 6px' }} /></td>
                    <td style={{ padding: '4px' }}><input type="number" min="0" step="0.001" required value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} style={{ ...inp, padding: '5px 6px' }} /></td>
                    {type === 'materiale'
                      ? <td style={{ padding: '4px' }}><input type="number" min="0" step="0.01" required value={it.purchase_price} onChange={e => setItem(i, 'purchase_price', e.target.value)} style={{ ...inp, padding: '5px 6px' }} /></td>
                      : <td style={{ padding: '4px' }}><input type="number" min="0" step="0.01" required value={it.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} style={{ ...inp, padding: '5px 6px' }} /></td>
                    }
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>€{fmt(total)}</td>
                    <td style={{ padding: '4px' }}>{items.length > 1 && <button type="button" onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button" onClick={addItem} style={{ ...btnGhost, fontSize: 12, marginTop: 8 }}>{t('facturare.addPosition')}</button>
        </div>

        {/* Totals */}
        <div style={{ gridColumn: '1/-1' }}>
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 40 }}><span style={{ color: '#64748b' }}>{t('facturare.subtotalNetto')}</span><span style={{ fontWeight: 700 }}>€{fmt(subTotal)}</span></div>
            {parseFloat(form.vat_rate) > 0 && <div style={{ display: 'flex', gap: 40 }}><span style={{ color: '#64748b' }}>TVA {form.vat_rate}%:</span><span style={{ fontWeight: 700 }}>€{fmt(vat)}</span></div>}
            {type === 'lucrari' && einbehalt > 0 && <div style={{ display: 'flex', gap: 40 }}><span style={{ color: '#64748b' }}>Sicherheitseinbehalt {form.sicherheitseinbehalt_pct}%:</span><span style={{ fontWeight: 700, color: '#dc2626' }}>- €{fmt(einbehalt)}</span></div>}
            <div style={{ display: 'flex', gap: 40, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
              <span style={{ fontWeight: 700 }}>{t('facturare.totalDePlata')}</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#1d4ed8' }}>€{fmt(subTotal + vat - (type === 'lucrari' ? einbehalt : 0))}</span>
            </div>
          </div>
        </div>

        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="submit" style={btnPrimary}>{t('facturare.saveInvoice')}</button>
          <button type="button" onClick={onCancel} style={btnGhost}>{t('common.cancel')}</button>
        </div>
      </form>
    </div>
  );
}

function InvoiceDetail({ invoice, onReload }: { invoice: Invoice; onReload: () => Promise<void> }) {
  const { t } = useTranslation();
  const [showPayment, setShowPayment] = useState(false);
  const [payForm, setPayForm] = useState({ paid_amount: String(invoice.amount_payable), payment_date: new Date().toISOString().slice(0, 10), payment_ref: invoice.payment_ref || '' });
  const [showRelease, setShowRelease] = useState(false);
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().slice(0, 10));

  async function transition(status: string) {
    try { await updateInvoice(invoice.id, { status }); await onReload(); }
    catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    try {
      await registerPayment(invoice.id, { paid_amount: parseFloat(payForm.paid_amount), payment_date: payForm.payment_date, payment_ref: payForm.payment_ref || undefined });
      setShowPayment(false); await onReload();
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
  }

  async function submitRelease(e: React.FormEvent) {
    e.preventDefault();
    try {
      await releaseRetention(invoice.id, releaseDate);
      setShowRelease(false); await onReload();
    } catch (err: any) { toast.error(err?.response?.data?.detail || t('common.error')); }
  }

  const items = invoice.items || [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: 0, fontFamily: 'monospace' }}>{invoice.invoice_number}</h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{invoice.client_name} · {invoice.site_name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <Badge status={invoice.status} statusKeys={INVOICE_STATUS_KEYS} />
            <span style={{ background: invoice.invoice_type === 'lucrari' ? '#dbeafe' : '#d1fae5', color: invoice.invoice_type === 'lucrari' ? '#1e40af' : '#065f46', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{invoice.invoice_type}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {invoice.status === 'draft' && <button onClick={() => transition('sent')} style={{ ...btnPrimary, background: '#0891b2' }}>{t('facturare.markSent')}</button>}
          {['sent', 'overdue'].includes(invoice.status) && <button onClick={() => setShowPayment(true)} style={{ ...btnPrimary, background: '#059669' }}>{t('facturare.registerPayment')}</button>}
          {invoice.status === 'sent' && <button onClick={() => transition('overdue')} style={{ ...btnGhost, color: '#dc2626', borderColor: '#fca5a5' }}>{t('facturare.markOverdue')}</button>}
          {invoice.status === 'sent' && <button onClick={() => transition('cancelled')} style={{ ...btnGhost, color: '#64748b' }}>{t('facturare.cancelInvoice')}</button>}
          {invoice.sicherheitseinbehalt_amount > 0 && !invoice.sicherheitseinbehalt_released && invoice.status === 'paid' && (
            <button onClick={() => setShowRelease(true)} style={{ ...btnGhost, color: '#059669', borderColor: '#6ee7b7' }}>{t('facturare.releaseGuarantee')}</button>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && (
        <div style={{ ...card, marginBottom: 20, border: '1px solid #6ee7b7' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#065f46' }}>{t('facturare.paymentModal')}</div>
          <form onSubmit={submitPayment} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>{t('facturare.fieldPaidAmount')}</label><input type="number" min="0" step="0.01" required value={payForm.paid_amount} onChange={e => setPayForm(p => ({ ...p, paid_amount: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>{t('facturare.fieldPaymentDate')}</label><input type="date" required value={payForm.payment_date} onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>{t('facturare.fieldPaymentRef2')}</label><input value={payForm.payment_ref} onChange={e => setPayForm(p => ({ ...p, payment_ref: e.target.value }))} style={inp} /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
              <button type="submit" style={{ ...btnPrimary, background: '#059669' }}>{t('facturare.confirmPayment')}</button>
              <button type="button" onClick={() => setShowPayment(false)} style={btnGhost}>{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Release retention modal */}
      {showRelease && (
        <div style={{ ...card, marginBottom: 20, border: '1px solid #6ee7b7' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{t('facturare.releaseModal')} — €{fmt(invoice.sicherheitseinbehalt_amount)}</div>
          <form onSubmit={submitRelease} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div><label style={lbl}>{t('facturare.releaseDate')}</label><input type="date" required value={releaseDate} onChange={e => setReleaseDate(e.target.value)} style={{ ...inp, width: 180 }} /></div>
            <button type="submit" style={{ ...btnPrimary, background: '#059669' }}>{t('facturare.confirmRelease')}</button>
            <button type="button" onClick={() => setShowRelease(false)} style={btnGhost}>{t('common.cancel')}</button>
          </form>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          [t('facturare.kpiNetto'), `€${fmt(invoice.subtotal)}`],
          [t('facturare.kpiTva'), invoice.vat_amount > 0 ? `€${fmt(invoice.vat_amount)}` : '0%'],
          [t('facturare.kpiTotalBrutto'), `€${fmt(invoice.total)}`],
          [t('facturare.kpiDePlata'), `€${fmt(invoice.amount_payable)}`],
        ].map(([label, val]) => (
          <div key={label} style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Sicherheitseinbehalt */}
      {invoice.sicherheitseinbehalt_amount > 0 && (
        <div style={{ background: invoice.sicherheitseinbehalt_released ? '#d1fae5' : '#fef3c7', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Sicherheitseinbehalt {invoice.sicherheitseinbehalt_pct}%:</strong> €{fmt(invoice.sicherheitseinbehalt_amount)}
            {invoice.sicherheitseinbehalt_released && <span style={{ marginLeft: 12, color: '#059669', fontWeight: 700 }}>{t('facturare.released')} {fmtDate(invoice.sicherheitseinbehalt_release_date)}</span>}
          </div>
          {!invoice.sicherheitseinbehalt_released && <span style={{ fontSize: 11, color: '#92400e' }}>{t('facturare.retained')}</span>}
        </div>
      )}

      {/* Payment info */}
      {invoice.status === 'paid' && (
        <div style={{ background: '#d1fae5', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
          <strong>{t('facturare.paid')}</strong> €{fmt(invoice.paid_amount)} pe {fmtDate(invoice.payment_date)}
          {invoice.payment_ref && <span style={{ marginLeft: 12, color: '#64748b' }}>Ref: {invoice.payment_ref}</span>}
        </div>
      )}

      {/* Items */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 12 }}>{t('facturare.invoicedPositions')}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {[t('facturare.colPos'), t('facturare.colDescription'), t('facturare.colUnit'), t('facturare.colQty'), invoice.invoice_type === 'materiale' ? t('facturare.colPriceAch') : t('facturare.colPriceUnit'), t('facturare.colTotal')].map((h, hi) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: hi >= 3 ? 'right' : 'left', fontWeight: 700, color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{it.position}</td>
                  <td style={{ padding: '7px 10px' }}>{it.description}</td>
                  <td style={{ padding: '7px 10px' }}>{it.unit}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{it.quantity}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>€{(invoice.invoice_type === 'materiale' ? (it.purchase_price || it.unit_price) : it.unit_price).toFixed(2)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>€{fmt(it.total_price)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                <td colSpan={5} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{t('facturare.totalNetto')}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8' }}>€{fmt(invoice.subtotal)}</td>
              </tr>
              {invoice.vat_amount > 0 && (
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan={5} style={{ padding: '4px 10px', textAlign: 'right', color: '#64748b' }}>TVA {invoice.vat_rate}%</td>
                  <td style={{ padding: '4px 10px', textAlign: 'right' }}>€{fmt(invoice.vat_amount)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Client info */}
      {invoice.client_address && (
        <div style={{ ...card, marginTop: 16, fontSize: 13, color: '#64748b' }}>
          <strong style={{ color: '#1e293b' }}>{invoice.client_name}</strong><br />
          <span style={{ whiteSpace: 'pre-line' }}>{invoice.client_address}</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURARE TAB
// ══════════════════════════════════════════════════════════════════════════════

function ConfigurareTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const [selectedSite, setSelectedSite] = useState<number | null>(null);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const baustellen = sites.filter(s => s.status === 'active');

  async function loadConfig(siteId: number) {
    setLoading(true);
    try {
      const data = await getBillingConfig(siteId);
      setCfg({
        billing_name: data.billing_name || '',
        billing_address: data.billing_address || '',
        billing_vat_id: data.billing_vat_id || '',
        billing_email: data.billing_email || '',
        billing_iban: data.billing_iban || '',
        billing_bic: data.billing_bic || '',
        billing_bank: data.billing_bank || '',
        sicherheitseinbehalt_pct: String(data.sicherheitseinbehalt_pct || 0),
      });
    } catch { toast.error(t('facturare.errorLoad')); }
    finally { setLoading(false); }
  }

  function handleSiteChange(id: string) {
    const siteId = parseInt(id);
    setSelectedSite(siteId);
    loadConfig(siteId);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSite) return;
    setSaving(true);
    try {
      await saveBillingConfig(selectedSite, { ...cfg, sicherheitseinbehalt_pct: parseFloat(cfg.sicherheitseinbehalt_pct) || 0 });
      toast.success(t('facturare.configSaved'));
    } catch { toast.error(t('facturare.errorSave')); }
    finally { setSaving(false); }
  }

  const site = baustellen.find(s => s.id === selectedSite);

  return (
    <div className="page-root" style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>{t('facturare.configurare')}</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>{t('facturare.configurareDesc')}</div>

      <div style={{ marginBottom: 20 }}>
        <label style={lbl}>{t('facturare.selectProject')}</label>
        <select value={selectedSite || ''} onChange={e => handleSiteChange(e.target.value)} style={{ ...inp, maxWidth: 400 }}>
          <option value="">— {t('common.select')} —</option>
          {baustellen.map(s => <option key={s.id} value={s.id}>{s.name} · KST {s.kostenstelle} ({s.client})</option>)}
        </select>
      </div>

      {selectedSite && !loading && (
        <form onSubmit={save} style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {site && <div style={{ gridColumn: '1/-1', background: '#f0f9ff', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#0369a1' }}>
            <strong>{site.name}</strong> · KST {site.kostenstelle} · Client: {site.client}
          </div>}

          {sectionHdr(t('facturare.clientDataSection'))}
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>{t('facturare.clientLegalName')}</label><input value={cfg.billing_name || ''} onChange={e => setCfg(p => ({ ...p, billing_name: e.target.value }))} placeholder="ex: Axians IT Solutions GmbH" style={inp} /></div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>{t('facturare.clientFullAddress')}</label><textarea value={cfg.billing_address || ''} onChange={e => setCfg(p => ({ ...p, billing_address: e.target.value }))} rows={3} placeholder="Stradă, nr., cod poștal, oraș, țară" style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} /></div>
          <div><label style={lbl}>{t('facturare.clientVatId')}</label><input value={cfg.billing_vat_id || ''} onChange={e => setCfg(p => ({ ...p, billing_vat_id: e.target.value }))} placeholder="DE123456789" style={inp} /></div>
          <div><label style={lbl}>{t('facturare.clientEmail')}</label><input type="email" value={cfg.billing_email || ''} onChange={e => setCfg(p => ({ ...p, billing_email: e.target.value }))} style={inp} /></div>

          {sectionHdr(t('facturare.bankSection'))}
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>IBAN</label><input value={cfg.billing_iban || ''} onChange={e => setCfg(p => ({ ...p, billing_iban: e.target.value }))} placeholder="DE..." style={inp} /></div>
          <div><label style={lbl}>BIC</label><input value={cfg.billing_bic || ''} onChange={e => setCfg(p => ({ ...p, billing_bic: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>Bank</label><input value={cfg.billing_bank || ''} onChange={e => setCfg(p => ({ ...p, billing_bank: e.target.value }))} placeholder="ex: Volksbank Stuttgart" style={inp} /></div>

          {sectionHdr(t('facturare.contractSection'))}
          <div>
            <label style={lbl}>{t('facturare.guaranteeField')}</label>
            <input type="number" min="0" max="20" step="0.5" value={cfg.sicherheitseinbehalt_pct || '0'} onChange={e => setCfg(p => ({ ...p, sicherheitseinbehalt_pct: e.target.value }))} style={inp} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{t('facturare.guaranteeNote')}</span>
          </div>

          <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" style={btnPrimary} disabled={saving}>{saving ? t('facturare.savingConfig') : t('facturare.saveConfig')}</button>
          </div>
        </form>
      )}
      {loading && <div style={{ color: '#94a3b8', fontSize: 13 }}>{t('common.loading')}</div>}
      {!selectedSite && <div style={{ ...card, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>{t('facturare.selectProjectHint')}</div>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#94a3b8', fontSize: 14 }}>{text}</div>;
}
