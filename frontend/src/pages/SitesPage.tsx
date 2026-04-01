import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { fetchSites, fetchCosts, addCost, fetchMaterials, addMaterial, createSite, updateSite } from '../api/sites';
import { fetchProgramari } from '../api/programari';
import { fetchTagesberichtEntries } from '../api/tagesbericht';
import type { Site, Cost, MaterialLog } from '../types';

interface Programare {
  id: number;
  client_name: string;
  address: string;
  city: string | null;
  scheduled_date: string;
  status: string;
  assigned_team_name: string | null;
  connection_type: string | null;
}

const STATUS_COLORS_HA: Record<string, [string, string]> = {
  new:         ['#eff6ff', '#1d4ed8'],
  scheduled:   ['#fef3c7', '#d97706'],
  in_progress: ['#dbeafe', '#2563eb'],
  done:        ['#d1fae5', '#059669'],
  cancelled:   ['#f1f5f9', '#94a3b8'],
};

const STATUS_COLORS: Record<string, [string, string]> = {
  active:   ['#d1fae5', '#059669'],
  paused:   ['#fef3c7', '#d97706'],
  finished: ['#f1f5f9', '#64748b'],
};

const COST_CATEGORIES = ['manopera','materiale','subcontractori','utilaje','combustibil','transport','alte'];

const TB_LABELS: Record<string, string> = {
  poze_inainte:     'Poze Înainte',
  teratest:         'Teratest',
  semne_circulatie: 'Semne Circulație',
  liefer_scheine:   'Liefer Scheine',
  montaj_nvt_pdp:   'Montaj NVT/PDP/MFG',
  hp_plus:          'HP+',
  ha:               'HA',
  reparatie:        'Reparație',
  tras_teava:       'Tras Țeavă',
  groapa:           'Groapă',
  traversare:       'Traversare',
  sapatura:         'Săpătură',
  raport_zilnic:    'Raport Zilnic',
};

