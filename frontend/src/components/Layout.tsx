import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '../types';
import { NotificationCenter } from './NotificationCenter';

interface Props {
  user: User;
  onLogout: () => void;
  page: string;
  onNavigate: (p: string) => void;
  children: React.ReactNode;
}

const icons: Record<string, () => JSX.Element> = {
  dashboard:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>,
  sites:         () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>,
  procurement:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  hr:            () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  equipment:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01M8 12h.01M16 12h.01"/></svg>,
  aufmass:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  lv:            () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  billing:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  'invoice-scan':() => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  hausanschluss: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  documents:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  tagesbericht:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  pontaj:        () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  bauzeitenplan: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="14" x2="13" y2="14"/><line x1="7" y1="18" x2="11" y2="18"/></svg>,
  reports:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  users:         () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  settings:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
};

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { key: 'dashboard',    roles: ['director','projekt_leiter','polier','sef_santier','callcenter','aufmass'] },
    ],
  },
  {
    label: 'Operațional',
    items: [
      { key: 'sites',        roles: ['director','projekt_leiter','polier','sef_santier','aufmass'] },
      { key: 'equipment',    roles: ['director','projekt_leiter','sef_santier'] },
      { key: 'procurement',  roles: ['director','projekt_leiter','sef_santier'] },
      { key: 'hausanschluss',roles: ['director','callcenter'] },
      { key: 'tagesbericht', roles: ['director','projekt_leiter','polier','sef_santier'] },
      { key: 'pontaj',       roles: ['director','projekt_leiter','polier','sef_santier'] },
    ],
  },
  {
    label: 'Financiar',
    items: [
      { key: 'aufmass',      roles: ['director','projekt_leiter','polier','sef_santier','aufmass'] },
      { key: 'lv',           roles: ['director','projekt_leiter','aufmass'] },
      { key: 'billing',      roles: ['director','projekt_leiter','aufmass'] },
      { key: 'invoice-scan', roles: ['director','projekt_leiter'] },
      { key: 'bauzeitenplan',roles: ['director','projekt_leiter','aufmass'] },
    ],
  },
  {
    label: 'Administrare',
    items: [
      { key: 'hr',           roles: ['director'] },
      { key: 'documents',    roles: ['director','projekt_leiter','callcenter'] },
      { key: 'reports',      roles: ['director','projekt_leiter','polier','sef_santier'] },
      { key: 'users',        roles: ['director'] },
      { key: 'settings',     roles: ['director'] },
    ],
  },
];

