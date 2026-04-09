import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchSites } from '../api/sites';
import { fetchProgramari } from '../api/programari';
import { fetchEquipment } from '../api/equipment';
import { fetchEmployees } from '../api/employees';
import { STATUS_HA } from '../styles/ds';
import type { Site, User } from '../types';

interface Props { user: User; onNavigate: (p: string) => void; }

interface Programare {
  id: number;
  client_name: string;
  address: string;
  city: string | null;
  scheduled_date: string;
  status: string;
  assigned_site_id: number | null;
  assigned_site_name: string | null;
  assigned_team_name: string | null;
  connection_type: string | null;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, icon, sub }: {
  label: string; value: string | number; color: string; icon: React.ReactNode; sub?: string;
}) {
  return (
    <div
      style={{
        background: '#fff', borderRadius: 12, padding: '18px 20px',
        border: '1px solid #E4E7EC',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'box-shadow 200ms ease, transform 200ms ease',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 9,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, marginBottom: 14, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: 26, fontWeight: 800, color: '#101828', lineHeight: 1,
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{ fontSize: 12, color: '#667085', marginTop: 6, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#98A2B3', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── KPI Icons ─────────────────────────────────────────────────────────────────
const IconSite  = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>;
const IconMoney = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9.5 9.5C9.5 8.1 10.6 7 12 7s2.5 1.1 2.5 2.5c0 1.4-1.3 1.9-2.5 2.3-1.2.4-2.5 1-2.5 2.7 0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5"/></svg>;
const IconBox   = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const IconHome  = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconAlert = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IconUsers = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;

// ── Budget bar ────────────────────────────────────────────────────────────────
function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  if (!budget) return <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>;
  const pct = Math.min((spent / budget) * 100, 100);
  const color = pct > 90 ? '#dc2626' : pct > 70 ? '#d97706' : '#059669';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: '#1e293b', fontWeight: 600 }}>€{spent.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</span>
        <span style={{ color, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// ── Alert item ────────────────────────────────────────────────────────────────
interface Alert { type: 'error' | 'warning'; message: string; page?: string; }

function AlertItem({ a, onNavigate }: { a: Alert; onNavigate?: (p: string) => void }) {
  const isError = a.type === 'error';
  return (
    <div
      onClick={() => a.page && onNavigate?.(a.page)}
      style={{
        display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 8,
        background: isError ? '#fff5f5' : '#fffbeb',
        borderLeft: `3px solid ${isError ? '#dc2626' : '#d97706'}`,
        cursor: a.page ? 'pointer' : 'default', marginBottom: 6,
        fontSize: 12, color: '#374151',
      }}
    >
      <span>{isError ? '⚠' : '⚡'}</span>
      <span>{a.message}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function DashboardPage({ user, onNavigate }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const [sites, setSites]         = useState<Site[]>([]);
  const [programari, setProgramari] = useState<Programare[]>([]);
  const [equipment, setEquipment] = useState<{ service_due?: string; itp_due?: string; name: string }[]>([]);
  const [empCount, setEmpCount]   = useState(0);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchSites().then(setSites).catch(() => {});
    fetchProgramari({ day: todayStr }).then(setProgramari).catch(() => {});
    fetchEquipment().then(setEquipment).catch(() => {});
    fetchEmployees().then((d: any[]) => setEmpCount(d.filter(e => e.is_active).length)).catch(() => {});
  }, []);

  const baustellen  = sites.filter(s => s.is_baustelle);
  const activeSites = baustellen.filter(s => s.status === 'active').length;
  const totalCosts  = baustellen.reduce((a, s) => a + (s.total_costs || 0), 0);
  const pendingHA   = programari.filter(p => p.status !== 'done' && p.status !== 'cancelled').length;

  // Alerts
  const alerts: Alert[] = [];
  const upcoming = new Date(); upcoming.setDate(upcoming.getDate() + 7);
  const upcomingStr = upcoming.toISOString().split('T')[0];
  equipment.forEach(eq => {
    if (eq.service_due && eq.service_due <= upcomingStr)
      alerts.push({ type: 'warning', message: t('dashboard.alertService', { name: eq.name, date: eq.service_due }), page: 'equipment' });
    if (eq.itp_due && eq.itp_due <= upcomingStr)
      alerts.push({ type: 'warning', message: t('dashboard.alertITP', { name: eq.name, date: eq.itp_due }), page: 'equipment' });
  });
  baustellen.filter(s => s.budget > 0 && s.total_costs / s.budget > 0.9).forEach(s => {
    const pct = (s.total_costs / s.budget * 100).toFixed(0);
    alerts.push({ type: 'error', message: t('dashboard.alertBudget', { pct, name: s.name }), page: 'sites' });
  });

  // Group programări by site
  const hasBySite: Record<string, Programare[]> = {};
  const haNoSite: Programare[] = [];
  for (const p of programari) {
    if (p.assigned_site_id && p.assigned_site_name) {
      if (!hasBySite[p.assigned_site_name]) hasBySite[p.assigned_site_name] = [];
      hasBySite[p.assigned_site_name].push(p);
    } else {
      haNoSite.push(p);
    }
  }

  return (
    <div className="page-root">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: 0 }}>
          {t('dashboard.welcome')}, {user.full_name.split(' ')[0]}
        </h1>
        <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Hesti Rossmann GmbH
        </div>
      </div>

      {/* 6 KPI cards */}
      <div className="stat-cards" style={{ marginBottom: 24 }}>
        <KpiCard label={t('dashboard.activeSites')}     value={activeSites}  color="#22C55E" icon={<IconSite />} />
        <KpiCard label={t('dashboard.totalCosts')}      value={`€${totalCosts.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} color="#3B82F6" icon={<IconMoney />} />
        <KpiCard label={t('dashboard.pendingOrders')}   value={0}            color="#F59E0B" icon={<IconBox />} />
        <KpiCard label={t('dashboard.todaySchedules')}  value={pendingHA}    color="#8B5CF6" icon={<IconHome />} />
        <KpiCard label={t('dashboard.overdueInvoices')} value={0}            color={0 > 0 ? '#EF4444' : '#22C55E'} icon={<IconAlert />} />
        <KpiCard label={t('dashboard.activeEmployees')} value={empCount}     color="#06B6D4" icon={<IconUsers />} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,340px)', gap: 20, alignItems: 'start' }} className="dashboard-main-grid">
        {/* Kostenstellen table with budget bars */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{t('dashboard.kostenstellen')}</div>
            <span style={{ fontSize: 12, color: '#64748b' }}>{t('dashboard.totalCount', { count: sites.length })}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {[t('dashboard.colKST'), t('dashboard.colName'), t('dashboard.colClient'), t('dashboard.colStatus'), t('dashboard.colBudget')].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sites.map(s => {
                  const sStatus = s.status as string;
                  const statusStyle = s.is_baustelle
                    ? { bg: sStatus === 'active' ? '#d1fae5' : sStatus === 'finished' ? '#f1f5f9' : '#fef3c7', fg: sStatus === 'active' ? '#059669' : sStatus === 'finished' ? '#64748b' : '#d97706', label: sStatus === 'active' ? t('sites.status.active') : sStatus === 'finished' ? t('sites.status.finished') : t('sites.status.paused') }
                    : { bg: '#f1f5f9', fg: '#94a3b8', label: t('sites.status.overhead') };
                  return (
                    <tr key={s.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1d4ed8', fontFamily: 'monospace' }}>{s.kostenstelle}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{s.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{s.client}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: statusStyle.bg, color: statusStyle.fg }}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', minWidth: 160 }}>
                        <BudgetBar spent={s.total_costs || 0} budget={s.budget || 0} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: alerts + programări */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Alerts */}
          {alerts.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>
                {t('dashboard.alerts', { count: alerts.length })}
              </div>
              {(showAllAlerts ? alerts : alerts.slice(0, 5)).map((a, i) => (
                <AlertItem key={i} a={a} onNavigate={onNavigate} />
              ))}
              {alerts.length > 5 && (
                <button
                  onClick={() => setShowAllAlerts(p => !p)}
                  style={{ width: '100%', marginTop: 6, padding: '6px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }}>
                  {showAllAlerts
                    ? t('dashboard.showLess', 'Arată mai puține')
                    : t('dashboard.moreAlerts', { count: alerts.length - 5 })}
                </button>
              )}
            </div>
          )}

          {/* Programări azi */}
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{t('dashboard.todaySchedules')}</div>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {new Date().toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
              </span>
            </div>
            {!programari.length ? (
              <div style={{ padding: '24px 16px', color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>
                {t('dashboard.noTodaySchedules')}
              </div>
            ) : (
              <div>
                {[...Object.entries(hasBySite).map(([name, items]) => ({ name, items })),
                   ...(haNoSite.length ? [{ name: t('dashboard.noSiteGroup'), items: haNoSite }] : [])
                ].map(({ name, items }) => (
                  <div key={name}>
                    <div style={{ padding: '6px 12px', background: '#f8fafc', fontSize: 10, fontWeight: 700, color: '#1d4ed8', letterSpacing: 0.5 }}>
                      {name} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({items.length})</span>
                    </div>
                    {items.map(p => {
                      const s = STATUS_HA[p.status] || { bg: '#f1f5f9', color: '#64748b' };
                      const time = p.scheduled_date.split('T')[1]?.slice(0, 5) || '';
                      return (
                        <div key={p.id} style={{ padding: '9px 12px', borderBottom: '1px solid #f8fafc', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#1d4ed8', flexShrink: 0 }}>{time}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.client_name}</div>
                            <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}{p.city ? `, ${p.city}` : ''}</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: s.bg, color: s.color, flexShrink: 0 }}>
                            {STATUS_HA[p.status]?.label || p.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
