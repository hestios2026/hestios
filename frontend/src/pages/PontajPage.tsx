import { useEffect, useState, useCallback } from 'react';
import { fetchEmployees } from '../api/employees';
import { fetchPontaj, fetchTeamAssignments, setTeamAssignments } from '../api/timesheets';
import client from '../api/client';
import toast from 'react-hot-toast';

interface Employee {
  id: number;
  vorname: string;
  nachname: string;
  is_active: boolean;
}

interface MobileUser {
  id: number;
  full_name: string;
  mobile_pin: string | null;
}

interface Assignment {
  team_lead_id: number;
  team_lead_name: string;
  employee_id: number;
  employee_name: string;
}

interface PontajEntry {
  id: number;
  employee_id: number;
  employee_name: string;
  site_id: number | null;
  date: string;
  entry_type: string;
  hours_regular: number;
  ora_start: string | null;
  ora_stop: string | null;
  notes: string | null;
  team_lead_id: number | null;
}

export function PontajPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mobileUsers, setMobileUsers] = useState<MobileUser[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pontajEntries, setPontajEntries] = useState<PontajEntry[]>([]);

  // Assignment form state
  const [selectedLead, setSelectedLead] = useState<number | ''>('');
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);

  // Pontaj filter state
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(weekAgo);
  const [dateTo, setDateTo] = useState(today);
  const [filterLead, setFilterLead] = useState<number | ''>('');
  const [loadingPontaj, setLoadingPontaj] = useState(false);

  // Load employees + mobile users on mount
  useEffect(() => {
    fetchEmployees({ active_only: true }).then((data: Employee[]) => setEmployees(data.filter(e => e.is_active)));
    client.get('/users/').then(r => {
      const users: MobileUser[] = r.data.filter((u: MobileUser) => u.mobile_pin);
      setMobileUsers(users);
    });
    fetchTeamAssignments().then(setAssignments);
  }, []);

  // When a lead is selected for assignment, load their current employees
  useEffect(() => {
    if (!selectedLead) { setSelectedEmpIds([]); return; }
    const ids = assignments.filter(a => a.team_lead_id === selectedLead).map(a => a.employee_id);
    setSelectedEmpIds(ids);
  }, [selectedLead, assignments]);

  const handleSaveAssignment = async () => {
    if (!selectedLead) { toast.error('Selectează un șef de echipă'); return; }
    setSavingAssign(true);
    try {
      await setTeamAssignments(selectedLead as number, selectedEmpIds);
      const updated = await fetchTeamAssignments();
      setAssignments(updated);
      toast.success('Echipa a fost salvată');
    } catch {
      toast.error('Eroare la salvare');
    } finally {
      setSavingAssign(false);
    }
  };

  const toggleEmp = (id: number) => {
    setSelectedEmpIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const loadPontaj = useCallback(async () => {
    setLoadingPontaj(true);
    try {
      const params: Record<string, unknown> = { date_from: dateFrom, date_to: dateTo };
      if (filterLead) params.team_lead_id = filterLead;
      const data = await fetchPontaj(params);
      setPontajEntries(data);
    } finally {
      setLoadingPontaj(false);
    }
  }, [dateFrom, dateTo, filterLead]);

  useEffect(() => { loadPontaj(); }, [loadPontaj]);

  // Group by date then employee
  const byDate = pontajEntries.reduce<Record<string, PontajEntry[]>>((acc, e) => {
    (acc[e.date] = acc[e.date] || []).push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  function formatDate(s: string) {
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E293B', marginBottom: 24 }}>Pontaj Echipă</h2>

      {/* ── Team Assignment Section ── */}
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
        padding: 20, marginBottom: 28,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#64748B', letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' }}>
          Asignare Echipă
        </h3>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Team lead selector */}
          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: 0.8, marginBottom: 6 }}>ȘEF DE ECHIPĂ</div>
            <select
              value={selectedLead}
              onChange={e => setSelectedLead(e.target.value ? Number(e.target.value) : '')}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 14, color: '#1E293B', background: '#fff' }}
            >
              <option value="">Selectează...</option>
              {mobileUsers.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          {/* Employee checklist */}
          {selectedLead !== '' && (
            <div style={{ flex: 1, minWidth: 300 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: 0.8, marginBottom: 6 }}>
                MUNCITORI ({selectedEmpIds.length} selectați)
              </div>
              <div style={{
                border: '1px solid #E2E8F0', borderRadius: 6, maxHeight: 200, overflowY: 'auto',
                background: '#F8FAFC',
              }}>
                {employees.map(emp => (
                  <label key={emp.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', cursor: 'pointer',
                    borderBottom: '1px solid #F1F5F9',
                    background: selectedEmpIds.includes(emp.id) ? 'rgba(249,115,22,0.06)' : undefined,
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedEmpIds.includes(emp.id)}
                      onChange={() => toggleEmp(emp.id)}
                      style={{ accentColor: '#F97316' }}
                    />
                    <span style={{ fontSize: 13, color: '#1E293B' }}>
                      {emp.vorname} {emp.nachname}
                    </span>
                  </label>
                ))}
              </div>
              <button
                onClick={handleSaveAssignment}
                disabled={savingAssign}
                style={{
                  marginTop: 10, padding: '8px 20px', background: '#F97316',
                  color: '#fff', border: 'none', borderRadius: 6, fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', opacity: savingAssign ? 0.6 : 1,
                }}
              >
                {savingAssign ? 'Salvare...' : 'Salvează Echipa'}
              </button>
            </div>
          )}
        </div>

        {/* Current assignments summary */}
        {mobileUsers.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {mobileUsers.map(u => {
              const count = assignments.filter(a => a.team_lead_id === u.id).length;
              return (
                <div key={u.id} style={{
                  background: '#F8FAFC', border: '1px solid #E2E8F0',
                  borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#64748B',
                }}>
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>{u.full_name}</span>
                  {' — '}{count} muncitor{count !== 1 ? 'i' : ''}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pontaj View Section ── */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: 0.8, marginBottom: 4 }}>DE LA</div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 14, color: '#1E293B' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: 0.8, marginBottom: 4 }}>PÂNĂ LA</div>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 14, color: '#1E293B' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: 0.8, marginBottom: 4 }}>ȘEF ECHIPĂ</div>
            <select value={filterLead} onChange={e => setFilterLead(e.target.value ? Number(e.target.value) : '')}
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 14, color: '#1E293B', background: '#fff' }}>
              <option value="">Toți</option>
              {mobileUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        </div>

        {loadingPontaj ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Se încarcă...</div>
        ) : sortedDates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 14 }}>
            Niciun pontaj în perioada selectată.
          </div>
        ) : (
          sortedDates.map(d => (
            <div key={d} style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#1E293B',
                padding: '8px 12px', background: '#F8FAFC',
                borderRadius: 6, marginBottom: 2, borderLeft: '3px solid #F97316',
              }}>
                {formatDate(d)} — {byDate[d].length} muncitor{byDate[d].length !== 1 ? 'i' : ''}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9' }}>
                    <th style={th}>MUNCITOR</th>
                    <th style={th}>STATUS</th>
                    <th style={th}>START</th>
                    <th style={th}>STOP</th>
                    <th style={th}>ORE</th>
                    <th style={th}>MOTIV ABSENȚĂ</th>
                  </tr>
                </thead>
                <tbody>
                  {byDate[d].map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={td}>{e.employee_name}</td>
                      <td style={td}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                          background: e.entry_type === 'work' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                          color: e.entry_type === 'work' ? '#16a34a' : '#ef4444',
                        }}>
                          {e.entry_type === 'work' ? 'Prezent' : 'Absent'}
                        </span>
                      </td>
                      <td style={td}>{e.ora_start ?? '—'}</td>
                      <td style={td}>{e.ora_stop ?? '—'}</td>
                      <td style={td}>
                        {e.entry_type === 'work' ? `${e.hours_regular}h` : '—'}
                      </td>
                      <td style={{ ...td, color: '#92400e', fontStyle: e.notes ? 'normal' : 'italic' }}>
                        {e.entry_type !== 'work' ? (e.notes ?? '—') : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11,
  fontWeight: 700, color: '#64748B', letterSpacing: 0.8,
};
const td: React.CSSProperties = {
  padding: '9px 12px', color: '#1E293B',
};