function printTagesbericht(entries: any[], siteName: string) {
  const rows = entries.map(e => {
    const fields = Object.entries(e.data)
      .map(([k, v]) => `<tr><td style="padding:3px 8px;color:#64748b;font-size:11px;white-space:nowrap">${k.replace(/_/g,' ')}</td><td style="padding:3px 8px;font-size:12px">${String(v) || '—'}</td></tr>`)
      .join('');
    const photos = e.photos?.map((ph: any) =>
      `<div style="display:inline-block;margin:4px;text-align:center">
        <img src="${ph.url}" style="width:100px;height:100px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0"/>
        <div style="font-size:9px;color:#64748b;margin-top:2px">${ph.category}</div>
      </div>`
    ).join('') ?? '';
    const date = new Date(e.created_at).toLocaleString('ro-RO', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    return `
      <div style="page-break-inside:avoid;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="background:#0f172a;color:#f1f5f9;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700;font-size:13px">${TB_LABELS[e.work_type] ?? e.work_type}</span>
          <span style="font-size:11px;color:#94a3b8">${date}${e.nvt_number ? ' — ' + e.nvt_number : ''}</span>
        </div>
        <div style="padding:10px 12px">
          <table style="width:100%;border-collapse:collapse">${fields}</table>
          ${photos ? `<div style="margin-top:10px">${photos}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tagesbericht — ${siteName}</title>
  <style>@media print{body{margin:0}}</style></head>
  <body style="font-family:sans-serif;padding:24px;color:#1e293b">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0f172a">
      <div>
        <h1 style="margin:0;font-size:20px;color:#0f172a">Tagesbericht</h1>
        <div style="font-size:13px;color:#64748b;margin-top:4px">${siteName}</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#94a3b8">
        Generat: ${new Date().toLocaleString('ro-RO')}<br/>
        ${entries.length} rapoarte
      </div>
    </div>
    ${rows}
  </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

const EMPTY_SITE_FORM = {
  kostenstelle: '', name: '', client: '', address: '', budget: '', notes: '',
  start_date: '', end_date: '',
};

const EMPTY_KST_FORM = {
  kostenstelle: '', name: '', client: 'Hesti Rossmann', notes: '',
};

export function SitesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const [view, setView]             = useState<'baustellen' | 'kostenstellen'>('baustellen');
  const [sites, setSites]           = useState<Site[]>([]);
  const [allKst, setAllKst]         = useState<Site[]>([]);
  const [selected, setSelected]     = useState<Site | null>(null);
  const [costs, setCosts]           = useState<{ total: number; by_category: Record<string, number>; items: Cost[] } | null>(null);
  const [materials, setMaterials]   = useState<MaterialLog[]>([]);
  const [tab, setTab]               = useState<'costs' | 'materials' | 'programari' | 'tagesbericht'>('costs');
  const [programari, setProgramari] = useState<Programare[]>([]);
  const [tagesbericht, setTagesbericht] = useState<any[]>([]);
  const [tbFilterType, setTbFilterType] = useState('');
  const [tbFilterDate, setTbFilterDate] = useState('');
  const [tbExpanded, setTbExpanded] = useState<number | null>(null);
  const [showPdfExport, setShowPdfExport] = useState(false);
  const [pdfFields, setPdfFields] = useState<Record<string, boolean>>({
    poze_inainte: true, teratest: true, semne_circulatie: true, liefer_scheine: true,
    montaj_nvt_pdp: true, hp_plus: true, ha: true, reparatie: true,
    tras_teava: true, groapa: true, traversare: true, sapatura: true, raport_zilnic: true,
  });
  const [showCostForm, setShowCostForm] = useState(false);
  const [showMatForm, setShowMatForm]   = useState(false);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [showKstForm, setShowKstForm]   = useState(false);
  const [showEditSite, setShowEditSite] = useState(false);
  const [editSiteForm, setEditSiteForm] = useState({ status: 'active', start_date: '', end_date: '' });
  const [siteForm, setSiteForm]     = useState(EMPTY_SITE_FORM);
  const [kstForm, setKstForm]       = useState(EMPTY_KST_FORM);
  const [costForm, setCostForm]     = useState({ category: 'materiale', description: '', amount: '', supplier: '', invoice_ref: '', notes: '' });
  const [matForm, setMatForm]       = useState({ material: '', quantity: '', unit: 'buc', notes: '' });

  useEffect(() => { fetchSites(true).then(setSites).catch(() => {}); }, []);
  useEffect(() => { fetchSites(false).then(setAllKst).catch(() => {}); }, []);

  async function submitKst(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createSite({ ...kstForm, is_baustelle: false });
      toast.success(t('sites.kstAdded'));
      const updated = await fetchSites(false);
      setAllKst(updated);
      setShowKstForm(false);
      setKstForm(EMPTY_KST_FORM);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || t('common.error');
      toast.error(typeof msg === 'string' ? msg : t('common.error'));
    }
  }

  async function selectSite(s: Site) {
    setSelected(s);
    setShowSiteForm(false);
    setShowKstForm(false);
    const [c, m, p, tb] = await Promise.all([
      fetchCosts(s.id),
      fetchMaterials(s.id),
      fetchProgramari({ site_id: s.id }),
      fetchTagesberichtEntries({ site_id: s.id }),
    ]);
    setCosts(c); setMaterials(m); setProgramari(p); setTagesbericht(tb);
  }

  async function submitSite(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {
        kostenstelle: siteForm.kostenstelle,
        name: siteForm.name,
        client: siteForm.client,
        is_baustelle: true,
      };
      if (siteForm.address)    payload.address    = siteForm.address;
      if (siteForm.budget)     payload.budget     = parseFloat(siteForm.budget);
      if (siteForm.notes)      payload.notes      = siteForm.notes;
      if (siteForm.start_date) payload.start_date = siteForm.start_date;
      if (siteForm.end_date)   payload.end_date   = siteForm.end_date;

      const newSite = await createSite(payload);
      toast.success(t('sites.siteCreated'));
      const updated = await fetchSites(true);
      setSites(updated);
      setShowSiteForm(false);
      setSiteForm(EMPTY_SITE_FORM);
      selectSite(newSite);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || t('common.error');
      toast.error(typeof msg === 'string' ? msg : t('common.error'));
    }
  }

  async function submitCost(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await addCost(selected.id, { ...costForm, amount: parseFloat(costForm.amount) });
      toast.success(t('common.success'));
      const c = await fetchCosts(selected.id);
      setCosts(c);
      setShowCostForm(false);
      setCostForm({ category: 'materiale', description: '', amount: '', supplier: '', invoice_ref: '', notes: '' });
    } catch { toast.error(t('common.error')); }
  }

  async function submitMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await addMaterial(selected.id, { ...matForm, quantity: parseFloat(matForm.quantity) });
      toast.success(t('common.success'));
      const m = await fetchMaterials(selected.id);
      setMaterials(m);
      setShowMatForm(false);
      setMatForm({ material: '', quantity: '', unit: 'buc', notes: '' });
    } catch { toast.error(t('common.error')); }
  }

  async function submitEditSite(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      const payload: Record<string, unknown> = { status: editSiteForm.status };
      if (editSiteForm.start_date) payload.start_date = editSiteForm.start_date;
      if (editSiteForm.end_date)   payload.end_date   = editSiteForm.end_date;
      await updateSite(selected.id, payload);
      toast.success(t('common.success'));
      const updatedSelected = { ...selected, status: editSiteForm.status as any,
        start_date: editSiteForm.start_date || selected.start_date,
        end_date: editSiteForm.end_date || selected.end_date,
      };
      setSelected(updatedSelected);
      setSites(prev => prev.map(s => s.id === selected.id ? updatedSelected : s));
      setShowEditSite(false);
    } catch { toast.error(t('common.error')); }
  }

  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, width: '100%', boxSizing: 'border-box' };

  return (
    <div className="split-layout">
      {/* Sidebar */}
      <div className="split-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Toggle */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 7, padding: 3 }}>
            {(['baustellen','kostenstellen'] as const).map(v => (
              <button key={v} onClick={() => { setView(v); setSelected(null); setShowSiteForm(false); setShowKstForm(false); }} style={{
                flex: 1, padding: '5px 0', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: view === v ? '#fff' : 'transparent',
                color: view === v ? '#1d4ed8' : '#64748b',
                boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
                {v === 'baustellen' ? t('sites.baustellen') : t('sites.kostenstellen')}
              </button>
            ))}
          </div>
        </div>

        {/* List header */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
            {t('common.entries', { count: view === 'baustellen' ? sites.length : allKst.length })}
          </span>
          <button onClick={() => {
            setSelected(null);
            if (view === 'baustellen') { setShowSiteForm(true); setShowKstForm(false); }
            else { setShowKstForm(true); setShowSiteForm(false); }
          }} style={{
            padding: '4px 12px', borderRadius: 6, border: 'none',
            background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>+ {t('common.new')}</button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {(view === 'baustellen' ? sites : allKst).map(s => {
            const [bg, fg] = STATUS_COLORS[s.status] || ['#f1f5f9', '#64748b'];
            return (
              <div key={s.id} onClick={() => selectSite(s)} style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                background: selected?.id === s.id ? '#eff6ff' : '#fff',
                borderLeft: selected?.id === s.id ? '3px solid #1d4ed8' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>{s.kostenstelle}</span>
                  {view === 'baustellen' ? (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: bg, color: fg }}>
                      {t(`sites.status.${s.status}`)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                      background: s.is_baustelle ? '#eff6ff' : '#f1f5f9', color: s.is_baustelle ? '#1d4ed8' : '#94a3b8' }}>
                      {s.is_baustelle ? t('sites.status.baustelle') : t('sites.status.overhead')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{s.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.client}</span>
                  {s.total_costs > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: '#dc2626' }}>
                      -€{s.total_costs.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="split-content page-root">

        {/* New Kostenstelle form */}
        {showKstForm && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>{t('sites.newKst')}</div>
            <form onSubmit={submitKst} style={{
              background: '#fff', borderRadius: 12, padding: 24,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 520,
            }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.kstCode')} *</label>
                <input required value={kstForm.kostenstelle} placeholder="ex: 200"
                  onChange={e => setKstForm(p => ({ ...p, kostenstelle: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.fieldName')} *</label>
                <input required value={kstForm.name} placeholder="ex: Fuhrpark Neu"
                  onChange={e => setKstForm(p => ({ ...p, name: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.clientFirma')}</label>
                <input required value={kstForm.client}
                  onChange={e => setKstForm(p => ({ ...p, client: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.fieldNotes')}</label>
                <textarea value={kstForm.notes} rows={2}
                  onChange={e => setKstForm(p => ({ ...p, notes: e.target.value }))}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
                <button type="submit" style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {t('common.save')}
                </button>
                <button type="button" onClick={() => setShowKstForm(false)} style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* New site form */}
        {showSiteForm && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>{t('sites.newSite')}</div>
            <form onSubmit={submitSite} style={{
              background: '#fff', borderRadius: 12, padding: 24,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 640,
            }}>
              <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.kostenstellen')} *</label>
                  <input required value={siteForm.kostenstelle} placeholder="ex: 410"
                    onChange={e => setSiteForm(p => ({ ...p, kostenstelle: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.siteName')} *</label>
                  <input required value={siteForm.name} placeholder="ex: Fiber Export Kaufering"
                    onChange={e => setSiteForm(p => ({ ...p, name: e.target.value }))} style={inp} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.client')} *</label>
                <input required value={siteForm.client} placeholder="ex: Fiber Export"
                  onChange={e => setSiteForm(p => ({ ...p, client: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.budgetEUR')}</label>
                <input type="number" step="0.01" min="0" value={siteForm.budget} placeholder="0"
                  onChange={e => setSiteForm(p => ({ ...p, budget: e.target.value }))} style={inp} />
              </div>

              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.fieldAddress')}</label>
                <input value={siteForm.address} placeholder={t('sites.fieldAddressPlaceholder')}
                  onChange={e => setSiteForm(p => ({ ...p, address: e.target.value }))} style={inp} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.fieldStartDate')}</label>
                <input type="date" value={siteForm.start_date}
                  onChange={e => setSiteForm(p => ({ ...p, start_date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.fieldEndDate')}</label>
                <input type="date" value={siteForm.end_date}
                  onChange={e => setSiteForm(p => ({ ...p, end_date: e.target.value }))} style={inp} />
              </div>

              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.fieldNotes')}</label>
                <textarea value={siteForm.notes} rows={3} placeholder={t('sites.fieldNotesPlaceholder')}
                  onChange={e => setSiteForm(p => ({ ...p, notes: e.target.value }))}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
                <button type="submit" style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {t('common.save')}
                </button>
                <button type="button" onClick={() => setShowSiteForm(false)} style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Site detail */}
        {!showSiteForm && !showKstForm && !selected && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#94a3b8', fontSize: 15 }}>
            {t('common.selectLeft')}
          </div>
        )}

        {!showSiteForm && !showKstForm && selected && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: 1 }}>KST {selected.kostenstelle}</div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '4px 0' }}>{selected.name}</h2>
                  <div style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {selected.client}
                    {(() => {
                      const [bg, fg] = STATUS_COLORS[selected.status] || ['#f1f5f9', '#64748b'];
                      return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: bg, color: fg }}>{t(`sites.status.${selected.status}`)}</span>;
                    })()}
                    {selected.start_date && (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>din {new Date(selected.start_date).toLocaleDateString(locale)}</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <button onClick={() => {
                    setEditSiteForm({
                      status: selected.status,
                      start_date: selected.start_date ? selected.start_date.slice(0, 10) : '',
                      end_date: selected.end_date ? selected.end_date.slice(0, 10) : '',
                    });
                    setShowEditSite(p => !p);
                  }} style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
                    {showEditSite ? t('common.cancel') : '✎ ' + t('common.edit', 'Editează')}
                  </button>
                  {selected.budget > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{t('sites.budget')}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>€{selected.budget.toLocaleString('de-DE')}</div>
                    </>
                  )}
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{t('sites.totalCosts')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800,
                    color: selected.budget > 0 && selected.total_costs > selected.budget ? '#dc2626' : '#059669' }}>
                    €{(costs?.total ?? selected.total_costs).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Edit status / dates inline form */}
            {showEditSite && (
              <form onSubmit={submitEditSite} style={{
                background: '#f8fafc', borderRadius: 10, padding: '16px 20px', marginBottom: 20,
                border: '1px solid #e2e8f0', display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap',
              }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Status</label>
                  <select value={editSiteForm.status} onChange={e => setEditSiteForm(p => ({ ...p, status: e.target.value }))}
                    style={{ ...inp, width: 160 }}>
                    <option value="active">{t('sites.status.active')}</option>
                    <option value="paused">{t('sites.status.paused')}</option>
                    <option value="finished">{t('sites.status.finished')}</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.fieldStartDate')}</label>
                  <input type="date" value={editSiteForm.start_date}
                    onChange={e => setEditSiteForm(p => ({ ...p, start_date: e.target.value }))}
                    style={{ ...inp, width: 160 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('sites.fieldEndDate')}</label>
                  <input type="date" value={editSiteForm.end_date}
                    onChange={e => setEditSiteForm(p => ({ ...p, end_date: e.target.value }))}
                    style={{ ...inp, width: 160 }} />
                </div>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {t('common.save')}
                </button>
              </form>
            )}

            {/* Costs breakdown */}
            {costs && costs.total > 0 && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                {Object.entries(costs.by_category).map(([cat, amt]) => (
                  <div key={cat} style={{ background: '#fff', borderRadius: 8, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t(`sites.categories.${cat}`)}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>€{(amt as number).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#f1f5f9', borderRadius: 8, padding: 4, width: 'fit-content' }}>
              {([
                ['costs',         `${t('sites.costs')} (${costs?.items.length ?? 0})`],
                ['materials',     `${t('sites.materials')} (${materials.length})`],
                ['programari',    `${t('sites.tabSchedules')} (${programari.length})`],
                ['tagesbericht',  `Tagesbericht (${tagesbericht.length})`],
              ] as const).map(([tp, label]) => (
                <button key={tp} onClick={() => setTab(tp)} style={{
                  padding: '7px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: tab === tp ? '#fff' : 'transparent',
                  color: tab === tp ? '#F97316' : '#64748b',
                  fontWeight: tab === tp ? 700 : 500, fontSize: 13,
                  boxShadow: tab === tp ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>{label}</button>
              ))}
            </div>

            {/* Costs tab */}
            {tab === 'costs' && (
              <>
                <button onClick={() => setShowCostForm(true)} style={{
                  marginBottom: 16, padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>+ {t('sites.addCost')}</button>

                {showCostForm && (
                  <form onSubmit={submitCost} style={{
                    background: '#fff', borderRadius: 10, padding: '20px', marginBottom: 20,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                  }}>
                    <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: 14 }}>{t('sites.addCost')}</div>
                    <select value={costForm.category} onChange={e => setCostForm(p => ({ ...p, category: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
                      {COST_CATEGORIES.map(c => <option key={c} value={c}>{t(`sites.categories.${c}`)}</option>)}
                    </select>
                    <input placeholder={t('common.name')} required value={costForm.description}
                      onChange={e => setCostForm(p => ({ ...p, description: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                    <input placeholder={t('sites.budget') + ' (€)'} type="number" step="0.01" required value={costForm.amount}
                      onChange={e => setCostForm(p => ({ ...p, amount: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                    <input placeholder={t('sites.fieldSupplier')} value={costForm.supplier}
                      onChange={e => setCostForm(p => ({ ...p, supplier: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                    <input placeholder={t('sites.fieldInvoiceRef')} value={costForm.invoice_ref}
                      onChange={e => setCostForm(p => ({ ...p, invoice_ref: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                    <input placeholder={t('common.notes')} value={costForm.notes}
                      onChange={e => setCostForm(p => ({ ...p, notes: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                    <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
                      <button type="submit" style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{t('common.save')}</button>
                      <button type="button" onClick={() => setShowCostForm(false)} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>{t('common.cancel')}</button>
                    </div>
                  </form>
                )}

                <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  {(!costs?.items.length) ? (
                    <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center' }}>{t('common.noEntries')}</div>
                  ) : costs.items.map(c => (
                    <div key={c.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8' }}>
                        {t(`sites.categories.${c.category}`)}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: '#1e293b' }}>{c.description}</span>
                      {c.supplier && <span style={{ fontSize: 12, color: '#94a3b8' }}>{c.supplier}</span>}
                      <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b', fontFamily: 'monospace' }}>€{c.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Materials tab */}
            {tab === 'materials' && (
              <>
                <button onClick={() => setShowMatForm(true)} style={{
                  marginBottom: 16, padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>+ {t('sites.addMaterial')}</button>

                {showMatForm && (
                  <form onSubmit={submitMaterial} style={{
                    background: '#fff', borderRadius: 10, padding: '20px', marginBottom: 20,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                  }}>
                    <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: 14 }}>{t('sites.addMaterial')}</div>
                    <input placeholder={t('sites.fieldMaterial')} required value={matForm.material}
                      onChange={e => setMatForm(p => ({ ...p, material: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input placeholder={t('common.quantity')} type="number" step="0.01" required value={matForm.quantity}
                        onChange={e => setMatForm(p => ({ ...p, quantity: e.target.value }))}
                        style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                      <input placeholder={t('common.unit')} value={matForm.unit}
                        onChange={e => setMatForm(p => ({ ...p, unit: e.target.value }))}
                        style={{ width: 70, padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                    </div>
                    <input placeholder={t('common.notes')} value={matForm.notes}
                      onChange={e => setMatForm(p => ({ ...p, notes: e.target.value }))}
                      style={{ gridColumn: '1/-1', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                    <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
                      <button type="submit" style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{t('common.save')}</button>
                      <button type="button" onClick={() => setShowMatForm(false)} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>{t('common.cancel')}</button>
                    </div>
                  </form>
                )}

                <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  {!materials.length ? (
                    <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center' }}>{t('common.noEntries')}</div>
                  ) : materials.map(m => (
                    <div key={m.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{m.material}</span>
                      <span style={{ fontWeight: 800, fontSize: 14, fontFamily: 'monospace', color: '#1d4ed8' }}>{m.quantity} {m.unit}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(m.date).toLocaleDateString(locale)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Tagesbericht tab */}
            {tab === 'tagesbericht' && (
              <>
                {/* Toolbar */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={tbFilterType} onChange={e => setTbFilterType(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b' }}>
                    <option value="">Toate tipurile</option>
                    {['poze_inainte','teratest','semne_circulatie','liefer_scheine','montaj_nvt_pdp',
                      'hp_plus','ha','reparatie','tras_teava','groapa','traversare','sapatura','raport_zilnic'
                    ].map(wt => (
                      <option key={wt} value={wt}>{TB_LABELS[wt] ?? wt}</option>
                    ))}
                  </select>
                  <input type="date" value={tbFilterDate} onChange={e => setTbFilterDate(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }}
                  />
                  {(tbFilterType || tbFilterDate) && (
                    <button onClick={() => { setTbFilterType(''); setTbFilterDate(''); }}
                      style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#64748b' }}>
                      Resetează
                    </button>
                  )}
                  <div style={{ marginLeft: 'auto' }}>
                    <button onClick={() => setShowPdfExport(true)}
                      style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#F97316', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      Export PDF
                    </button>
                  </div>
                </div>

                {/* PDF Export Modal */}
                {showPdfExport && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 380, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Selectează tipurile pentru PDF</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                        {Object.keys(pdfFields).map(wt => (
                          <label key={wt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                            <input type="checkbox" checked={pdfFields[wt]}
                              onChange={e => setPdfFields(p => ({ ...p, [wt]: e.target.checked }))}
                              style={{ width: 15, height: 15 }} />
                            {TB_LABELS[wt] ?? wt}
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => {
                            const selectedTypes = Object.entries(pdfFields).filter(([, v]) => v).map(([k]) => k);
                            const filtered = tagesbericht.filter(e =>
                              selectedTypes.includes(e.work_type) &&
                              (!tbFilterDate || e.created_at?.startsWith(tbFilterDate))
                            );
                            printTagesbericht(filtered, selected?.name ?? '');
                            setShowPdfExport(false);
                          }}
                          style={{ flex: 1, padding: '9px', borderRadius: 7, border: 'none', background: '#F97316', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                          Generează PDF
                        </button>
                        <button onClick={() => setShowPdfExport(false)}
                          style={{ padding: '9px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                          Anulează
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Entries list */}
                {(() => {
                  const filtered = tagesbericht.filter(e =>
                    (!tbFilterType || e.work_type === tbFilterType) &&
                    (!tbFilterDate || e.created_at?.startsWith(tbFilterDate))
                  );
                  if (!filtered.length) {
                    return <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Niciun raport găsit.</div>;
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {filtered.map((entry: any) => (
                        <div key={entry.id} style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
                          {/* Entry header */}
                          <button
                            onClick={() => setTbExpanded(tbExpanded === entry.id ? null : entry.id)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                            }}
                          >
                            <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: 'rgba(249,115,22,0.1)', color: '#F97316', flexShrink: 0 }}>
                              {TB_LABELS[entry.work_type] ?? entry.work_type}
                            </span>
                            {entry.nvt_number && (
                              <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{entry.nvt_number}</span>
                            )}
                            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', flexShrink: 0 }}>
                              {new Date(entry.created_at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>{tbExpanded === entry.id ? '▲' : '▼'}</span>
                          </button>

                          {/* Expanded detail */}
                          {tbExpanded === entry.id && (
                            <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1f5f9' }}>
                              {/* Data fields */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, marginBottom: 12 }}>
                                {Object.entries(entry.data).map(([k, v]) => (
                                  <div key={k}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.replace(/_/g, ' ')}</div>
                                    <div style={{ fontSize: 13, color: '#1e293b' }}>{String(v) || '—'}</div>
                                  </div>
                                ))}
                              </div>
                              {/* Photos */}
                              {entry.photos?.length > 0 && (
                                <>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>FOTOGRAFII ({entry.photos.length})</div>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {entry.photos.map((ph: any) => (
                                      <div key={ph.id} style={{ position: 'relative' }}>
                                        <a href={ph.url} target="_blank" rel="noreferrer">
                                          <img src={ph.url} alt={ph.category}
                                            style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                          />
                                        </a>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textAlign: 'center', marginTop: 2 }}>{ph.category}</div>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}

            {/* Programări tab */}
            {tab === 'programari' && (
              <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                {!programari.length ? (
                  <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center' }}>{t('common.noData')}</div>
                ) : programari.map(p => {
                  const [bg, fg] = STATUS_COLORS_HA[p.status] || ['#f1f5f9', '#64748b'];
                  const dt = new Date(p.scheduled_date);
                  return (
                    <div key={p.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 48 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#1d4ed8', fontFamily: 'monospace' }}>
                          {dt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>
                          {dt.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.client_name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{p.address}{p.city ? `, ${p.city}` : ''}</div>
                        {p.assigned_team_name && <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.assigned_team_name}</div>}
                      </div>
                      {p.connection_type && (
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{p.connection_type}</span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: bg, color: fg, flexShrink: 0 }}>
                          {t(`hausanschluss.status.${p.status}`) || p.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
