import { useEffect, useState } from 'react';
import { CreditCard, Layers, FileText, FolderKanban, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PageHeader } from '../components/layout/PageHeader';
import { api } from '../utils/api';
import { formatCurrency, formatRelative } from '../utils/format';
import type { DashboardStats, ActivityEvent, SuggestedSubscription, DetectedRecord } from '../types';

interface ChartData {
  data: Record<string, number | string>[];
  categories: string[];
}

interface DashboardSuggestions {
  suggestions: SuggestedSubscription[];
  detected: DetectedRecord[];
}

const CHART_COLORS = ['#6366f1', '#a78bfa', '#22c55e', '#3b82f6', '#f97316', '#eab308'];

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [suggestions, setSuggestions] = useState<DashboardSuggestions | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/dashboard/stats'),
      api.get<ActivityEvent[]>('/dashboard/activity'),
      api.get<ChartData>('/dashboard/chart'),
      api.get<DashboardSuggestions>('/dashboard/suggestions'),
    ]).then(([s, a, c, sg]) => {
      setStats(s);
      setActivity(a);
      setChart(c);
      setSuggestions(sg);
    }).catch(() => {});
  }, []);

  async function confirmSuggestion(id: number) {
    await api.post(`/finances/suggestions/${id}/confirm`);
    setSuggestions(prev => prev ? { ...prev, suggestions: prev.suggestions.filter(s => s.id !== id) } : null);
  }

  async function dismissSuggestion(id: number) {
    await api.post(`/finances/suggestions/${id}/dismiss`);
    setSuggestions(prev => prev ? { ...prev, suggestions: prev.suggestions.filter(s => s.id !== id) } : null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader title="Dashboard" />
      <div className="page-content">

        {/* Stat Cards */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <StatCard
            label="Monthly Subscriptions"
            value={stats ? formatCurrency(stats.monthly_subscription_cost) : '—'}
            icon={<CreditCard size={18} color="var(--primary)" />}
            trend="+2 this month"
          />
          <StatCard
            label="Active Subscriptions"
            value={stats?.active_subscriptions ?? '—'}
            icon={<Layers size={18} color="var(--green)" />}
          />
          <StatCard
            label="Open Invoices"
            value={stats?.open_invoices ?? '—'}
            icon={<FileText size={18} color="var(--yellow)" />}
            trend={stats && stats.open_invoices > 0 ? 'Requires attention' : 'All paid'}
          />
          <StatCard
            label="Active Projects"
            value={stats?.active_projects ?? '—'}
            icon={<FolderKanban size={18} color="var(--highlight)" />}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
          {/* Chart */}
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Monthly Spend by Category</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 6 months</span>
            </div>
            {chart && chart.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chart.data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text)' }}
                    formatter={(v: number) => [formatCurrency(v), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {chart.categories.map((cat, i) => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === chart.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <TrendingUp size={40} opacity={0.3} />
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Recent Activity</h3>
            <div className="activity-feed">
              {activity.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No recent activity</p>
              ) : (
                activity.slice(0, 12).map(event => (
                  <div key={event.id} className="activity-item">
                    <div className={`activity-dot activity-${event.action}`} />
                    <div>
                      <p className="activity-text">
                        <strong style={{ textTransform: 'capitalize' }}>{event.action}</strong>{' '}
                        <span style={{ color: 'var(--primary)' }}>{event.record_name}</span>{' '}
                        <span style={{ color: 'var(--text-muted)' }}>in {event.module}</span>
                      </p>
                      {event.details && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{event.details}</p>}
                      <p className="activity-time">{formatRelative(event.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Suggestions from bank */}
        {suggestions && suggestions.suggestions.length > 0 && (
          <div className="card" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
              Aus Bank erkannt
              <span className="pill pill-yellow" style={{ marginLeft: 10 }}>{suggestions.suggestions.length}</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestions.suggestions.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{s.sender_name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatCurrency(s.amount ?? 0)} / {s.billing_cycle} · Total: {formatCurrency(s.total_spent ?? 0)} · {s.transaction_count} transactions
                    </p>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => confirmSuggestion(s.id)}>Confirm</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => dismissSuggestion(s.id)}>Dismiss</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review Queue */}
        {suggestions && suggestions.detected.length > 0 && (
          <div className="card" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
              Email Review Queue
              <span className="pill pill-blue" style={{ marginLeft: 10 }}>{suggestions.detected.length}</span>
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Records detected from email. Review and confirm to add them.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestions.detected.map(r => (
                <div key={r.id} style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13 }}>{r.email_subject}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        From: {r.sender_name} · Amount: {r.amount ? formatCurrency(r.amount) : '?'} · Type: {r.type}
                      </p>
                    </div>
                    <span className="pill pill-blue">{r.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, trend }: { label: string; value: string | number; icon: React.ReactNode; trend?: string }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span className="stat-label">{label}</span>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      {trend && <div className="stat-trend">{trend}</div>}
    </div>
  );
}
