import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  fetchCatalogs, createCatalog, updateCatalog, deleteCatalog, cloneCatalog,
  addPosition, updatePosition, deletePosition, importCSV, exportCSVUrl,
} from '../api/lv';
import { listSites } from '../api/sites';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LVCatalog {
  id: number;
  name: string;
  site_id: number | null;
  site_name: string | null;
  work_type: string | null;
  is_template: boolean;
  notes: string | null;
  creator_name: string | null;
  created_at: string;
  position_count: number;
  positions?: LVPosition[];
}

interface LVPosition {
  id: number;
  lv_id: number;
  position_nr: string | null;
  short_description: string;
  long_description: string | null;
  unit: string;
  unit_price: number;
  sort_order: number;
}

interface Site { id: number; name: string; kostenstelle: string; }

const WORK_TYPES = ['FTTH', 'pavaj', 'gaz', 'generic'];

const WORK_TYPE_COLOR: Record<string, string> = {
  FTTH:    '#dbeafe',
  pavaj:   '#fef3c7',
  gaz:     '#d1fae5',
  generic: '#f3f4f6',
};

const pill = (label: string) => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 99,
  background: WORK_TYPE_COLOR[label] || '#f3f4f6',
  color: '#374151', fontSize: 11, fontWeight: 600,
});

// ── Main Page ─────────────────────────────────────────────────────────────────

