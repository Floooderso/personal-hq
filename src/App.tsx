import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Subscriptions } from './pages/Subscriptions';
import { Services } from './pages/Services';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Social } from './pages/Social';
import { Automations } from './pages/Automations';
import { Finances } from './pages/Finances';
import { Settings } from './pages/Settings';
import { Log } from './pages/Log';
import { useUIStore } from './store';
import { useKeyCombo } from './hooks/useKeyboard';
import { useKeyboard } from './hooks/useKeyboard';
import { api } from './utils/api';
import type { ServerHealth } from './types';
import './styles/global.css';

function HealthError({ health }: { health: ServerHealth }) {
  return (
    <div className="health-error-screen">
      <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth={1.5}><circle cx={12} cy={12} r={10} /><line x1={12} y1={8} x2={12} y2={12} /><line x1={12} y1={16} x2={12.01} y2={16} /></svg>
      <h1 className="health-error-title">Database Error</h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 480 }}>
        Personal HQ encountered a problem on startup. The database may be corrupted or missing tables.
      </p>
      <pre className="health-error-detail">
        {health.error ? health.error + '\n' : ''}
        {(health.missing_tables ?? []).length > 0 ? 'Missing tables: ' + health.missing_tables.join(', ') : ''}
      </pre>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );
}

export function App() {
  const { setCommandPaletteOpen, toggleQuickNotes } = useUIStore();
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [healthChecked, setHealthChecked] = useState(false);

  useEffect(() => {
    api.get<ServerHealth>('/health')
      .then(h => { setHealth(h); setHealthChecked(true); })
      .catch(() => setHealthChecked(true));
  }, []);

  useKeyCombo('k', true, () => setCommandPaletteOpen(true), [setCommandPaletteOpen]);

  useKeyboard('N', (e) => {
    // Shift+N = quick notes
    if (e.shiftKey) { toggleQuickNotes(); }
    else { setCommandPaletteOpen(true); }
  }, [toggleQuickNotes, setCommandPaletteOpen]);

  if (!healthChecked) return null;
  // Only show error if the server explicitly reports db_ok: false (not just missing the field)
  if (health && health.db_ok === false) return <HealthError health={health} />;

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="services" element={<Services />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="social" element={<Social />} />
          <Route path="automations" element={<Automations />} />
          <Route path="finances" element={<Finances />} />
          <Route path="settings" element={<Settings />} />
          <Route path="log" element={<Log />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
