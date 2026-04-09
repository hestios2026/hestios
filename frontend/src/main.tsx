import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Outfit (body) + JetBrains Mono (data) — replacing generic Figtree
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap';
document.head.appendChild(fontLink);

const style = document.createElement('style');
style.textContent = `
  :root {
    /* Brand */
    --green:        #22C55E;
    --green-dark:   #16A34A;
    --green-dim:    rgba(34,197,94,0.10);
    --green-glow:   rgba(34,197,94,0.25);
    --green-border: rgba(34,197,94,0.25);

    /* Dark workspace */
    --sidebar-bg:   #070B11;
    --topbar-bg:    #0C1118;
    --bg:           #0C1018;
    --surface:      #131B27;
    --surface-2:    #192233;
    --surface-3:    #1F2B40;
    --surface-hover: rgba(255,255,255,0.03);

    /* Borders */
    --border:       rgba(255,255,255,0.07);
    --border-light: rgba(255,255,255,0.04);
    --border-active: rgba(34,197,94,0.35);

    /* Text */
    --text:         #DDE4F0;
    --text-2:       #6A7A90;
    --text-3:       #374155;

    /* Semantic */
    --red:          #EF4444;
    --amber:        #F59E0B;
    --blue:         #3B82F6;
    --cyan:         #06B6D4;
    --purple:       #8B5CF6;

    /* Misc */
    --font-body:    'Outfit', system-ui, sans-serif;
    --font-mono:    'JetBrains Mono', 'Courier New', monospace;
    --radius:       8px;
    --transition:   180ms ease;

    /* Shadows */
    --shadow-sm:    0 1px 3px rgba(0,0,0,0.4);
    --shadow-md:    0 4px 16px rgba(0,0,0,0.5);
    --shadow-lg:    0 8px 32px rgba(0,0,0,0.6);
  }

  *, *::before, *::after { box-sizing: border-box; }

  body {
    margin: 0; padding: 0;
    font-family: var(--font-body);
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1,h2,h3,h4,h5,h6 { font-family: var(--font-body); font-weight: 700; margin: 0; }

  input, select, textarea {
    background: var(--surface-2);
    color: var(--text);
    border: 1px solid var(--border);
    font-family: var(--font-body);
  }

  input:focus, select:focus, textarea:focus {
    outline: 2px solid var(--green);
    outline-offset: 1px;
    border-color: var(--green-border);
  }
  button:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }

  /* ── Page padding ── */
  .page-root { padding: 28px 32px; }
  @media (max-width: 1023px) { .page-root { padding: 20px; } }
  @media (max-width: 767px)  { .page-root { padding: 14px; } }

  /* ── Surface cards ── */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sm);
  }

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

  table thead th {
    background: var(--surface-2);
    color: var(--text-2);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 10px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  table tbody tr {
    border-bottom: 1px solid var(--border-light);
    transition: background var(--transition);
  }
  table tbody tr:hover { background: var(--surface-hover); }

  table tbody td {
    padding: 11px 16px;
    font-size: 13px;
    color: var(--text);
  }

  /* ── Split layout ── */
  .split-layout { display: flex; height: 100vh; overflow: hidden; }
  .split-sidebar { width: 280px; flex-shrink: 0; overflow: auto; border-right: 1px solid var(--border); background: var(--surface); }
  .split-content { flex: 1; overflow: auto; }
  @media (max-width: 767px) {
    .split-layout { flex-direction: column; height: auto; overflow: visible; }
    .split-sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--border); max-height: 40vh; }
  }

  /* ── KPI grid ── */
  .stat-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 12px; margin-bottom: 24px; }
  @media (max-width: 767px) { .stat-cards { grid-template-columns: repeat(2,1fr); gap: 8px; } }

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

  /* ── Form controls dark override ── */
  input[type="text"], input[type="email"], input[type="password"],
  input[type="number"], input[type="date"], input[type="time"],
  input[type="search"], select, textarea {
    background: var(--surface-2) !important;
    color: var(--text) !important;
    border: 1px solid var(--border) !important;
    border-radius: 7px !important;
    font-family: var(--font-body) !important;
  }

  input::placeholder, textarea::placeholder { color: var(--text-3) !important; }

  select option {
    background: var(--surface-2);
    color: var(--text);
  }

  /* ── Status badges ── */
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  /* ── Buttons ── */
  .btn-primary {
    background: var(--green);
    color: #fff;
    border: none;
    border-radius: 7px;
    padding: 9px 18px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: var(--font-body);
    transition: background var(--transition), transform var(--transition);
  }
  .btn-primary:hover { background: var(--green-dark); }
  .btn-primary:active { transform: scale(0.98); }

  .btn-ghost {
    background: transparent;
    color: var(--text-2);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--font-body);
    transition: all var(--transition);
  }
  .btn-ghost:hover { background: var(--surface-2); color: var(--text); border-color: rgba(255,255,255,0.12); }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
