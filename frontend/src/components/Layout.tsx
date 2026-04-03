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

// SVG icon components
const icons: Record<string, () => JSX.Element> = {
  dashboard:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  sites:         () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>,
  procurement:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  hr:            () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  equipment:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>,
  aufmass:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  lv:            () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  billing:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  'invoice-scan':() => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  hausanschluss: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  documents:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  tagesbericht:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  pontaj:        () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  bauzeitenplan: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="14" x2="13" y2="14"/><line x1="7" y1="18" x2="11" y2="18"/></svg>,
  reports:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  users:         () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  settings:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

const NAV_ITEMS = [
  { key: 'dashboard',    roles: ['director','projekt_leiter','polier','sef_santier','callcenter','aufmass'] },
  { key: 'sites',        roles: ['director','projekt_leiter','polier','sef_santier','aufmass'] },
  { key: 'procurement',  roles: ['director','projekt_leiter','sef_santier'] },
  { key: 'hr',           roles: ['director'] },
  { key: 'equipment',    roles: ['director','projekt_leiter','sef_santier'] },
  { key: 'aufmass',      roles: ['director','projekt_leiter','polier','sef_santier','aufmass'] },
  { key: 'lv',           roles: ['director','projekt_leiter','aufmass'] },
  { key: 'billing',      roles: ['director','projekt_leiter','aufmass'] },
  { key: 'invoice-scan', roles: ['director','projekt_leiter'] },
  { key: 'hausanschluss',roles: ['director','callcenter'] },
  { key: 'documents',    roles: ['director','projekt_leiter','callcenter'] },
  { key: 'tagesbericht', roles: ['director','projekt_leiter','polier','sef_santier'] },
  { key: 'pontaj',       roles: ['director','projekt_leiter','polier','sef_santier'] },
  { key: 'bauzeitenplan',roles: ['director','projekt_leiter','aufmass'] },
  { key: 'reports',      roles: ['director','projekt_leiter','polier','sef_santier'] },
  { key: 'users',        roles: ['director'] },
  { key: 'settings',     roles: ['director'] },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function useIsTablet() {
  const [isTablet, setIsTablet] = useState(() => window.innerWidth >= 768 && window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isTablet;
}

// Bottom nav items — 5 most important for mobile
const BOTTOM_NAV_KEYS = ['dashboard', 'sites', 'tagesbericht', 'pontaj', 'hausanschluss'];

export function Layout({ user, onLogout, page, onNavigate, children }: Props) {
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const drawerRef = useRef<HTMLDivElement>(null);

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(user.role));

  useEffect(() => {
    if (!drawerOpen) return;
    function handle(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [drawerOpen]);

  function navigate(key: string) {
    onNavigate(key);
    if (isMobile) setDrawerOpen(false);
  }

  const showCollapsed = !isMobile && collapsed;

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{
        padding: showCollapsed ? '18px 16px' : '18px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        {!showCollapsed && (
          <div style={{ flex: 1 }}>
            <div style={{
              color: '#fff', fontWeight: 700, fontSize: 15,
              fontFamily: "'Fira Code', monospace", letterSpacing: '0.02em',
            }}>HestiOS</div>
            <div style={{ color: '#475569', fontSize: 10, fontWeight: 400, marginTop: 1 }}>Hesti Rossmann GmbH</div>
          </div>
        )}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
            style={{
              background: 'none', border: 'none', color: '#475569',
              cursor: 'pointer', padding: 6, flexShrink: 0,
              borderRadius: 4, display: 'flex', alignItems: 'center',
              transition: 'color 200ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              {collapsed
                ? <><polyline points="9 18 15 12 9 6"/></>
                : <><polyline points="15 18 9 12 15 6"/></>
              }
            </svg>
          </button>
        )}
        {isMobile && (
          <button
            onClick={() => setDrawerOpen(false)}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: '#475569', cursor: 'pointer', fontSize: 18, padding: 4,
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {visibleNav.map(item => {
          const active = page === item.key;
          const IconComp = icons[item.key] ?? icons.settings;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              title={showCollapsed ? t(`nav.${item.key}`) : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: 10, padding: showCollapsed ? '10px 20px' : '10px 16px',
                background: active ? 'rgba(249,115,22,0.12)' : 'none',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                borderLeft: active ? '2px solid #F97316' : '2px solid transparent',
                transition: 'background 200ms ease, border-color 200ms ease',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none'; }}
            >
              <span style={{
                width: 18, height: 18, flexShrink: 0,
                color: active ? '#F97316' : '#64748B',
                transition: 'color 200ms ease',
              }}>
                <IconComp />
              </span>
              {!showCollapsed && (
                <span style={{
                  color: active ? '#F1F5F9' : '#94A3B8',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  fontFamily: "'Fira Sans', sans-serif",
                  transition: 'color 200ms ease',
                  letterSpacing: '0.01em',
                }}>
                  {t(`nav.${item.key}`)}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: user + lang + logout */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px', flexShrink: 0 }}>
        {!showCollapsed && (
          <>
            <div style={{ color: '#E2E8F0', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{user.full_name}</div>
            <div style={{ color: '#475569', fontSize: 10, marginBottom: 10 }}>{t(`users.roles.${user.role}`)}</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              {(['ro','de','en'] as const).map(lng => (
                <button key={lng} onClick={() => { i18n.changeLanguage(lng); localStorage.setItem('hestios_lang', lng); }}
                  style={{
                    flex: 1, padding: '4px 0', borderRadius: 4, border: 'none',
                    background: i18n.language === lng ? '#F97316' : 'rgba(255,255,255,0.07)',
                    color: i18n.language === lng ? '#fff' : '#64748B',
                    fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    transition: 'background 200ms ease, color 200ms ease',
                  }}
                >{lng.toUpperCase()}</button>
              ))}
            </div>
          </>
        )}
        <button onClick={onLogout} style={{
          width: '100%', padding: '8px', borderRadius: 5, border: 'none',
          background: 'rgba(255,255,255,0.05)', color: '#94A3B8',
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'background 200ms ease, color 200ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#fca5a5'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94A3B8'; }}
        >
          {!showCollapsed && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          )}
          {showCollapsed ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          ) : t('nav.logout')}
        </button>
      </div>
    </>
  );

  const sidebarWidth = collapsed ? 58 : (isTablet ? 200 : 240);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Fira Sans', system-ui, sans-serif", background: '#F8FAFC' }}>

      {/* Desktop/Tablet sidebar */}
      {!isMobile && (
        <div style={{
          width: sidebarWidth, flexShrink: 0,
          background: '#0F172A',
          display: 'flex', flexDirection: 'column',
          transition: 'width 220ms ease',
          boxShadow: '1px 0 0 rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}>
          <SidebarContent />
        </div>
      )}

      {/* Mobile drawer */}
      {isMobile && drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)' }}>
          <div ref={drawerRef} style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: 260, background: '#0F172A',
            display: 'flex', flexDirection: 'column',
            boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
          }}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{
          height: 52, flexShrink: 0,
          background: '#fff',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 12,
        }}>
          {isMobile && (
            <button onClick={() => setDrawerOpen(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#64748B', padding: '4px', display: 'flex', alignItems: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          )}

          {isMobile && (
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1E293B', flex: 1, fontFamily: "'Fira Code', monospace" }}>
              {t(`nav.${page}`, page)}
            </div>
          )}

          {!isMobile && (
            <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto', fontFamily: "'Fira Sans', sans-serif" }}>
              {new Date().toLocaleDateString(
                i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO',
                { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
              )}
            </span>
          )}

          <div style={{ marginLeft: isMobile ? 0 : 0 }}>
            <NotificationCenter onNavigate={onNavigate} />
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'auto', paddingBottom: isMobile ? 64 : 0 }}>
          {children}
        </div>
      </div>

      {/* ── Mobile bottom navigation bar ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 900,
          background: '#0F172A', borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', height: 60,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.25)',
        }}>
          {BOTTOM_NAV_KEYS.filter(k => visibleNav.some(n => n.key === k)).map(key => {
            const active = page === key;
            const IconComp = icons[key] ?? icons.settings;
            return (
              <button
                key={key}
                onClick={() => navigate(key)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 3,
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderTop: active ? '2px solid #F97316' : '2px solid transparent',
                  paddingTop: 2,
                }}
              >
                <span style={{ width: 20, height: 20, color: active ? '#F97316' : '#475569' }}>
                  <IconComp />
                </span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, color: active ? '#F97316' : '#475569', letterSpacing: 0.3 }}>
                  {t(`nav.${key}`).slice(0, 10)}
                </span>
              </button>
            );
          })}
          {/* "More" button → opens drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              borderTop: '2px solid transparent',
            }}
          >
            <span style={{ width: 20, height: 20, color: '#475569' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
              </svg>
            </span>
            <span style={{ fontSize: 9, fontWeight: 400, color: '#475569', letterSpacing: 0.3 }}>{t('dashboardExtra.showMore')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
