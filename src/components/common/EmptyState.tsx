import { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle: string;
  action?: ReactNode;
  icon?: ReactNode;
}

const DefaultIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="16" width="48" height="36" rx="6" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M20 28h24M20 36h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="48" cy="14" r="8" fill="var(--surface-3)" stroke="currentColor" strokeWidth="2"/>
    <path d="M48 11v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export function EmptyState({ title, subtitle, action, icon }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon ?? <DefaultIcon />}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-subtitle">{subtitle}</p>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