export function LVCatalogPage() {
  const { t } = useTranslation();

  const [catalogs, setCatalogs]         = useState<LVCatalog[]>([]);
  const [sites, setSites]               = useState<Site[]>([]);
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [detail, setDetail]             = useState<LVCatalog | null>(null);
  const [loading, setLoading]           = useState(false);
  const [filterType, setFilterType]     = useState('');
  const [filterSite, setFilterSite]     = useState('');

  // LV create/edit modal state
  const [showLVModal, setShowLVModal]   = useState(false);
  const [editingLV, setEditingLV]       = useState<LVCatalog | null>(null);
  const [lvForm, setLVForm]             = useState({ name: '', site_id: '', work_type: '', is_template: false, notes: '' });

  // Clone modal
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSourceId, setCloneSourceId]   = useState<number | null>(null);
  const [cloneForm, setCloneForm]           = useState({ name: '', site_id: '', work_type: '', is_template: false });

  // Position inline editing
  const [editingPosId, setEditingPosId]     = useState<number | null>(null);
  const [addingPos, setAddingPos]           = useState(false);
  const [posForm, setPosForm]               = useState({ position_nr: '', short_description: '', long_description: '', unit: 'm', unit_price: '0' });
  const [expandedDescId, setExpandedDescId] = useState<number | null>(null);

  // Import
  const fileRef = useRef<HTMLInputElement>(null);
  const [importReplace, setImportReplace] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadCatalogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = {};
      if (filterType) params.work_type = filterType;
      if (filterSite) params.site_id   = filterSite;
      const data = await fetchCatalogs(params);
      setCatalogs(data);
    } catch { toast.error(t('common.error')); }
    finally { setLoading(false); }
  };

  const loadDetail = async (id: number) => {
    try {
      const { getCatalog } = await import('../api/lv');
      const data = await getCatalog(id);
      setDetail(data);
    } catch { toast.error(t('common.error')); }
  };

  useEffect(() => { loadCatalogs(); }, [filterType, filterSite]);
  useEffect(() => { listSites().then(setSites).catch(() => {}); }, []);
  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId]);

  // ── LV create/edit ────────────────────────────────────────────────────────

  const openCreateLV = () => {
    setEditingLV(null);
    setLVForm({ name: '', site_id: '', work_type: '', is_template: false, notes: '' });
    setShowLVModal(true);
  };

  const openEditLV = (lv: LVCatalog) => {
    setEditingLV(lv);
    setLVForm({
      name: lv.name,
      site_id: lv.site_id ? String(lv.site_id) : '',
      work_type: lv.work_type || '',
      is_template: lv.is_template,
      notes: lv.notes || '',
    });
    setShowLVModal(true);
  };

  const saveLV = async () => {
    if (!lvForm.name.trim()) { toast.error(t('common.error')); return; }
    const body = {
      name: lvForm.name.trim(),
      site_id: lvForm.site_id ? Number(lvForm.site_id) : null,
      work_type: lvForm.work_type || null,
      is_template: lvForm.is_template,
      notes: lvForm.notes || null,
    };
    try {
      if (editingLV) {
        await updateCatalog(editingLV.id, body);
        toast.success(t('lv.saved'));
      } else {
        const newLV = await createCatalog(body);
        setSelectedId(newLV.id);
        toast.success(t('lv.saved'));
      }
      setShowLVModal(false);
      loadCatalogs();
      if (editingLV) loadDetail(editingLV.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || t('common.error'));
    }
  };

  const handleDeleteLV = async (lv: LVCatalog) => {
    if (!confirm(`${t('common.delete')} LV "${lv.name}"?`)) return;
    try {
      await deleteCatalog(lv.id);
      if (selectedId === lv.id) { setSelectedId(null); setDetail(null); }
      loadCatalogs();
      toast.success(t('lv.deleted'));
    } catch (e: any) { toast.error(e?.response?.data?.detail || t('common.error')); }
  };

  // ── Clone ─────────────────────────────────────────────────────────────────

  const openClone = (lv: LVCatalog) => {
    setCloneSourceId(lv.id);
    setCloneForm({ name: `${lv.name} (copie)`, site_id: '', work_type: lv.work_type || '', is_template: false });
    setShowCloneModal(true);
  };

  const doClone = async () => {
    if (!cloneForm.name.trim() || !cloneSourceId) return;
    try {
      const newLV = await cloneCatalog(cloneSourceId, {
        name: cloneForm.name.trim(),
        site_id: cloneForm.site_id ? Number(cloneForm.site_id) : null,
        work_type: cloneForm.work_type || null,
        is_template: cloneForm.is_template,
      });
      setShowCloneModal(false);
      loadCatalogs();
      setSelectedId(newLV.id);
      toast.success(t('lv.cloned'));
    } catch (e: any) { toast.error(e?.response?.data?.detail || t('common.error')); }
  };

  // ── Positions ─────────────────────────────────────────────────────────────

  const startAddPos = () => {
    setAddingPos(true);
    setEditingPosId(null);
    setPosForm({ position_nr: '', short_description: '', long_description: '', unit: 'm', unit_price: '0' });
  };

  const startEditPos = (p: LVPosition) => {
    setEditingPosId(p.id);
    setAddingPos(false);
    setPosForm({
      position_nr: p.position_nr || '',
      short_description: p.short_description,
      long_description: p.long_description || '',
      unit: p.unit,
      unit_price: String(p.unit_price),
    });
  };

  const cancelPosEdit = () => { setEditingPosId(null); setAddingPos(false); };

  const savePos = async () => {
    if (!posForm.short_description.trim()) { toast.error(t('common.error')); return; }
    const body = {
      position_nr: posForm.position_nr || null,
      short_description: posForm.short_description.trim(),
      long_description: posForm.long_description || null,
      unit: posForm.unit || 'm',
      unit_price: parseFloat(posForm.unit_price) || 0,
    };
    try {
      if (addingPos) {
        await addPosition(selectedId!, body);
        toast.success(t('lv.saved'));
      } else if (editingPosId) {
        await updatePosition(selectedId!, editingPosId, body);
        toast.success(t('lv.saved'));
      }
      cancelPosEdit();
      loadDetail(selectedId!);
    } catch (e: any) { toast.error(e?.response?.data?.detail || t('common.error')); }
  };

  const handleDeletePos = async (posId: number) => {
    try {
      await deletePosition(selectedId!, posId);
      loadDetail(selectedId!);
    } catch { toast.error(t('common.error')); }
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    try {
      const result = await importCSV(selectedId, file, importReplace);
      toast.success(t('lv.importResult', { count: result.imported }));
      if (result.errors?.length) {
        result.errors.slice(0, 3).forEach((err: string) => toast.error(err, { duration: 6000 }));
      }
      loadDetail(selectedId);
    } catch (e: any) { toast.error(e?.response?.data?.detail || t('common.error')); }
    e.target.value = '';
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const posFormRow = (isNew: boolean) => (
    <tr style={{ background: '#f0f9ff' }}>
      <td style={tdStyle}>
        <input value={posForm.position_nr} onChange={e => setPosForm(f => ({ ...f, position_nr: e.target.value }))}
          placeholder="1.1" style={{ ...inpStyle, width: 60 }} maxLength={20} />
      </td>
      <td style={tdStyle}>
        <input value={posForm.short_description} onChange={e => setPosForm(f => ({ ...f, short_description: e.target.value }))}
          placeholder={t('lv.shortDesc')} style={{ ...inpStyle, width: '100%' }} maxLength={300} />
      </td>
      <td style={tdStyle}>
        <textarea value={posForm.long_description} onChange={e => setPosForm(f => ({ ...f, long_description: e.target.value }))}
          placeholder={t('lv.longDesc')} style={{ ...inpStyle, width: '100%', resize: 'vertical', minHeight: 36 }} />
      </td>
      <td style={tdStyle}>
        <input value={posForm.unit} onChange={e => setPosForm(f => ({ ...f, unit: e.target.value }))}
          placeholder="m" style={{ ...inpStyle, width: 60 }} maxLength={20} />
      </td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>
        <input type="number" value={posForm.unit_price} onChange={e => setPosForm(f => ({ ...f, unit_price: e.target.value }))}
          style={{ ...inpStyle, width: 90, textAlign: 'right' }} min={0} step={0.01} />
      </td>
      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
        <button onClick={savePos} style={btnPrimary}>✓</button>
        <button onClick={cancelPosEdit} style={{ ...btnSec, marginLeft: 4 }}>✕</button>
      </td>
    </tr>
  );

  const grouped = WORK_TYPES.concat(
    catalogs.filter(c => c.work_type && !WORK_TYPES.includes(c.work_type)).map(c => c.work_type!)
  ).reduce<Record<string, LVCatalog[]>>((acc, type) => {
    const items = catalogs.filter(c => (c.work_type || 'generic') === type);
    if (items.length) acc[type] = items;
    return acc;
  }, {
    ...Object.fromEntries(catalogs.filter(c => !c.work_type).length ? [['—', catalogs.filter(c => !c.work_type)]] : [])
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e3a8a' }}>{t('lv.title')}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
            {t('lv.subtitle')}
          </p>
        </div>
        <button onClick={openCreateLV} style={btnPrimary}>{t('lv.newCatalog')}</button>
      </div>

      {/* Two-panel layout */}
      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0, overflow: 'hidden' }}>

        {/* Left panel — catalog list */}
        <div style={{
          width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
          background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden',
        }}>
          {/* Filters */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selStyle}>
              <option value="">{t('lv.allTypes')}</option>
              {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={selStyle}>
              <option value="">{t('lv.allSites')}</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} {s.name}</option>)}
            </select>
          </div>

          {/* LV list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{t('lv.loading')}</div>
            ) : catalogs.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                {t('lv.noLV')}
              </div>
            ) : (
              Object.entries(grouped).map(([type, items]) => (
                <div key={type} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', padding: '4px 6px 2px' }}>
                    {type}
                  </div>
                  {items.map(lv => (
                    <div
                      key={lv.id}
                      onClick={() => setSelectedId(lv.id)}
                      style={{
                        padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                        background: selectedId === lv.id ? '#eff6ff' : 'transparent',
                        border: selectedId === lv.id ? '1px solid #bfdbfe' : '1px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1e293b', wordBreak: 'break-word' }}>
                          {lv.name}
                        </span>
                        {lv.is_template && (
                          <span style={{ ...pill('generic'), background: '#fef9c3', color: '#92400e', fontSize: 10 }}>TPL</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {lv.site_name ? lv.site_name : t('lv.globalLabel')} · {lv.position_count} poz.
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <button onClick={e => { e.stopPropagation(); openEditLV(lv); }}
                          style={{ ...btnIcon }}>✎</button>
                        <button onClick={e => { e.stopPropagation(); openClone(lv); }}
                          style={{ ...btnIcon }}>⧉</button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteLV(lv); }}
                          style={{ ...btnIcon, color: '#ef4444' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel — positions */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', minWidth: 0 }}>
          {!detail ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
              {t('lv.selectLV')}
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{detail.name}</span>
                    {detail.work_type && <span style={pill(detail.work_type)}>{detail.work_type}</span>}
                    {detail.is_template && <span style={{ ...pill('generic'), background: '#fef9c3', color: '#92400e' }}>{t('lv.templateLabel')}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {detail.site_name ? `${t('lv.fieldSite')}: ${detail.site_name}` : t('lv.globalLabel')}
                    {detail.notes && ` · ${detail.notes}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                  {/* Export */}
                  <a href={exportCSVUrl(detail.id)} download style={{ ...btnSec, textDecoration: 'none', padding: '5px 10px', fontSize: 12 }}>
                    {t('lv.exportCSV')}
                  </a>
                  {/* Import */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <label style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input type="checkbox" checked={importReplace} onChange={e => setImportReplace(e.target.checked)} />
                      {t('lv.isTemplateLabel')}
                    </label>
                    <button onClick={() => fileRef.current?.click()} style={btnSec}>{t('lv.importCSV')}</button>
                    <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileImport} />
                  </div>
                  {/* Add position */}
                  {!addingPos && (
                    <button onClick={startAddPos} style={btnPrimary}>{t('lv.addPosition')}</button>
                  )}
                </div>
              </div>

              {/* CSV format hint */}
              <div style={{ padding: '4px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8' }}>
                {t('lv.csvHint')}
              </div>

              {/* Positions table */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {(detail.positions?.length === 0 && !addingPos) ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                    {t('lv.noPositions')}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                        <th style={{ ...thStyle, width: 70 }}>{t('lv.positionNr')}</th>
                        <th style={{ ...thStyle, width: '30%' }}>{t('lv.shortDesc')}</th>
                        <th style={thStyle}>{t('lv.longDesc')}</th>
                        <th style={{ ...thStyle, width: 60 }}>UM</th>
                        <th style={{ ...thStyle, width: 100, textAlign: 'right' }}>{t('lv.unitPrice')}</th>
                        <th style={{ ...thStyle, width: 80 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {addingPos && posFormRow(true)}
                      {(detail.positions || []).map(pos => (
                        editingPosId === pos.id ? (
                          posFormRow(false)
                        ) : (
                          <tr key={pos.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                            onDoubleClick={() => startEditPos(pos)}>
                            <td style={{ ...tdStyle, color: '#64748b', fontWeight: 600 }}>{pos.position_nr || '—'}</td>
                            <td style={{ ...tdStyle, fontWeight: 500 }}>{pos.short_description}</td>
                            <td style={tdStyle}>
                              {pos.long_description && pos.long_description.length > 80 ? (
                                <>
                                  {expandedDescId === pos.id
                                    ? <span>{pos.long_description} <button onClick={() => setExpandedDescId(null)} style={btnInline}>↑</button></span>
                                    : <span>{pos.long_description.slice(0, 80)}… <button onClick={() => setExpandedDescId(pos.id)} style={btnInline}>↓</button></span>
                                  }
                                </>
                              ) : (
                                <span style={{ color: pos.long_description ? '#374151' : '#cbd5e1' }}>
                                  {pos.long_description || '—'}
                                </span>
                              )}
                            </td>
                            <td style={{ ...tdStyle, color: '#64748b' }}>{pos.unit}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                              {pos.unit_price > 0 ? `€ ${pos.unit_price.toFixed(2)}` : <span style={{ color: '#cbd5e1' }}>—</span>}
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                              <button onClick={() => startEditPos(pos)} style={btnIcon}>✎</button>
                              <button onClick={() => handleDeletePos(pos.id)} style={{ ...btnIcon, color: '#ef4444', marginLeft: 4 }}>✕</button>
                            </td>
                          </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer summary */}
              {(detail.positions?.length ?? 0) > 0 && (
                <div style={{ padding: '8px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: 20, fontSize: 12, color: '#64748b' }}>
                  <span><strong>{detail.positions?.length}</strong> {t('lv.positions')}</span>
                  <span>{t('common.total')}: <strong>€ {(detail.positions || []).reduce((s, p) => s + p.unit_price, 0).toFixed(2)}</strong></span>
                  <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 11 }}>
                    {t('lv.dblClickHint')}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── LV Create/Edit Modal ────────────────────────────────────────── */}
      {showLVModal && (
        <div style={overlayStyle} onClick={() => setShowLVModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1e3a8a' }}>
              {editingLV ? t('lv.editModal') : t('lv.newModal')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={labelStyle}>
                {t('lv.fieldLVName')} *
                <input value={lvForm.name} onChange={e => setLVForm(f => ({ ...f, name: e.target.value }))}
                  style={inpFull} maxLength={200} placeholder="e.g. LV Geodesia Ulm 2025" />
              </label>
              <label style={labelStyle}>
                {t('lv.fieldSite')}
                <select value={lvForm.site_id} onChange={e => setLVForm(f => ({ ...f, site_id: e.target.value }))} style={inpFull}>
                  <option value="">{t('lv.globalSiteOption')}</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} {s.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>
                {t('lv.fieldWorkType')}
                <select value={lvForm.work_type} onChange={e => setLVForm(f => ({ ...f, work_type: e.target.value }))} style={inpFull}>
                  <option value="">{t('lv.unspecifiedOption')}</option>
                  {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={lvForm.is_template} onChange={e => setLVForm(f => ({ ...f, is_template: e.target.checked }))} />
                <span>{t('lv.isTemplate')}</span>
              </label>
              <label style={labelStyle}>
                {t('common.notes')}
                <textarea value={lvForm.notes} onChange={e => setLVForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ ...inpFull, minHeight: 60, resize: 'vertical' }} maxLength={1000} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowLVModal(false)} style={btnSec}>{t('common.cancel')}</button>
              <button onClick={saveLV} style={btnPrimary}>{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clone Modal ────────────────────────────────────────────────── */}
      {showCloneModal && (
        <div style={overlayStyle} onClick={() => setShowCloneModal(false)}>
          <div style={{ ...modalStyle, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1e3a8a' }}>
              {t('lv.cloneModal')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={labelStyle}>
                {t('lv.fieldNewName')} *
                <input value={cloneForm.name} onChange={e => setCloneForm(f => ({ ...f, name: e.target.value }))}
                  style={inpFull} maxLength={200} />
              </label>
              <label style={labelStyle}>
                {t('lv.fieldForSite')}
                <select value={cloneForm.site_id} onChange={e => setCloneForm(f => ({ ...f, site_id: e.target.value }))} style={inpFull}>
                  <option value="">{t('lv.globalSiteOption')}</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} {s.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>
                {t('lv.fieldWorkType')}
                <select value={cloneForm.work_type} onChange={e => setCloneForm(f => ({ ...f, work_type: e.target.value }))} style={inpFull}>
                  <option value="">{t('lv.unspecifiedOption')}</option>
                  {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={cloneForm.is_template} onChange={e => setCloneForm(f => ({ ...f, is_template: e.target.checked }))} />
                <span>{t('lv.isTemplate')}</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowCloneModal(false)} style={btnSec}>{t('common.cancel')}</button>
              <button onClick={doClone} style={btnPrimary}>{t('lv.clone')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0',
};
const tdStyle: React.CSSProperties = {
  padding: '7px 10px', verticalAlign: 'top', fontSize: 13, color: '#374151',
};
const inpStyle: React.CSSProperties = {
  padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 4,
  fontSize: 12, background: '#fff', outline: 'none', boxSizing: 'border-box',
};
const inpFull: React.CSSProperties = {
  ...inpStyle, width: '100%', padding: '6px 8px', fontSize: 13, marginTop: 4,
};
const selStyle: React.CSSProperties = {
  ...inpStyle, width: '100%', padding: '5px 7px',
};
const btnPrimary: React.CSSProperties = {
  padding: '6px 14px', background: '#1e3a8a', color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
const btnSec: React.CSSProperties = {
  padding: '6px 14px', background: '#f1f5f9', color: '#374151',
  border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 13,
};
const btnIcon: React.CSSProperties = {
  padding: '2px 6px', background: 'none', border: '1px solid #e2e8f0',
  borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#64748b',
};
const btnInline: React.CSSProperties = {
  background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 11, padding: 0,
};
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 520,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};
const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 600, color: '#374151',
};