function useIsMobile() {
  const [v, setV] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setV(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return v;
}

function useIsTablet() {
  const [v, setV] = useState(() => window.innerWidth >= 768 && window.innerWidth < 1024);
  useEffect(() => {
    const h = () => setV(window.innerWidth >= 768 && window.innerWidth < 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return v;
}

const BOTTOM_NAV_KEYS = ['dashboard', 'sites', 'tagesbericht', 'pontaj', 'hausanschluss'];

function Initials({ name, size = 32 }: { name: string; size?: number }) {
  const parts = name.trim().split(' ');
  const ini = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(34,197,94,0.12)',
      border: '1.5px solid rgba(34,197,94,0.28)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#22C55E', fontSize: size * 0.34, fontWeight: 700,
      flexShrink: 0, letterSpacing: '0.04em',
      fontFamily: 'var(--font-mono)',
    }}>{ini}</div>
  );
}

export function Layout({ user, onLogout, page, onNavigate, children }: Props) {
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const drawerRef = useRef<HTMLDivElement>(null);

  const userRole = user.role;

  useEffect(() => {
    if (!drawerOpen) return;
    const handle = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [drawerOpen]);

  function navigate(key: string) {
    onNavigate(key);
    if (isMobile) setDrawerOpen(false);
  }

  const showCollapsed = !isMobile && collapsed;
  const sidebarWidth = collapsed ? 56 : (isTablet ? 210 : 244);

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Brand */}
      <div style={{
        padding: showCollapsed ? '14px 0' : '14px 14px 12px',
        display: 'flex', alignItems: 'center',
        gap: 10, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        justifyContent: showCollapsed ? 'center' : 'flex-start',
        position: 'relative',
      }}>
        {/* Logo mark */}
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: '#22C55E',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px rgba(34,197,94,0.3)',
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>
          </svg>
        </div>

        {!showCollapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: '#E8EDF5', fontWeight: 800, fontSize: 15,
              fontFamily: 'var(--font-body)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}>HestiOS</div>
            <div style={{
              color: 'rgba(255,255,255,0.2)', fontSize: 9.5,
              fontWeight: 500, marginTop: 2.5, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              Hesti Rossmann GmbH
            </div>
          </div>
        )}

        {!isMobile && !showCollapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)',
              cursor: 'pointer', padding: 4, flexShrink: 0,
              borderRadius: 4, display: 'flex', alignItems: 'center',
              transition: 'color 150ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}

        {isMobile && (
          <button onClick={() => setDrawerOpen(false)} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4,
            display: 'flex', alignItems: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
        {NAV_GROUPS.map((group, gi) => {
          const visible = group.items.filter(i => i.roles.includes(userRole));
          if (!visible.length) return null;
          return (
            <div key={gi} style={{ marginBottom: 2 }}>
              {/* Group separator */}
              {group.label && (
                showCollapsed
                  ? <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 10px' }} />
                  : <div style={{
                      padding: '10px 16px 4px',
                      fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.18)',
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                    }}>
                      {group.label}
                    </div>
              )}

              {visible.map(item => {
                const active = page === item.key;
                const IconComp = icons[item.key] ?? icons.settings;
                return (
                  <div key={item.key} style={{ padding: showCollapsed ? '1px 6px' : '1px 7px' }}>
                    <button
                      onClick={() => navigate(item.key)}
                      title={showCollapsed ? t(`nav.${item.key}`) : undefined}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        gap: 9, padding: showCollapsed ? '8px 0' : '7.5px 10px',
                        justifyContent: showCollapsed ? 'center' : 'flex-start',
                        background: active ? 'rgba(34,197,94,0.10)' : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        borderRadius: 7,
                        transition: 'background 120ms ease',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Active left bar */}
                      {active && !showCollapsed && (
                        <div style={{
                          position: 'absolute', left: 0, top: '20%', bottom: '20%',
                          width: 2.5, borderRadius: 2,
                          background: '#22C55E',
                          boxShadow: '0 0 6px rgba(34,197,94,0.6)',
                        }} />
                      )}
                      <span style={{
                        width: 16, height: 16, flexShrink: 0,
                        color: active ? '#22C55E' : 'rgba(255,255,255,0.28)',
                        transition: 'color 150ms ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <IconComp />
                      </span>
                      {!showCollapsed && (
                        <span style={{
                          color: active ? '#E8EDF5' : 'rgba(255,255,255,0.45)',
                          fontSize: 13, fontWeight: active ? 600 : 400,
                          fontFamily: 'var(--font-body)',
                          transition: 'color 150ms ease',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {t(`nav.${item.key}`)}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: showCollapsed ? '10px 6px' : '10px 8px',
        flexShrink: 0,
      }}>
        {!showCollapsed && (
          <>
            {/* User info */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '7px 10px', borderRadius: 7, marginBottom: 8,
            }}>
              <Initials name={user.full_name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {user.full_name}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 1 }}>
                  {t(`users.roles.${user.role}`)}
                </div>
              </div>
            </div>

            {/* Language */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 6, padding: '0 2px' }}>
              {(['ro','de','en'] as const).map(lng => (
                <button key={lng} onClick={() => { i18n.changeLanguage(lng); localStorage.setItem('hestios_lang', lng); }}
                  style={{
                    flex: 1, padding: '4.5px 0', borderRadius: 5, border: 'none',
                    background: i18n.language === lng ? 'rgba(34,197,94,0.15)' : 'transparent',
                    color: i18n.language === lng ? '#22C55E' : 'rgba(255,255,255,0.22)',
                    fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    transition: 'all 150ms ease',
                    fontFamily: 'var(--font-body)',
                    letterSpacing: '0.05em',
                  }}
                >{lng.toUpperCase()}</button>
              ))}
            </div>
          </>
        )}

        {/* Logout */}
        <button onClick={onLogout} style={{
          width: '100%', padding: '7px',
          borderRadius: 6, border: 'none',
          background: 'transparent', color: 'rgba(255,255,255,0.25)',
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center',
          justifyContent: showCollapsed ? 'center' : 'flex-start',
          gap: 7, transition: 'background 150ms ease, color 150ms ease',
          fontFamily: 'var(--font-body)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#F87171'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {!showCollapsed && t('nav.logout')}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      fontFamily: 'var(--font-body)',
      background: 'var(--bg)',
    }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <div style={{
          width: sidebarWidth, flexShrink: 0,
          background: 'var(--sidebar-bg)',
          display: 'flex', flexDirection: 'column',
          transition: 'width 200ms ease',
          overflow: 'hidden',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}>
          <SidebarContent />
        </div>
      )}

      {/* Mobile drawer */}
      {isMobile && drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)' }}>
          <div ref={drawerRef} style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: 260, background: 'var(--sidebar-bg)',
            display: 'flex', flexDirection: 'column',
            boxShadow: '8px 0 40px rgba(0,0,0,0.5)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Topbar — dark, integrated */}
        <div style={{
          height: 52, flexShrink: 0,
          background: 'var(--topbar-bg)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 12,
        }}>
          {/* Hamburger (mobile) */}
          {isMobile && (
            <button onClick={() => setDrawerOpen(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.45)', padding: '4px', display: 'flex', alignItems: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          )}

          {/* Expand button when sidebar collapsed */}
          {!isMobile && collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.3)', padding: '4px', display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          )}

          {/* Page title */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Breadcrumb-style: tiny dot + page name */}
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#22C55E',
              boxShadow: '0 0 6px rgba(34,197,94,0.7)',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '-0.01em',
            }}>
              {t(`nav.${page}`, page)}
            </span>
          </div>

          {/* Date (desktop) */}
          {!isMobile && (
            <span style={{
              fontSize: 11.5, color: 'rgba(255,255,255,0.22)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.03em',
            }}>
              {new Date().toLocaleDateString(
                i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO',
                { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
              ).toUpperCase()}
            </span>
          )}

          {/* Notifications */}
          <NotificationCenter onNavigate={onNavigate} />

          {/* User avatar (desktop) */}
          {!isMobile && <Initials name={user.full_name} size={30} />}
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'auto', paddingBottom: isMobile ? 64 : 0 }}>
          {children}
        </div>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 900,
          background: 'var(--sidebar-bg)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', height: 58,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        }}>
          {BOTTOM_NAV_KEYS.filter(k => {
            const allItems = NAV_GROUPS.flatMap(g => g.items);
            const item = allItems.find(i => i.key === k);
            return item && item.roles.includes(userRole);
          }).map(key => {
            const active = page === key;
            const IconComp = icons[key] ?? icons.settings;
            return (
              <button key={key} onClick={() => navigate(key)} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                borderTop: active ? '2px solid #22C55E' : '2px solid transparent',
                paddingTop: 2, transition: 'border-color 150ms ease',
              }}>
                <span style={{ width: 18, height: 18, color: active ? '#22C55E' : 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconComp />
                </span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, color: active ? '#22C55E' : 'rgba(255,255,255,0.28)', letterSpacing: 0.2 }}>
                  {t(`nav.${key}`).slice(0, 10)}
                </span>
              </button>
            );
          })}

          <button onClick={() => setDrawerOpen(true)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer',
            borderTop: '2px solid transparent',
          }}>
            <span style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
              </svg>
            </span>
            <span style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.28)', letterSpacing: 0.2 }}>
              {t('dashboardExtra.showMore')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
