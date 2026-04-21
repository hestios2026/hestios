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
function KpiCard({ label, value, color, icon, sub, trend, onClick }: {
  label: string; value: string | number; color: string; icon: React.ReactNode; sub?: string; trend?: string; onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--surface-2)' : 'var(--surface)',
        borderRadius: 10,
        border: hovered ? `1px solid ${color}30` : '1px solid var(--border)',
        padding: '16px 18px',
        transition: 'all 180ms ease',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {onClick && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          color: hovered ? color : 'var(--text-3)',
          fontSize: 11, fontWeight: 600, opacity: hovered ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}>→</div>
      )}
      {/* Accent line top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2,
        background: `linear-gradient(90deg, ${color} 0%, transparent 70%)`,
        opacity: hovered ? 1 : 0.5,
        transition: 'opacity 180ms ease',
      }} />

      {/* Icon + trend row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: `${color}14`,
          border: `1px solid ${color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {icon}
        </div>
        {trend && (
          <span style={{
            fontSize: 10, fontWeight: 700, color,
            background: `${color}10`,
            padding: '2px 7px', borderRadius: 12,
            letterSpacing: '0.03em',
          }}>{trend}</span>
        )}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 28, fontWeight: 800, color: 'var(--text)',
        lineHeight: 1, letterSpacing: '-0.03em',
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        marginBottom: 6,
      }}>{value}</div>

      {/* Label */}
      <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, lineHeight: 1.3 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── KPI Icons ─────────────────────────────────────────────────────────────────
