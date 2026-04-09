import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Figtree (modern, clean) + JetBrains Mono (data/numbers)
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap';
document.head.appendChild(fontLink);

const style = document.createElement('style');
style.textContent = `
  :root {
    --green:        #22C55E;
    --green-dark:   #16A34A;
    --green-dim:    rgba(34,197,94,0.12);
    --green-glow:   rgba(34,197,94,0.20);
    --sidebar-bg:   #0C0F16;
    --bg:           #F7F8FA;
    --surface:      #FFFFFF;
    --border:       #E5E7EB;
    --border-light: #F3F4F6;
    --text:         #111827;
    --text-2:       #6B7280;
    --text-3:       #9CA3AF;
    --font-body:    'Figtree', system-ui, sans-serif;
    --font-mono:    'JetBrains Mono', 'Courier New', monospace;
    --radius:       8px;
    --transition:   180ms ease;
  }

  *, *::before, *::after { box-sizing: border-box; }

  body {
    margin: 0; padding: 0;
    font-family: var(--font-body);
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }

  h1,h2,h3,h4,h5,h6 { font-family: var(--font-body); font-weight: 700; margin: 0; }

  input:focus, select:focus, textarea:focus {
    outline: 2px solid var(--green);
    outline-offset: 1px;
  }
  button:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #9CA3AF; }

  /* ── Page padding ── */
  .page-root { padding: 28px 32px; }
  @media (max-width: 1023px) { .page-root { padding: 20px; } }
  @media (max-width: 767px)  { .page-root { padding: 14px; } }

  /* ── Grid helpers ── */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
  @media (max-width: 1023px) {
    .grid-3 { grid-template-columns: 1fr 1fr; }
    .grid-4 { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 767px) {
    .grid-2,.grid-3 { grid-template-columns: 1fr; }
    .grid-4 { grid-template-columns: 1fr 1fr; }
  }

  /* ── Table ── */
  .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .table-wrap table { min-width: 600px; width: 100%; border-collapse: collapse; }

  /* ── Split layout ── */
  .split-layout { display: flex; height: 100vh; overflow: hidden; }
  .split-sidebar { width: 280px; flex-shrink: 0; overflow: auto; border-right: 1px solid var(--border); background: var(--surface); }
  .split-content { flex: 1; overflow: auto; }
  @media (max-width: 767px) {
    .split-layout { flex-direction: column; height: auto; overflow: visible; }
    .split-sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--border); max-height: 40vh; }
  }

  /* ── KPI grid ── */
  .stat-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 14px; margin-bottom: 24px; }
  @media (max-width: 767px) { .stat-cards { grid-template-columns: repeat(2,1fr); gap: 10px; } }

  /* ── Visibility ── */
  @media (max-width: 767px)  { .hide-mobile  { display: none !important; } }
  @media (max-width: 1023px) { .hide-tablet  { display: none !important; } }
  @media (max-width: 767px)  { .full-mobile  { width: 100% !important; } }

  /* ── Form grids ── */
  @media (max-width: 767px) {
    .form-grid-2, .form-grid-3 { grid-template-columns: 1fr !important; }
  }

  /* ── Dashboard main grid ── */
  @media (max-width: 1023px) { .dashboard-main-grid { grid-template-columns: 1fr !important; } }

  /* ── Touch targets ── */
  @media (max-width: 767px) {
    button { min-height: 36px; }
    input, select, textarea { font-size: 16px !important; }
  }

  /* ── Mobile table scroll ── */
  @media (max-width: 767px) {
    table:not([data-no-wrap]) {
      display: block; overflow-x: auto;
      -webkit-overflow-scrolling: touch; max-width: 100%;
    }
  }

  /* ── Modal mobile ── */
  @media (max-width: 767px) {
    [data-modal] { width: 95vw !important; max-height: 88vh !important; overflow-y: auto !important; }
  }

  /* ── Mobile card stack ── */
  .mobile-stack { display: flex; gap: 16px; flex-wrap: wrap; }
  .mobile-stack > * { flex: 1 1 260px; }

  /* ── iOS safe area ── */
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
