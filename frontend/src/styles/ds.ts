import type React from 'react';

// ─── Colors ──────────────────────────────────────────────────────────────────
export const C = {
  sidebar:        '#1e3a8a',
  primary:        '#1d4ed8',
  accent:         '#60a5fa',
  bg:             '#f1f5f9',
  surface:        '#ffffff',
  border:         '#e2e8f0',
  borderLight:    '#f1f5f9',
  textPrimary:    '#1e293b',
  textSecondary:  '#64748b',
  textMuted:      '#94a3b8',
  success:        '#059669', successBg:  '#d1fae5',
  warning:        '#d97706', warningBg:  '#fef3c7',
  danger:         '#dc2626', dangerBg:   '#fee2e2',
  info:           '#2563eb', infoBg:     '#dbeafe',
  // Chart (cost categories)
  chart: ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#94a3b8'],
};

// ─── Form inputs ─────────────────────────────────────────────────────────────
export const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
};
export const inpLg: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 15, width: '100%', boxSizing: 'border-box',
};
export const lbl: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4,
};

// ─── Buttons ─────────────────────────────────────────────────────────────────
export const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 7, border: 'none',
  background: C.primary, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
export const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db',
  background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151',
};
export const btnDanger: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 7, border: 'none',
  background: C.dangerBg, color: C.danger, fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
export const btnPrimaryLg: React.CSSProperties = {
  padding: '13px 24px', borderRadius: 10, border: 'none',
  background: C.primary, color: '#fff', fontWeight: 700, fontSize: 15,
  cursor: 'pointer', width: '100%', minHeight: 48,
};

// ─── Layout ───────────────────────────────────────────────────────────────────
export const card: React.CSSProperties = {
  background: C.surface, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};
export const sectionHeader: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: C.primary, textTransform: 'uppercase',
  letterSpacing: 1, paddingBottom: 6, borderBottom: `1px solid ${C.border}`, marginBottom: 14,
};
export const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
};
export const modalBox: React.CSSProperties = {
  background: C.surface, borderRadius: 14, padding: 28, width: '100%', maxWidth: 560,
  boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto',
};

// ─── Table ───────────────────────────────────────────────────────────────────
export const tblHeader: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700,
  color: C.textSecondary, whiteSpace: 'nowrap', background: '#f8fafc',
};
export const tblCell: React.CSSProperties = {
  padding: '12px 16px', fontSize: 13, color: C.textPrimary,
};
export const tblRow: React.CSSProperties = {
  borderTop: `1px solid ${C.borderLight}`,
};

// ─── Status maps (single source of truth) ────────────────────────────────────
export const STATUS_HA: Record<string, { bg: string; color: string; label: string }> = {
  new:         { bg: '#eff6ff', color: '#1d4ed8', label: 'Nou' },
  scheduled:   { bg: '#fef3c7', color: '#d97706', label: 'Programat' },
  in_progress: { bg: '#dbeafe', color: '#2563eb', label: 'În lucru' },
  done:        { bg: '#d1fae5', color: '#059669', label: 'Finalizat' },
  cancelled:   { bg: '#f1f5f9', color: '#94a3b8', label: 'Anulat' },
};
export const STATUS_SITE: Record<string, { bg: string; color: string; label: string }> = {
  active:   { bg: '#d1fae5', color: '#059669', label: 'Activ' },
  paused:   { bg: '#fef3c7', color: '#d97706', label: 'Pauzat' },
  finished: { bg: '#f1f5f9', color: '#64748b', label: 'Finalizat' },
};
export const STATUS_INVOICE: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#f1f5f9', color: '#64748b', label: 'Draft' },
  sent:      { bg: '#dbeafe', color: '#2563eb', label: 'Trimisă' },
  paid:      { bg: '#d1fae5', color: '#059669', label: 'Plătită' },
  overdue:   { bg: '#fee2e2', color: '#dc2626', label: 'Restantă' },
  cancelled: { bg: '#f1f5f9', color: '#94a3b8', label: 'Anulată' },
};
export const STATUS_ORDER: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#fef3c7', color: '#d97706', label: 'Pendinte' },
  approved:  { bg: '#dbeafe', color: '#2563eb', label: 'Aprobat' },
  sent:      { bg: '#d1fae5', color: '#059669', label: 'Trimis' },
  cancelled: { bg: '#f1f5f9', color: '#94a3b8', label: 'Anulat' },
};
export const STATUS_REPORT: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#fef3c7', color: '#d97706', label: 'Draft' },
  submitted: { bg: '#dbeafe', color: '#2563eb', label: 'Trimis' },
  approved:  { bg: '#d1fae5', color: '#059669', label: 'Aprobat' },
};

// ─── Notification type → visual ───────────────────────────────────────────────
export const NOTIF_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  equipment_service_due:   { icon: '🔧', color: '#d97706', bg: '#fffbeb' },
  equipment_itp_due:       { icon: '📋', color: '#d97706', bg: '#fffbeb' },
  invoice_overdue:         { icon: '⚠', color: '#dc2626', bg: '#fff5f5' },
  order_pending:           { icon: '📦', color: '#d97706', bg: '#fffbeb' },
  report_missing:          { icon: '📝', color: '#dc2626', bg: '#fff5f5' },
  report_missing_escalation: { icon: '🚨', color: '#dc2626', bg: '#fff5f5' },
  ha_scheduled_today:      { icon: '🏠', color: '#1d4ed8', bg: '#f0f7ff' },
  budget_alert:            { icon: '📊', color: '#dc2626', bg: '#fff5f5' },
  document_uploaded:       { icon: '📁', color: '#059669', bg: '#f0fdf4' },
};
