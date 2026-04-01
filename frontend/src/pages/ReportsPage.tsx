import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { fetchReportSummary, fetchCostsReport, fetchAufmassReport } from '../api/reports';
import { fetchProgramari } from '../api/programari';
import { fetchSites } from '../api/sites';
import type { Site } from '../types';

// ─── Styles ───────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 };
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};
const btnPrimary: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 6, border: 'none',
  background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db',
  background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151',
};

const CATEGORY_COLORS: Record<string, string> = {
  manopera: '#3b82f6', materiale: '#10b981', subcontractori: '#f59e0b',
  utilaje: '#8b5cf6', combustibil: '#ef4444', transport: '#06b6d4', alte: '#94a3b8',
};
const STATUS_PROG: Record<string, { bg: string; color: string; label: string }> = {
  new:         { bg: '#f1f5f9', color: '#475569', label: 'new' },
  scheduled:   { bg: '#dbeafe', color: '#1e40af', label: 'scheduled' },
  in_progress: { bg: '#fef3c7', color: '#92400e', label: 'in_progress' },
  done:        { bg: '#d1fae5', color: '#065f46', label: 'done' },
  cancelled:   { bg: '#fee2e2', color: '#991b1b', label: 'cancelled' },
};

function StatusBadge({ status, map }: { status: string; map: Record<string, { bg: string; color: string; label: string }> }) {
  const { t } = useTranslation();
  const s = map[status] || { bg: '#f1f5f9', color: '#475569', label: status };
  const label = s.label in STATUS_PROG
    ? t(`hausanschluss.status.${s.label}` as any, s.label)
    : s.label;
  return <span style={{ background: s.bg, color: s.color, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{label}</span>;
}

// ─── Shared Filters ───────────────────────────────────────────────────────────

interface Filters { site_id: string; date_from: string; date_to: string; }

function FilterBar({ filters, setFilters, sites, onApply, extras }: {
  filters: Filters; setFilters: (f: Filters) => void; sites: Site[];
  onApply: () => void; extras?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const f = (k: keyof Filters, v: string) => setFilters({ ...filters, [k]: v });
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div>
        <label style={lbl}>{t('reports.filterSite')}</label>
        <select value={filters.site_id} onChange={e => f('site_id', e.target.value)} style={{ ...inp, width: 220 }}>
          <option value="">{t('reports.allSites')}</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
        </select>
      </div>
      <div>
        <label style={lbl}>{t('reports.filterFrom')}</label>
        <input type="date" value={filters.date_from} onChange={e => f('date_from', e.target.value)} style={{ ...inp, width: 150 }} />
      </div>
      <div>
        <label style={lbl}>{t('reports.filterTo')}</label>
        <input type="date" value={filters.date_to} onChange={e => f('date_to', e.target.value)} style={{ ...inp, width: 150 }} />
      </div>
      {extras}
      <button style={btnPrimary} onClick={onApply}>{t('reports.applyFilter')}</button>
      <button style={btnSecondary} onClick={() => { setFilters({ site_id: '', date_from: '', date_to: '' }); }}>{t('reports.resetFilter')}</button>
    </div>
  );
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────

function SummaryTab() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const [data, setData] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetchReportSummary().then(setData).catch(() => toast.error(t('common.error')));
  }, []);

  if (!data) return <div style={{ color: '#94a3b8', padding: 20 }}>{t('reports.loading')}</div>;

  const kpis = [
    { label: t('reports.kpi.activeSites'), value: `${data.sites_active} / ${data.sites_total}`, color: '#1d4ed8' },
    { label: t('reports.kpi.totalCosts'), value: `${data.total_costs.toLocaleString(locale)} EUR`, color: '#dc2626' },
    { label: t('reports.kpi.aufmassApproved'), value: `${data.aufmass_approved.toLocaleString(locale)} EUR`, color: '#16a34a' },
    { label: t('reports.kpi.programariStats'), value: `${data.programari_total} / ${data.programari_done}`, color: '#7c3aed' },
    { label: t('reports.kpi.equipmentActive'), value: String(data.equipment_active), color: '#0891b2' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 8 }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 16 }}>{t('reports.notes')}</div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
          <div>{t('reports.notesCosts')}</div>
          <div>{t('reports.notesAufmass')}</div>
          <div>{t('reports.notesOther')}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Costs Tab ────────────────────────────────────────────────────────────────

