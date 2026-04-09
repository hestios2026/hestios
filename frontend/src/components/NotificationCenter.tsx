import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead } from '../api/notifications';
import { NOTIF_STYLE } from '../styles/ds';

interface Notif {
  id: number;
  type: string;
  title: string;
  body: string;
  target_page: string | null;
  priority: string;
  is_read: boolean;
  sent_at: string;
}

interface Props {
  onNavigate: (page: string) => void;
}

export function NotificationCenter({ onNavigate }: Props) {
  const { t } = useTranslation();
  const [open, setOpen]             = useState(false);
  const [notifs, setNotifs]         = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  function loadCount() {
    fetchUnreadCount().then(d => setUnreadCount(d.count)).catch(() => {});
  }

  function openPanel() {
    if (!open) {
      fetchNotifications({ limit: 50 }).then(setNotifs).catch(() => {});
    }
    setOpen(v => !v);
  }

  async function handleClick(n: Notif) {
    if (!n.is_read) {
      await markNotificationRead(n.id).catch(() => {});
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setUnreadCount(c => Math.max(0, c - 1));
    }
    if (n.target_page) {
      onNavigate(n.target_page);
      setOpen(false);
    }
  }

  async function markAll() {
    await markAllNotificationsRead().catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return t('notifications.now');
    if (min < 60) return t('notifications.minutesAgo', { count: min });
    const h = Math.floor(min / 60);
    if (h < 24) return t('notifications.hoursAgo', { count: h });
    return t('notifications.daysAgo', { count: Math.floor(h / 24) });
  }

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      {/* Bell button */}
      <button
        onClick={openPanel}
        style={{
          position: 'relative', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 18, padding: '4px 8px',
          borderRadius: 8, color: open ? '#22C55E' : 'rgba(255,255,255,0.35)',
          transition: 'color 150ms ease',
        }}
        title={t('notifications.tooltip')}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            minWidth: 16, height: 16, borderRadius: 8,
            background: '#dc2626', color: '#fff',
            fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 44, width: 360,
          maxHeight: 480, zIndex: 100,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '11px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              {unreadCount > 0 ? t('notifications.titleWithCount', { count: unreadCount }) : t('notifications.title')}
            </span>
            {unreadCount > 0 && (
              <button onClick={markAll} style={{
                background: 'none', border: 'none', color: 'var(--text-2)',
                fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifs.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                {t('notifications.noNotifications')}
              </div>
            )}
            {notifs.map(n => {
              const style = NOTIF_STYLE[n.type] || { icon: '📌', color: '#64748b', bg: 'var(--surface-3)' };
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: 'flex', gap: 12, padding: '11px 14px',
                    background: n.is_read ? 'transparent' : 'rgba(255,255,255,0.02)',
                    borderLeft: `2px solid ${n.is_read ? 'transparent' : style.color}`,
                    borderBottom: '1px solid var(--border-light)',
                    cursor: n.target_page ? 'pointer' : 'default',
                    transition: 'background 120ms ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(255,255,255,0.02)')}
                >
                  <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1.2 }}>{style.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12.5, fontWeight: n.is_read ? 500 : 700,
                      color: 'var(--text)', lineHeight: 1.3,
                    }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>
                      {n.body}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      {relativeTime(n.sent_at)}
                    </div>
                  </div>
                  {!n.is_read && (
                    <div style={{
                      width: 7, height: 7, borderRadius: 4,
                      background: '#22C55E', flexShrink: 0, marginTop: 5,
                      boxShadow: '0 0 6px rgba(34,197,94,0.5)',
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
