import { useEffect, useState } from 'react';
import { Bell, X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store';
import { api } from '../../utils/api';
import type { AppNotification } from '../../types';
import { formatRelative } from '../../utils/format';

const MODULE_ROUTES: Record<string, string> = {
  subscriptions: '/subscriptions',
  invoices: '/finances',
  automations: '/automations',
  finances: '/finances',
};

export function NotificationPanel() {
  const { notificationPanelOpen, setNotificationPanelOpen } = useUIStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (notificationPanelOpen) {
      api.get<AppNotification[]>('/notifications').then(setNotifications).catch(() => {});
    }
  }, [notificationPanelOpen]);

  async function markRead(id: number) {
    await api.put(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    await api.put('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function handleClick(n: AppNotification) {
    markRead(n.id);
    if (n.related_module && MODULE_ROUTES[n.related_module]) {
      navigate(MODULE_ROUTES[n.related_module]);
    }
    setNotificationPanelOpen(false);
  }

  if (!notificationPanelOpen) return null;

  const unread = notifications.filter(n => !n.read);

  return (
    <>
      <div className="slideover-backdrop" onClick={() => setNotificationPanelOpen(false)} />
      <div className="slideover-panel" style={{ width: 360 }}>
        <div className="slideover-header">
          <div className="flex items-center gap-8">
            <Bell size={18} />
            <span className="slideover-title">Notifications</span>
            {unread.length > 0 && (
              <span className="pill pill-red">{unread.length}</span>
            )}
          </div>
          <div className="flex items-center gap-8">
            {unread.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={() => setNotificationPanelOpen(false)}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="slideover-body" style={{ padding: 0 }}>
          {notifications.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bell size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p>All caught up!</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: n.read ? 'transparent' : 'var(--primary-dim)',
                  transition: 'background var(--transition)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'var(--primary-dim)')}
              >
                {!n.read && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', marginTop: 5, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, marginLeft: n.read ? 20 : 0 }}>
                  <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{n.message}</p>
                  <p className="activity-time">{formatRelative(n.created_at)}</p>
                </div>
                {n.related_module && <ExternalLink size={13} color="var(--text-faint)" style={{ marginTop: 3 }} />}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
