import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CreditCard, Server, FolderKanban,
  Share2, Zap, Receipt, Settings, Bell, RefreshCw, BookOpen,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUIStore } from '../../store';
import { api } from '../../utils/api';

const NAV_TOP = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, exact: true },
  { label: 'Activity Log', to: '/log', icon: BookOpen, exact: false },
];

const NAV_MANAGE = [
  { label: 'Subscriptions', to: '/subscriptions', icon: CreditCard },
  { label: 'Services', to: '/services', icon: Server },
  { label: 'Projects', to: '/projects', icon: FolderKanban },
  { label: 'Social Media', to: '/social', icon: Share2 },
];

const NAV_TRACK = [
  { label: 'Automations', to: '/automations', icon: Zap },
  { label: 'Finances', to: '/finances', icon: Receipt },
];

export function Sidebar() {
  const { setNotificationPanelOpen, setSyncCenterOpen } = useUIStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileName, setProfileName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ count: number }>('/notifications/unread-count').then(r => setUnreadCount(r.count)).catch(() => {});
    api.get<{ profile_name?: string }>('/settings').then(s => setProfileName(s.profile_name ?? '')).catch(() => {});
    const iv = setInterval(() => {
      api.get<{ count: number }>('/notifications/unread-count').then(r => setUnreadCount(r.count)).catch(() => {});
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  const initials = profileName
    ? profileName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'HQ';

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">HQ</div>
        <span className="sidebar-logo-text">Personal HQ</span>
      </div>

      <div className="sidebar-nav">
        <div className="sidebar-section">
          {NAV_TOP.map(({ label, to, icon: Icon, exact }) => (
            <NavLink key={to} to={to} end={exact} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon size={15} />
              <span className="sidebar-link-text">{label}</span>
            </NavLink>
          ))}
          <button
            className="sidebar-link"
            onClick={() => setNotificationPanelOpen(true)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Bell size={15} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -8,
                  minWidth: 14, height: 14, background: 'var(--danger)',
                  color: 'white', borderRadius: 100, fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className="sidebar-link-text">Notifications</span>
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Manage</div>
          {NAV_MANAGE.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon size={15} />
              <span className="sidebar-link-text">{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Track</div>
          {NAV_TRACK.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon size={15} />
              <span className="sidebar-link-text">{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-section">
          <button
            className="sidebar-link"
            onClick={() => setSyncCenterOpen(true)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
          >
            <RefreshCw size={15} />
            <span className="sidebar-link-text">Sync Center</span>
          </button>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-avatar" onClick={() => navigate('/settings')} title="Go to Settings">
          {initials}
        </div>
        <div className="sidebar-footer-info">
          <div className="sidebar-footer-name">{profileName || 'Personal HQ'}</div>
          <div className="sidebar-footer-version">v1.0.0</div>
        </div>
        <button
          onClick={() => navigate('/settings')}
          title="Settings"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
        >
          <Settings size={14} />
        </button>
      </div>
    </nav>
  );
}
