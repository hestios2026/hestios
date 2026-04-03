import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { bzpApi, BzpProject, BzpRow } from '../api/bauzeitenplan';
import client from '../api/client';

interface Site { id: number; name: string; kostenstelle: string; }

// ── Color map ────────────────────────────────────────────────────────────────
const GEWERK_COLOR: Record<string, string> = {
  'Tiefbau':     '#F97316',
  'Montage':     '#3B82F6',
  'Spülbohrung': '#8B5CF6',
  'Einblasen':   '#10B981',
  'Rohreinzug':  '#F59E0B',
};
const GEWERK_LIST = ['Tiefbau', 'Montage', 'Spülbohrung', 'Einblasen', 'Rohreinzug', 'Sonstiges'];

// ── Helpers ──────────────────────────────────────────────────────────────────
function mondayOf(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addWeeks(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function kwLabel(d: Date): string {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const kw = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
  return `KW${kw}`;
}

function getWeeksBetween(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    weeks.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

// ── Gantt Bar ────────────────────────────────────────────────────────────────
function GanttBar({
  row, weeks, onCellClick,
}: {
  row: BzpRow;
  weeks: Date[];
  onCellClick: (row: BzpRow, weekDate: string) => void;
}) {
  const color = row.color || GEWERK_COLOR[row.gewerk || ''] || '#94A3B8';
  const weeklyMap: Record<string, number> = {};
  row.weekly.forEach(w => { weeklyMap[w.week_date] = w.meters; });

  if (row.is_group_header) {
    return (
      <>
        {weeks.map(w => (
          <td key={isoDate(w)} style={{
            background: '#1E293B', borderRight: '1px solid #334155',
            height: 32,
          }} />
        ))}
      </>
    );
  }

  const startDate = row.date_start ? mondayOf(row.date_start) : null;
  const endDate = row.date_end ? mondayOf(row.date_end) : null;

  return (
    <>
      {weeks.map(w => {
        const wStr = isoDate(w);
        const inRange = startDate && endDate && w >= startDate && w <= endDate;
        const meters = weeklyMap[wStr];
        return (
          <td
            key={wStr}
            onClick={() => inRange && onCellClick(row, wStr)}
            title={meters ? `${meters}m` : inRange ? 'Klicken zum Eintragen' : ''}
            style={{
              height: 32,
              borderRight: '1px solid #E2E8F0',
              cursor: inRange ? 'pointer' : 'default',
              background: meters
                ? color
                : inRange
                ? `${color}22`
                : 'transparent',
              position: 'relative',
              minWidth: 38,
            }}
          >
            {meters ? (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#fff',
                display: 'block', textAlign: 'center', lineHeight: '32px',
              }}>
                {meters}
              </span>
            ) : null}
          </td>
        );
      })}
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function BauzeitenplanPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<number | ''>('');
  const [projects, setProjects] = useState<BzpProject[]>([]);
  const [activeProject, setActiveProject] = useState<BzpProject | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewRow, setShowNewRow] = useState(false);
  const [editingRow, setEditingRow] = useState<BzpRow | null>(null);
  const [weeklyModal, setWeeklyModal] = useState<{ row: BzpRow; weekDate: string } | null>(null);
  const [weeklyMeters, setWeeklyMeters] = useState('');
  const [weeklyNote, setWeeklyNote] = useState('');

  // New project form
  const [npName, setNpName] = useState('');
  const [npFirma, setNpFirma] = useState('');
  const [npBaubeginn, setNpBaubeginn] = useState('');
  const [npBauende, setNpBauende] = useState('');

  // New/edit row form
  const [rowForm, setRowForm] = useState<Partial<BzpRow>>({
    gewerk: 'Tiefbau', hh: false, hc: false, is_group_header: false,
  });

  useEffect(() => {
    client.get('/sites/?baustellen_only=true').then(r => setSites(r.data));
  }, []);

  const loadProjects = useCallback(async (siteId: number) => {
    const list = await bzpApi.listProjects(siteId);
    setProjects(list);
  }, []);

  useEffect(() => {
    if (selectedSite) loadProjects(selectedSite as number);
    else setProjects([]);
  }, [selectedSite, loadProjects]);

  const openProject = async (id: number) => {
    setLoading(true);
    try {
      const p = await bzpApi.getProject(id);
      setActiveProject(p);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!selectedSite || !npName) { toast.error('Selectează șantier și introdu un nume'); return; }
    try {
      const p = await bzpApi.createProject({
        site_id: selectedSite as number,
        name: npName, firma: npFirma,
        baubeginn: npBaubeginn || undefined,
        bauende: npBauende || undefined,
      });
      toast.success('Proiect creat');
      setShowNewProject(false);
      setNpName(''); setNpFirma(''); setNpBaubeginn(''); setNpBauende('');
      await loadProjects(selectedSite as number);
      openProject(p.id);
    } catch { toast.error('Eroare la creare'); }
  };

  const handleAddRow = async () => {
    if (!activeProject) return;
    try {
      const updated = await bzpApi.addRow(activeProject.id, {
        ...rowForm,
        sort_order: (activeProject.rows?.length || 0),
      });
      setActiveProject(prev => prev ? { ...prev, rows: [...(prev.rows || []), updated] } : prev);
      setShowNewRow(false);
      setRowForm({ gewerk: 'Tiefbau', hh: false, hc: false, is_group_header: false });
      toast.success('Rând adăugat');
    } catch { toast.error('Eroare'); }
  };

  const handleUpdateRow = async () => {
    if (!editingRow) return;
    try {
      const updated = await bzpApi.updateRow(editingRow.id, rowForm);
      setActiveProject(prev => prev ? {
        ...prev,
        rows: prev.rows?.map(r => r.id === updated.id ? updated : r),
      } : prev);
      setEditingRow(null);
      toast.success('Salvat');
    } catch { toast.error('Eroare'); }
  };

  const handleDeleteRow = async (rowId: number) => {
    if (!confirm('Ștergi rândul?')) return;
    try {
      await bzpApi.deleteRow(rowId);
      setActiveProject(prev => prev ? {
        ...prev, rows: prev.rows?.filter(r => r.id !== rowId),
      } : prev);
      toast.success('Șters');
    } catch { toast.error('Eroare'); }
  };

  const openWeeklyModal = (row: BzpRow, weekDate: string) => {
    const existing = row.weekly.find(w => w.week_date === weekDate);
    setWeeklyMeters(existing ? String(existing.meters) : '');
    setWeeklyNote(existing?.note || '');
    setWeeklyModal({ row, weekDate });
  };

  const handleSaveWeekly = async () => {
    if (!weeklyModal) return;
    try {
      const updated = await bzpApi.upsertWeekly(
        weeklyModal.row.id,
        weeklyModal.weekDate,
        parseFloat(weeklyMeters) || 0,
        weeklyNote || undefined,
      );
      setActiveProject(prev => prev ? {
        ...prev, rows: prev.rows?.map(r => r.id === updated.id ? updated : r),
      } : prev);
      setWeeklyModal(null);
      toast.success('Salvat');
    } catch { toast.error('Eroare'); }
  };

  // Compute timeline span
  const allDates: Date[] = [];
  activeProject?.rows?.forEach(r => {
    if (r.date_start) allDates.push(mondayOf(r.date_start));
    if (r.date_end) allDates.push(mondayOf(r.date_end));
    r.weekly?.forEach(w => allDates.push(mondayOf(w.week_date)));
  });
  const ganttStart = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : mondayOf(new Date().toISOString());
  const ganttEnd = allDates.length ? addWeeks(new Date(Math.max(...allDates.map(d => d.getTime()))), 1) : addWeeks(ganttStart, 12);
  const weeks = getWeeksBetween(ganttStart, ganttEnd);

  const token = localStorage.getItem('hestios_token');

  return (
    <div style={{ padding: 24, maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E293B', margin: 0 }}>Bauzeitenplan</h2>

        <select
          value={selectedSite}
          onChange={e => { setSelectedSite(e.target.value ? Number(e.target.value) : ''); setActiveProject(null); }}
          style={selectStyle}
        >
          <option value="">Șantier selectați...</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
        </select>

        {selectedSite && (
          <button onClick={() => setShowNewProject(true)} style={btnOrange}>+ Proiect nou</button>
        )}
      </div>

      {/* Project list */}
      {!activeProject && projects.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          {projects.map(p => (
            <div
              key={p.id}
              onClick={() => openProject(p.id)}
              style={{
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
                padding: '14px 20px', cursor: 'pointer', minWidth: 220,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
            >
              <div style={{ fontWeight: 700, color: '#1E293B', fontSize: 15 }}>{p.name}</div>
              {p.firma && <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{p.firma}</div>}
              {p.baubeginn && (
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                  {p.baubeginn} → {p.bauende || '...'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedSite && projects.length === 0 && !activeProject && (
        <div style={{ color: '#94A3B8', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
          Niciun Bauzeitenplan pentru acest șantier. Creează unul.
        </div>
      )}

      {/* Gantt View */}
      {activeProject && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setActiveProject(null)} style={btnGhost}>‹ Înapoi</button>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B' }}>{activeProject.name}</h3>
            {activeProject.firma && <span style={{ color: '#64748B', fontSize: 13 }}>{activeProject.firma}</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNewRow(true)} style={btnOrange}>+ Rând</button>
              <a
                href={`/api/bauzeitenplan/projects/${activeProject.id}/export/excel/?token=${token}`}
                target="_blank"
                style={btnGhost}
              >
                ↓ Excel
              </a>
              <a
                href={`/api/bauzeitenplan/projects/${activeProject.id}/export/pdf/?token=${token}`}
                target="_blank"
                style={btnGhost}
              >
                ↓ PDF
              </a>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            {Object.entries(GEWERK_COLOR).map(([g, c]) => (
              <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
                <span style={{ color: '#64748B' }}>{g}</span>
              </div>
            ))}
          </div>

          {/* Gantt Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Se încarcă...</div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
                <thead>
                  <tr style={{ background: '#1E293B' }}>
                    {['HK/NVT', 'Gewerk', 'Soll (m)', 'Start', 'Ende', 'Ist (m)', '%', 'HA'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                    {weeks.map(w => (
                      <th key={isoDate(w)} style={{ ...thStyle, minWidth: 38, fontSize: 10 }}>
                        {kwLabel(w)}<br />
                        <span style={{ fontWeight: 400, fontSize: 9 }}>{w.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
                      </th>
                    ))}
                    <th style={thStyle}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeProject.rows || []).map((row, ri) => {
                    const color = row.color || GEWERK_COLOR[row.gewerk || ''] || '#94A3B8';
                    return (
                      <tr
                        key={row.id}
                        style={{
                          background: row.is_group_header ? '#1E293B' : ri % 2 === 0 ? '#fff' : '#F8FAFC',
                          borderBottom: '1px solid #E2E8F0',
                        }}
                      >
                        <td style={{ ...tdStyle, fontWeight: row.is_group_header ? 700 : 400, color: row.is_group_header ? '#fff' : '#1E293B' }}>
                          {row.hk_nvt || ''}
                        </td>
                        <td style={tdStyle}>
                          {!row.is_group_header && (
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                              background: `${color}22`, color, fontWeight: 600, fontSize: 11,
                            }}>
                              {row.gewerk || '—'}
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{row.tb_soll_m ? `${row.tb_soll_m}m` : ''}</td>
                        <td style={tdStyle}>{row.date_start || ''}</td>
                        <td style={tdStyle}>{row.date_end || ''}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{row.tb_ist_m ? `${row.tb_ist_m}m` : ''}</td>
                        <td style={tdStyle}>
                          {row.tb_soll_m ? (
                            <div style={{ position: 'relative', background: '#E2E8F0', borderRadius: 4, height: 14, minWidth: 40 }}>
                              <div style={{
                                position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 4,
                                width: `${row.progress_pct}%`,
                                background: row.progress_pct >= 100 ? '#22c55e' : color,
                              }} />
                              <span style={{
                                position: 'absolute', width: '100%', textAlign: 'center',
                                fontSize: 9, fontWeight: 700, color: '#1E293B', lineHeight: '14px',
                              }}>
                                {row.progress_pct}%
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{row.ha_gebaut || ''}</td>

                        <GanttBar row={row} weeks={weeks} onCellClick={openWeeklyModal} />

                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => { setEditingRow(row); setRowForm({ ...row }); }}
                            style={btnTiny}
                          >✎</button>
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            style={{ ...btnTiny, color: '#ef4444', marginLeft: 4 }}
                          >✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── New Project Modal ── */}
      {showNewProject && (
        <Modal title="Proiect nou" onClose={() => setShowNewProject(false)} onSave={handleCreateProject}>
          <Field label="Nume proiect *">
            <input style={inputStyle} value={npName} onChange={e => setNpName(e.target.value)} placeholder="ex: Niederkasssel Rheidt" />
          </Field>
          <Field label="Firma">
            <input style={inputStyle} value={npFirma} onChange={e => setNpFirma(e.target.value)} placeholder="ex: Constructel" />
          </Field>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Baubeginn">
              <input type="date" style={inputStyle} value={npBaubeginn} onChange={e => setNpBaubeginn(e.target.value)} />
            </Field>
            <Field label="Bauende">
              <input type="date" style={inputStyle} value={npBauende} onChange={e => setNpBauende(e.target.value)} />
            </Field>
          </div>
        </Modal>
      )}

      {/* ── New/Edit Row Modal ── */}
      {(showNewRow || editingRow) && (
        <Modal
          title={editingRow ? 'Editează rând' : 'Rând nou'}
          onClose={() => { setShowNewRow(false); setEditingRow(null); setRowForm({ gewerk: 'Tiefbau', hh: false, hc: false, is_group_header: false }); }}
          onSave={editingRow ? handleUpdateRow : handleAddRow}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={rowForm.is_group_header || false}
                onChange={e => setRowForm(f => ({ ...f, is_group_header: e.target.checked }))} />
              Grupă (header)
            </label>
          </div>
          {!rowForm.is_group_header && (
            <>
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Vorhaben Nr">
                  <input style={inputStyle} value={rowForm.vorhaben_nr || ''} onChange={e => setRowForm(f => ({ ...f, vorhaben_nr: e.target.value }))} />
                </Field>
                <Field label="HK/NVT">
                  <input style={inputStyle} value={rowForm.hk_nvt || ''} onChange={e => setRowForm(f => ({ ...f, hk_nvt: e.target.value }))} placeholder="ex: 1R/27, V1405" />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Gewerk">
                  <select style={inputStyle} value={rowForm.gewerk || ''} onChange={e => setRowForm(f => ({ ...f, gewerk: e.target.value }))}>
                    {GEWERK_LIST.map(g => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Tb Soll (m)">
                  <input type="number" style={inputStyle} value={rowForm.tb_soll_m || ''} onChange={e => setRowForm(f => ({ ...f, tb_soll_m: parseFloat(e.target.value) }))} />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Baubeginn">
                  <input type="date" style={inputStyle} value={rowForm.date_start || ''} onChange={e => setRowForm(f => ({ ...f, date_start: e.target.value }))} />
                </Field>
                <Field label="Bauende">
                  <input type="date" style={inputStyle} value={rowForm.date_end || ''} onChange={e => setRowForm(f => ({ ...f, date_end: e.target.value }))} />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Tb Ist (m)">
                  <input type="number" style={inputStyle} value={rowForm.tb_ist_m || 0} onChange={e => setRowForm(f => ({ ...f, tb_ist_m: parseFloat(e.target.value) }))} />
                </Field>
                <Field label="HA gebaut">
                  <input type="number" style={inputStyle} value={rowForm.ha_gebaut || 0} onChange={e => setRowForm(f => ({ ...f, ha_gebaut: parseInt(e.target.value) }))} />
                </Field>
                <Field label="Verzug KW">
                  <input type="number" style={inputStyle} value={rowForm.verzug_kw || 0} onChange={e => setRowForm(f => ({ ...f, verzug_kw: parseInt(e.target.value) }))} />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={rowForm.hh || false} onChange={e => setRowForm(f => ({ ...f, hh: e.target.checked }))} />
                  HH
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={rowForm.hc || false} onChange={e => setRowForm(f => ({ ...f, hc: e.target.checked }))} />
                  HC
                </label>
              </div>
            </>
          )}
          {rowForm.is_group_header && (
            <Field label="Denumire grupă">
              <input style={inputStyle} value={rowForm.hk_nvt || ''} onChange={e => setRowForm(f => ({ ...f, hk_nvt: e.target.value }))} placeholder="ex: BA 1 — Trasse Nord" />
            </Field>
          )}
          <Field label="Bemerkung">
            <input style={inputStyle} value={rowForm.bemerkung || ''} onChange={e => setRowForm(f => ({ ...f, bemerkung: e.target.value }))} />
          </Field>
        </Modal>
      )}

      {/* ── Weekly Entry Modal ── */}
      {weeklyModal && (
        <Modal
          title={`${weeklyModal.row.hk_nvt || weeklyModal.row.gewerk} — ${kwLabel(mondayOf(weeklyModal.weekDate))} (${weeklyModal.weekDate})`}
          onClose={() => setWeeklyModal(null)}
          onSave={handleSaveWeekly}
        >
          <Field label="Meter ausgeführt">
            <input
              type="number"
              style={inputStyle}
              value={weeklyMeters}
              onChange={e => setWeeklyMeters(e.target.value)}
              autoFocus
              placeholder="0"
            />
          </Field>
          <Field label="Notiz (optional)">
            <input style={inputStyle} value={weeklyNote} onChange={e => setWeeklyNote(e.target.value)} placeholder="ex: Urlaub, Regen, Asphalt..." />
          </Field>
        </Modal>
      )}
    </div>
  );
}

// ── Small components ─────────────────────────────────────────────────────────

function Modal({ title, onClose, onSave, children }: {
  title: string; onClose: () => void; onSave: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div data-modal style={{
        background: '#fff', borderRadius: 12, padding: 24, width: 520, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 20 }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={btnGhost}>Anulare</button>
          <button onClick={onSave} style={btnOrange}>Salvează</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: 0.6, marginBottom: 4 }}>
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '10px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: '#94A3B8', letterSpacing: 0.6, whiteSpace: 'nowrap',
  borderRight: '1px solid #334155', position: 'sticky', top: 0,
};
const tdStyle: React.CSSProperties = {
  padding: '6px 8px', color: '#1E293B', whiteSpace: 'nowrap',
  borderRight: '1px solid #E2E8F0',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0',
  borderRadius: 6, fontSize: 13, color: '#1E293B', background: '#fff',
  boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 6,
  fontSize: 14, color: '#1E293B', background: '#fff', minWidth: 220,
};
const btnOrange: React.CSSProperties = {
  padding: '8px 18px', background: '#F97316', color: '#fff', border: 'none',
  borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  textDecoration: 'none', display: 'inline-block',
};
const btnGhost: React.CSSProperties = {
  padding: '8px 16px', background: 'transparent', color: '#64748B',
  border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13,
  cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
};
const btnTiny: React.CSSProperties = {
  padding: '3px 7px', background: 'transparent', color: '#64748B',
  border: '1px solid #E2E8F0', borderRadius: 5, fontSize: 12, cursor: 'pointer',
};