function CostsTab({ sites }: { sites: Site[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const [data, setData] = useState<any[]>([]);
  const [filters, setFilters] = useState<Filters>({ site_id: '', date_from: '', date_to: '' });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = (f = filters) => {
    const params: Record<string, string | number> = {};
    if (f.site_id) params.site_id = parseInt(f.site_id);
    if (f.date_from) params.date_from = f.date_from;
    if (f.date_to) params.date_to = f.date_to;
    fetchCostsReport(params).then(setData).catch(() => toast.error(t('common.error')));
  };

  useEffect(() => { load(); }, []);

  const grandTotal = data.reduce((s, r) => s + r.total, 0);
  const maxTotal = Math.max(...data.map(r => r.total), 1);

  const allCategories = Array.from(new Set(data.flatMap(r => Object.keys(r.categories))));

  return (
    <div>
      <FilterBar filters={filters} setFilters={setFilters} sites={sites} onApply={() => load(filters)} />

      {data.length === 0 ? (
        <div style={{ ...card, padding: 32, textAlign: 'center', color: '#94a3b8' }}>{t('reports.noData')}</div>
      ) : (
        <>
          {/* Grand total */}
          <div style={{ ...card, padding: '14px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#1e293b' }}>{t('reports.grandTotal')}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{grandTotal.toLocaleString(locale, { minimumFractionDigits: 2 })} EUR</span>
          </div>

          {/* Per-site rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.map((row: any) => {
              const isExpanded = expanded.has(row.site_id);
              const pct = Math.round((row.total / grandTotal) * 100);
              return (
                <div key={row.site_id} style={card}>
                  {/* Site header */}
                  <div
                    onClick={() => setExpanded(p => { const n = new Set(p); isExpanded ? n.delete(row.site_id) : n.add(row.site_id); return n; })}
                    style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
                  >
                    <span style={{ fontSize: 13, color: '#94a3b8', width: 12 }}>{isExpanded ? '▾' : '▸'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        {row.kostenstelle} — {row.site_name}
                      </div>
                      {/* CSS bar */}
                      <div style={{ marginTop: 6, height: 6, background: '#f1f5f9', borderRadius: 3, width: '100%' }}>
                        <div style={{ height: '100%', width: `${(row.total / maxTotal) * 100}%`, background: '#3b82f6', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>{row.total.toLocaleString(locale, { minimumFractionDigits: 2 })} EUR</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{t('reports.pct', { pct })}</div>
                    </div>
                  </div>

                  {/* Expanded categories */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 20px 16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                        {Object.entries(row.categories).map(([cat, amt]: [string, any]) => (
                          <div key={cat} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${CATEGORY_COLORS[cat] || '#94a3b8'}` }}>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{t(`sites.categories.${cat}` as any, cat)}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{amt.toLocaleString(locale, { minimumFractionDigits: 2 })} EUR</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary table */}
          {allCategories.length > 0 && (
            <div style={{ ...card, marginTop: 20, overflow: 'auto' }}>
              <div style={{ padding: '14px 20px', fontWeight: 700, fontSize: 13, color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>{t('reports.categorySummary')}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '8px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{t('reports.colSite')}</th>
                    {allCategories.map(c => (
                      <th key={c} style={{ padding: '8px 12px', textAlign: 'right', color: CATEGORY_COLORS[c] || '#64748b', fontWeight: 600 }}>
                        {t(`sites.categories.${c}` as any, c)}
                      </th>
                    ))}
                    <th style={{ padding: '8px 16px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any) => (
                    <tr key={row.site_id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 16px', color: '#1e293b', fontWeight: 600 }}>{row.site_name}</td>
                      {allCategories.map(c => (
                        <td key={c} style={{ padding: '9px 12px', textAlign: 'right', color: '#475569' }}>
                          {row.categories[c] ? row.categories[c].toLocaleString(locale, { minimumFractionDigits: 2 }) : '—'}
                        </td>
                      ))}
                      <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                        {row.total.toLocaleString(locale, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Programări Tab ───────────────────────────────────────────────────────────

function ProgramariTab({ sites }: { sites: Site[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const [data, setData] = useState<any[]>([]);
  const [filters, setFilters] = useState<Filters>({ site_id: '', date_from: '', date_to: '' });
  const [filterStatus, setFilterStatus] = useState('');

  const load = (f = filters, st = filterStatus) => {
    const params: Record<string, string | number> = {};
    if (f.site_id) params.site_id = parseInt(f.site_id);
    if (f.date_from) params.date_from = f.date_from;
    if (f.date_to) params.date_to = f.date_to;
    if (st) params.status = st;
    fetchProgramari(params).then(setData).catch(() => toast.error(t('common.error')));
  };

  useEffect(() => { load(); }, []);

  // Group by date
  const grouped: Record<string, any[]> = {};
  data.forEach(p => {
    const d = p.scheduled_date ? p.scheduled_date.slice(0, 10) : 'fără dată';
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(p);
  });
  const sortedDates = Object.keys(grouped).sort();

  const counts = {
    total: data.length,
    done: data.filter(p => p.status === 'done').length,
    scheduled: data.filter(p => p.status === 'scheduled').length,
    cancelled: data.filter(p => p.status === 'cancelled').length,
  };

  return (
    <div>
      <FilterBar
        filters={filters} setFilters={setFilters} sites={sites}
        onApply={() => load(filters, filterStatus)}
        extras={
          <div>
            <label style={lbl}>{t('reports.filterStatus')}</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 150 }}>
              <option value="">{t('reports.allStatuses')}</option>
              <option value="scheduled">{t('hausanschluss.status.scheduled')}</option>
              <option value="in_progress">{t('hausanschluss.status.in_progress')}</option>
              <option value="done">{t('hausanschluss.status.done')}</option>
              <option value="cancelled">{t('hausanschluss.status.cancelled')}</option>
            </select>
          </div>
        }
      />

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          [t('reports.scheduleCounts.total'), counts.total, '#1d4ed8'],
          [t('reports.scheduleCounts.scheduled'), counts.scheduled, '#d97706'],
          [t('reports.scheduleCounts.done'), counts.done, '#16a34a'],
          [t('reports.scheduleCounts.cancelled'), counts.cancelled, '#dc2626'],
        ].map(([label, val, color]) => (
          <div key={String(label)} style={{ ...card, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: String(color) }}>{val}</div>
          </div>
        ))}
      </div>

      {data.length === 0 ? (
        <div style={{ ...card, padding: 32, textAlign: 'center', color: '#94a3b8' }}>{t('reports.noSchedules')}</div>
      ) : sortedDates.map(d => (
        <div key={d} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8, paddingLeft: 4 }}>
            {d !== 'fără dată' ? new Date(d).toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase() : t('common.noData').toUpperCase()}
            <span style={{ marginLeft: 8, color: '#94a3b8', fontWeight: 500 }}>({t('reports.countSchedules', { count: grouped[d].length })})</span>
          </div>
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {[t('reports.colHour'), t('reports.colClient'), t('reports.colAddress'), t('reports.colType'), t('reports.colSite'), t('reports.colStatus')].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped[d].map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 14px', color: '#1d4ed8', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {p.scheduled_date ? new Date(p.scheduled_date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', color: '#1e293b', fontWeight: 600 }}>{p.client_name}</td>
                    <td style={{ padding: '9px 14px', color: '#475569' }}>{p.address}{p.city ? `, ${p.city}` : ''}</td>
                    <td style={{ padding: '9px 14px', color: '#64748b' }}>{p.connection_type || '—'}</td>
                    <td style={{ padding: '9px 14px', color: '#64748b' }}>{p.assigned_site_name || '—'}</td>
                    <td style={{ padding: '9px 14px' }}><StatusBadge status={String(p.status)} map={STATUS_PROG} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Aufmaß Tab ───────────────────────────────────────────────────────────────

const STATUS_AUFMASS: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#f1f5f9', color: '#475569', label: 'draft' },
  submitted: { bg: '#fef3c7', color: '#92400e', label: 'submitted' },
  approved:  { bg: '#d1fae5', color: '#065f46', label: 'approved' },
};

function AufmassStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const s = STATUS_AUFMASS[status] || STATUS_AUFMASS.draft;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {t(`aufmass.status.${s.label}` as any, s.label)}
    </span>
  );
}

function AufmassTab({ sites }: { sites: Site[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const [data, setData] = useState<any[]>([]);
  const [filters, setFilters] = useState<Filters>({ site_id: '', date_from: '', date_to: '' });
  const [filterStatus, setFilterStatus] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = (f = filters, st = filterStatus) => {
    const params: Record<string, string | number> = {};
    if (f.site_id) params.site_id = parseInt(f.site_id);
    if (f.date_from) params.date_from = f.date_from;
    if (f.date_to) params.date_to = f.date_to;
    if (st) params.status = st;
    fetchAufmassReport(params).then(setData).catch(() => toast.error(t('common.error')));
  };

  useEffect(() => { load(); }, []);

  const totalAll = data.reduce((s, r) => s + r.total_all, 0);
  const totalApproved = data.reduce((s, r) => s + r.total_approved, 0);

  return (
    <div>
      <FilterBar
        filters={filters} setFilters={setFilters} sites={sites}
        onApply={() => load(filters, filterStatus)}
        extras={
          <div>
            <label style={lbl}>{t('reports.filterStatus')}</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 140 }}>
              <option value="">{t('reports.allStatuses')}</option>
              <option value="draft">{t('aufmass.status.draft')}</option>
              <option value="submitted">{t('aufmass.status.submitted')}</option>
              <option value="approved">{t('aufmass.status.approved')}</option>
            </select>
          </div>
        }
      />

      {/* Totals */}
      {data.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ ...card, padding: '14px 20px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{t('reports.totalValue')}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{totalAll.toLocaleString(locale, { minimumFractionDigits: 2 })} EUR</span>
          </div>
          <div style={{ ...card, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', background: '#d1fae5' }}>
            <span style={{ fontSize: 13, color: '#065f46' }}>{t('reports.approvedValue')}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#065f46' }}>{totalApproved.toLocaleString(locale, { minimumFractionDigits: 2 })} EUR</span>
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div style={{ ...card, padding: 32, textAlign: 'center', color: '#94a3b8' }}>{t('reports.noAufmass')}</div>
      ) : data.map((site: any) => {
        const isExpanded = expanded.has(site.site_id);
        return (
          <div key={site.site_id} style={{ ...card, marginBottom: 10 }}>
            <div
              onClick={() => setExpanded(p => { const n = new Set(p); isExpanded ? n.delete(site.site_id) : n.add(site.site_id); return n; })}
              style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{isExpanded ? '▾' : '▸'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{site.kostenstelle} — {site.site_name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{t('reports.countEntries', { count: site.entries.length })}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{site.total_approved.toLocaleString(locale, { minimumFractionDigits: 2 })} EUR {t('reports.approved')}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('common.total')}: {site.total_all.toLocaleString(locale, { minimumFractionDigits: 2 })} EUR</div>
              </div>
            </div>

            {isExpanded && (
              <div style={{ borderTop: '1px solid #f1f5f9' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {[t('aufmass.colDate'), t('aufmass.colPosition'), t('aufmass.colDescription'), t('aufmass.colQty'), t('aufmass.colUnit'), t('aufmass.colUnitPrice'), t('aufmass.colTotal'), t('aufmass.colStatus')].map(h => (
                        <th key={h} style={{ padding: '7px 14px', textAlign: h === t('aufmass.colTotal') || h === t('aufmass.colUnitPrice') || h === t('aufmass.colQty') ? 'right' : 'left', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {site.entries.map((e: any) => (
                      <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(e.date).toLocaleDateString(locale)}</td>
                        <td style={{ padding: '8px 14px', color: '#1d4ed8', fontWeight: 700 }}>{e.position}</td>
                        <td style={{ padding: '8px 14px', color: '#1e293b', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', color: '#475569' }}>{e.quantity}</td>
                        <td style={{ padding: '8px 14px', color: '#64748b' }}>{e.unit}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', color: '#475569' }}>{e.unit_price != null ? e.unit_price.toFixed(2) : '—'}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{e.total_price != null ? e.total_price.toFixed(2) : '—'}</td>
                        <td style={{ padding: '8px 14px' }}><AufmassStatusBadge status={e.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                      <td colSpan={6} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#64748b', fontSize: 11 }}>TOTAL SITE</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{site.total_all.toFixed(2)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = 'summary' | 'costs' | 'programari' | 'aufmass';

export function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>('summary');
  const [sites, setSites] = useState<Site[]>([]);

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'summary',    label: t('reports.tabs.summary') },
    { key: 'costs',      label: t('reports.tabs.costs') },
    { key: 'programari', label: t('reports.tabs.programari') },
    { key: 'aufmass',    label: t('reports.tabs.aufmass') },
  ];

  useEffect(() => { fetchSites().then(setSites); }, []);

  return (
    <div className="page-root">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>{t('reports.title')}</h1>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{t('reports.subtitle')}</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #e2e8f0' }}>
        {TABS.map(tabItem => (
          <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
            style={{
              padding: '10px 24px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              color: tab === tabItem.key ? '#1d4ed8' : '#64748b',
              borderBottom: tab === tabItem.key ? '2px solid #1d4ed8' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === 'summary'    && <SummaryTab />}
      {tab === 'costs'      && <CostsTab sites={sites} />}
      {tab === 'programari' && <ProgramariTab sites={sites} />}
      {tab === 'aufmass'    && <AufmassTab sites={sites} />}
    </div>
  );
}
