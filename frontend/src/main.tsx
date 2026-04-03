import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Load Fira Code + Fira Sans from Google Fonts
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap';
document.head.appendChild(fontLink);

// Global styles
const style = document.createElement('style');
style.textContent = `
  :root {
    --color-primary: #64748B;
    --color-cta: #F97316;
    --color-cta-hover: #EA6C00;
    --color-bg: #F8FAFC;
    --color-surface: #FFFFFF;
    --color-text: #334155;
    --color-text-muted: #64748B;
    --color-border: #E2E8F0;
    --color-sidebar: #0F172A;
    --color-sidebar-hover: rgba(255,255,255,0.06);
    --color-sidebar-active: rgba(249,115,22,0.15);
    --color-sidebar-text: #94A3B8;
    --color-sidebar-text-active: #FFFFFF;
    --radius: 6px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.10);
    --transition: 200ms ease;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: 'Fira Sans', system-ui, sans-serif; background: var(--color-bg); color: var(--color-text); }
  input:focus, select:focus, textarea:focus { outline: 2px solid var(--color-cta); outline-offset: 1px; }
  button:focus-visible { outline: 2px solid var(--color-cta); }
  h1, h2, h3, h4, h5, h6 { font-family: 'Fira Code', monospace; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #f1f5f9; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

  /* ── Responsive utilities ── */

  /* Page padding */
  .page-root { padding: 28px 32px; }
  @media (max-width: 1023px) { .page-root { padding: 20px 20px; } }
  @media (max-width: 767px)  { .page-root { padding: 14px 14px; } }

  /* Responsive grid helpers */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  @media (max-width: 1023px) {
    .grid-3 { grid-template-columns: 1fr 1fr; }
    .grid-4 { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 767px) {
    .grid-2 { grid-template-columns: 1fr; }
    .grid-3 { grid-template-columns: 1fr; }
    .grid-4 { grid-template-columns: 1fr 1fr; }
  }

  /* Responsive table wrapper */
  .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .table-wrap table { min-width: 600px; width: 100%; border-collapse: collapse; }

  /* Split layouts (sidebar + detail) */
  .split-layout { display: flex; height: 100vh; overflow: hidden; }
  .split-sidebar { width: 280px; flex-shrink: 0; overflow: auto; border-right: 1px solid var(--color-border); background: var(--color-surface); }
  .split-content { flex: 1; overflow: auto; }
  @media (max-width: 767px) {
    .split-layout { flex-direction: column; height: auto; overflow: visible; }
    .split-sidebar { width: 100%; height: auto; border-right: none; border-bottom: 1px solid #e2e8f0; max-height: 40vh; }
  }

  /* Card grids on dashboard */
  .stat-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  @media (max-width: 1023px) { .stat-cards { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 767px)  { .stat-cards { grid-template-columns: repeat(2, 1fr); gap: 10px; } }

  /* Hide on mobile */
  @media (max-width: 767px) { .hide-mobile { display: none !important; } }
  @media (max-width: 1023px) { .hide-tablet { display: none !important; } }

  /* Full width on mobile */
  @media (max-width: 767px) { .full-mobile { width: 100% !important; max-width: 100% !important; } }

  /* Form grids */
  @media (max-width: 767px) {
    form .form-grid-2, .form-grid-2 { grid-template-columns: 1fr !important; }
    form .form-grid-3, .form-grid-3 { grid-template-columns: 1fr !important; }
  }

  /* Dashboard main grid */
  @media (max-width: 1023px) { .dashboard-main-grid { grid-template-columns: 1fr !important; } }

  /* Touch-friendly tap targets */
  @media (max-width: 767px) {
    button { min-height: 36px; }
    input, select, textarea { font-size: 16px !important; } /* prevents iOS zoom */
  }

  /* ── Tables always scroll on mobile ── */
  @media (max-width: 767px) {
    table { min-width: 480px; }
    /* Auto-wrap any table that doesn't already have an overflow parent */
    table:not([data-no-wrap]) {
      display: block;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      max-width: 100%;
    }
  }

  /* ── Modal responsive — full width on mobile ── */
  @media (max-width: 767px) {
    [data-modal] {
      width: 95vw !important;
      max-height: 88vh !important;
      overflow-y: auto !important;
    }
  }

  /* ── Utility: mobile card stacking ── */
  .mobile-stack { display: flex; gap: 16px; flex-wrap: wrap; }
  .mobile-stack > * { flex: 1 1 260px; }

  /* ── Reduce padding on mobile globally ── */
  @media (max-width: 767px) {
    .page-inner { padding: 14px !important; }
  }

  /* ── Safe area for iOS home indicator ── */
  @supports (padding-bottom: env(safe-area-inset-bottom)) {
    .ios-safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
  }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