const Ico = ({ d, d2 }: { d: string; d2?: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
);
const IconSite  = () => <Ico d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />;
const IconMoney = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9.5 9.5C9.5 8.1 10.6 7 12 7s2.5 1.1 2.5 2.5c0 1.4-1.3 1.9-2.5 2.3-1.2.4-2.5 1-2.5 2.7 0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5"/></svg>;
const IconCal   = () => <Ico d="M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" />;
const IconAlert = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IconUsers = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
const IconBox   = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;

// ── Budget bar ────────────────────────────────────────────────────────────────
function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  if (!budget) return <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>;
  const pct = Math.min((spent / budget) * 100, 100);
  const color = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#22C55E';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          €{spent.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
        </span>
        <span style={{ color, fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 2,
          background: color,
          boxShadow: pct > 70 ? `0 0 6px ${color}80` : 'none',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

// ── Alert item ────────────────────────────────────────────────────────────────
interface Alert { type: 'error' | 'warning'; message: string; page?: string; }

function AlertItem({ a, onNavigate }: { a: Alert; onNavigate?: (p: string) => void }) {
  const isError = a.type === 'error';
  const color = isError ? '#EF4444' : '#F59E0B';
  return (
    <div
      onClick={() => a.page && onNavigate?.(a.page)}
      style={{
        display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 7,
        background: `${color}0A`,
        border: `1px solid ${color}18`,
        cursor: a.page ? 'pointer' : 'default', marginBottom: 5,
        fontSize: 12, color: 'var(--text-2)',
        transition: 'background 150ms ease',
      }}
      onMouseEnter={e => a.page && (e.currentTarget.style.background = `${color}14`)}
      onMouseLeave={e => (e.currentTarget.style.background = `${color}0A`)}
    >
      <span style={{ color, flexShrink: 0, marginTop: 1 }}>{isError ? '▲' : '◆'}</span>
      <span style={{ lineHeight: 1.5 }}>{a.message}</span>
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Activ',     color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  paused:   { label: 'Pauză',     color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  finished: { label: 'Finalizat', color: '#6A7A90', bg: 'rgba(106,122,144,0.12)' },
};

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
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#22C55E',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            Dashboard
          </div>
          <h1 style={{
            fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0,
            letterSpacing: '-0.025em', lineHeight: 1,
          }}>
            {t('dashboard.welcome')}, {user.full_name.split(' ')[0]}
          </h1>
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.05em',
        }}>
          {new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
        </div>
      </div>

      {/* 6 KPI cards */}
      <div className="stat-cards" style={{ marginBottom: 24 }}>
        <KpiCard label={t('dashboard.activeSites')}     value={activeSites}  color="#22C55E" icon={<IconSite />}  onClick={() => onNavigate('sites')} />
        <KpiCard label={t('dashboard.totalCosts')}      value={`€${totalCosts.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} color="#3B82F6" icon={<IconMoney />} onClick={() => onNavigate('sites')} />
        <KpiCard label={t('dashboard.pendingOrders')}   value={0}            color="#F59E0B" icon={<IconBox />}   onClick={() => onNavigate('procurement')} />
        <KpiCard label={t('dashboard.todaySchedules')}  value={pendingHA}    color="#8B5CF6" icon={<IconCal />}   onClick={() => onNavigate('hausanschluss')} />
        <KpiCard label={t('dashboard.overdueInvoices')} value={0}            color={0 > 0 ? '#EF4444' : '#22C55E'} icon={<IconAlert />} onClick={() => onNavigate('billing')} />
        <KpiCard label={t('dashboard.activeEmployees')} value={empCount}     color="#06B6D4" icon={<IconUsers />} onClick={() => onNavigate('hr')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,320px)', gap: 18, alignItems: 'start' }} className="dashboard-main-grid">

        {/* Kostenstellen table */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: 10,
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          <div
            onClick={() => onNavigate('sites')}
            style={{
              padding: '13px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {t('dashboard.kostenstellen')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 10, color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)', fontWeight: 500,
                background: 'var(--surface-2)',
                padding: '2px 8px', borderRadius: 12,
                border: '1px solid var(--border)',
              }}>
                {sites.length} {t('dashboard.totalCount', { count: sites.length }).replace(/\d+\s*/, '')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>→</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[t('dashboard.colKST'), t('dashboard.colName'), t('dashboard.colClient'), t('dashboard.colStatus'), t('dashboard.colBudget')].map(h => (
                    <th key={h} style={{
                      padding: '9px 16px', textAlign: 'left',
                      fontSize: 10, fontWeight: 700,
                      color: 'var(--text-3)',
                      background: 'var(--surface-2)',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sites.map(s => {
                  const sStatus = s.status as string;
                  const meta = s.is_baustelle
                    ? (STATUS_META[sStatus] ?? { label: sStatus, color: '#6A7A90', bg: 'rgba(106,122,144,0.10)' })
                    : { label: t('sites.status.overhead'), color: 'var(--text-3)', bg: 'var(--surface-2)' };
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                      onClick={() => onNavigate('sites')}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: '#22C55E',
                          fontFamily: 'var(--font-mono)',
                        }}>{s.kostenstelle}</span>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.name}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-2)' }}>{s.client}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          padding: '2px 9px', borderRadius: 20,
                          fontSize: 10, fontWeight: 700,
                          background: meta.bg, color: meta.color,
                          display: 'inline-block',
                        }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', minWidth: 150 }}>
                        <BudgetBar spent={s.total_costs || 0} budget={s.budget || 0} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div style={{
              background: 'var(--surface)',
              borderRadius: 10, border: '1px solid var(--border)',
              padding: 14,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>
                  {t('dashboard.alerts', { count: alerts.length })}
                </div>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(239,68,68,0.15)', color: '#EF4444',
                  fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{alerts.length}</span>
              </div>
              {(showAllAlerts ? alerts : alerts.slice(0, 5)).map((a, i) => (
                <AlertItem key={i} a={a} onNavigate={onNavigate} />
              ))}
              {alerts.length > 5 && (
                <button
                  onClick={() => setShowAllAlerts(p => !p)}
                  style={{
                    width: '100%', marginTop: 6, padding: '6px',
                    borderRadius: 6, border: '1px solid var(--border)',
                    background: 'transparent', fontSize: 11.5, color: '#22C55E',
                    fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    transition: 'background 150ms ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {showAllAlerts
                    ? t('dashboard.showLess', 'Arată mai puține')
                    : `+ ${alerts.length - 5} ${t('dashboard.moreAlerts', { count: alerts.length - 5 }).replace(/\d+\s*/, '')}`}
                </button>
              )}
            </div>
          )}

          {/* Programări azi */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: 10, border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            <div
              onClick={() => onNavigate('hausanschluss')}
              style={{
                padding: '13px 14px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>
                {t('dashboard.todaySchedules')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10, color: 'var(--text-3)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {new Date().toLocaleDateString(locale, { day: 'numeric', month: 'short' }).toUpperCase()}
                </span>
                <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>→</span>
              </div>
            </div>

            {!programari.length ? (
              <div style={{
                padding: '28px 14px', color: 'var(--text-3)',
                textAlign: 'center', fontSize: 12.5,
              }}>
                {t('dashboard.noTodaySchedules')}
              </div>
            ) : (
              <div>
                {[...Object.entries(hasBySite).map(([name, items]) => ({ name, items })),
                   ...(haNoSite.length ? [{ name: t('dashboard.noSiteGroup'), items: haNoSite }] : [])
                ].map(({ name, items }) => (
                  <div key={name}>
                    <div style={{
                      padding: '5px 12px',
                      background: 'var(--surface-2)',
                      fontSize: 9.5, fontWeight: 700, color: '#22C55E',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      {name} <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>({items.length})</span>
                    </div>
                    {items.map(p => {
                      const s = STATUS_HA[p.status] || { bg: 'rgba(106,122,144,0.1)', color: 'var(--text-2)', label: p.status };
                      const time = p.scheduled_date.split('T')[1]?.slice(0, 5) || '';
                      return (
                        <div key={p.id}
                          onClick={() => onNavigate('hausanschluss')}
                          style={{
                            padding: '9px 12px',
                            borderBottom: '1px solid var(--border-light)',
                            display: 'flex', gap: 9, alignItems: 'flex-start',
                            transition: 'background 120ms ease',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                            color: '#22C55E', flexShrink: 0, marginTop: 1,
                          }}>{time}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 12, fontWeight: 600, color: 'var(--text)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{p.client_name}</div>
                            <div style={{
                              fontSize: 11, color: 'var(--text-2)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{p.address}{p.city ? `, ${p.city}` : ''}</div>
                          </div>
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, padding: '2px 7px',
                            borderRadius: 10, background: s.bg, color: s.color, flexShrink: 0,
                            whiteSpace: 'nowrap',
                          }}>
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
