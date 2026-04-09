import type React from 'react';

// ─── Brand palette ────────────────────────────────────────────────────────────
export const C = {
  sidebar:      '#0C0F16',
  green:        '#22C55E',   // primary accent
  greenDark:    '#16A34A',   // hover
  greenDim:     'rgba(34,197,94,0.12)',
  primary:      '#22C55E',
  bg:           '#F7F8FA',
  surface:      '#FFFFFF',
  border:       '#E5E7EB',
  borderLight:  '#F3F4F6',
  textPrimary:  '#111827',
  textSecondary:'#6B7280',
  textMuted:    '#9CA3AF',
  success:      '#16A34A', successBg: '#F0FDF4',
  warning:      '#B45309', warningBg: '#FFFBEB',
  danger:       '#DC2626', dangerBg:  '#FEF2F2',
  info:         '#2563EB', infoBg:    '#EFF6FF',
  chart: ['#22C55E','#3B82F6','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#9CA3AF'],
};

const font = "'Figtree', system-ui, sans-serif";

// ─── Form inputs ─────────────────────────────────────────────────────────────
export const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 7,
  border: `1px solid ${C.border}`, background: '#fff',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
  fontFamily: font, color: C.textPrimary,
};
export const inpLg: React.CSSProperties = {
  padding: '11px 13px', borderRadius: 8,
  border: `1px solid ${C.border}`, background: '#fff',
  fontSize: 14, width: '100%', boxSizing: 'border-box',
  fontFamily: font, color: C.textPrimary,
};
export const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: C.textSecondary,
  display: 'block', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

// ─── Buttons ─────────────────────────────────────────────────────────────────
export const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 7, border: 'none',
  background: C.green, color: '#fff', fontWeight: 700,
  fontSize: 13, cursor: 'pointer', fontFamily: font,
};
export const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 7,
  border: `1px solid ${C.border}`, background: '#fff',
  fontSize: 13, cursor: 'pointer', color: C.textPrimary, fontFamily: font,
};
export const btnDanger: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 7, border: 'none',
  background: C.dangerBg, color: C.danger,
  fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: font,
};
export const btnPrimaryLg: React.CSSProperties = {
  padding: '12px 24px', borderRadius: 8, border: 'none',
  background: C.green, color: '#fff', fontWeight: 700,
  fontSize: 15, cursor: 'pointer', width: '100%', minHeight: 46,
  fontFamily: font,
};

// ─── Layout ──────────────────────────────────────────────────────────────────
export const card: React.CSSProperties = {
  background: C.surface, borderRadius: 10,
  border: `1px solid ${C.border}`,
};
export const sectionHeader: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: C.textMuted,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  paddingBottom: 8, borderBottom: `1px solid ${C.border}`, marginBottom: 14,
};
export const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.50)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20, backdropFilter: 'blur(3px)',
};
export const modalBox: React.CSSProperties = {
  background: C.surface, borderRadius: 12, padding: 28,
  width: '100%', maxWidth: 560,
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  border: `1px solid ${C.border}`,
  maxHeight: '90vh', overflowY: 'auto',
};

// ─── Table ───────────────────────────────────────────────────────────────────
export const tblHeader: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: C.textMuted,
  whiteSpace: 'nowrap', background: C.bg,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
export const tblCell: React.CSSProperties = {
  padding: '12px 16px', fontSize: 13, color: C.textPrimary,
};
export const tblRow: React.CSSProperties = {
  borderTop: `1px solid ${C.borderLight}`,
};

// ─── Status maps ─────────────────────────────────────────────────────────────
export const STATUS_HA: Record<string, { bg: string; color: string; label: string }> = {
  new:         { bg: '#EFF6FF', color: '#2563EB', label: 'Nou' },
  scheduled:   { bg: '#FFFBEB', color: '#B45309', label: 'Programat' },
  in_progress: { bg: '#EFF6FF', color: '#2563EB', label: 'În lucru' },
  done:        { bg: '#F0FDF4', color: '#16A34A', label: 'Finalizat' },
  cancelled:   { bg: '#F3F4F6', color: '#9CA3AF', label: 'Anulat' },
};
export const STATUS_SITE: Record<string, { bg: string; color: string; label: string }> = {
  active:   { bg: '#F0FDF4', color: '#16A34A', label: 'Activ' },
  paused:   { bg: '#FFFBEB', color: '#B45309', label: 'Pauzat' },
  finished: { bg: '#F3F4F6', color: '#6B7280', label: 'Finalizat' },
};
export const STATUS_INVOICE: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#F3F4F6', color: '#6B7280', label: 'Draft' },
  sent:      { bg: '#EFF6FF', color: '#2563EB', label: 'Trimisă' },
  paid:      { bg: '#F0FDF4', color: '#16A34A', label: 'Plătită' },
  overdue:   { bg: '#FEF2F2', color: '#DC2626', label: 'Restantă' },
  cancelled: { bg: '#F3F4F6', color: '#9CA3AF', label: 'Anulată' },
};
export const STATUS_ORDER: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FFFBEB', color: '#B45309', label: 'Pendinte' },
  approved:  { bg: '#EFF6FF', color: '#2563EB', label: 'Aprobat' },
  sent:      { bg: '#F0FDF4', color: '#16A34A', label: 'Trimis' },
  cancelled: { bg: '#F3F4F6', color: '#9CA3AF', label: 'Anulat' },
};
export const STATUS_REPORT: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#FFFBEB', color: '#B45309', label: 'Draft' },
  submitted: { bg: '#EFF6FF', color: '#2563EB', label: 'Trimis' },
  approved:  { bg: '#F0FDF4', color: '#16A34A', label: 'Aprobat' },
};

// ─── Notification styles ──────────────────────────────────────────────────────
export const NOTIF_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  equipment_service_due:     { icon: '🔧', color: '#B45309', bg: '#FFFBEB' },
  equipment_itp_due:         { icon: '📋', color: '#B45309', bg: '#FFFBEB' },
  invoice_overdue:           { icon: '⚠',  color: '#DC2626', bg: '#FEF2F2' },
  order_pending:             { icon: '📦', color: '#B45309', bg: '#FFFBEB' },
  report_missing:            { icon: '📝', color: '#DC2626', bg: '#FEF2F2' },
  report_missing_escalation: { icon: '🚨', color: '#DC2626', bg: '#FEF2F2' },
  ha_scheduled_today:        { icon: '🏠', color: '#2563EB', bg: '#EFF6FF' },
  budget_alert:              { icon: '📊', color: '#DC2626', bg: '#FEF2F2' },
  document_uploaded:         { icon: '📁', color: '#16A34A', bg: '#F0FDF4' },
};
