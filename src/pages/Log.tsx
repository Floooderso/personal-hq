import { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { api } from '../utils/api';
import type { ActivityEvent, ActivityDiff } from '../types';
import { formatRelative } from '../utils/format';

interface LogResponse {
  items: (ActivityEvent & { diffs: ActivityDiff[] | null })[];
  total: number;
  limit: number;
  offset: number;
}

const MODULE_LABELS: Record<string, string> = {
  subscriptions: 'Subscriptions',
  services: 'Services',
  projects: 'Projects',
  social: 'Social Media',
  automations: 'Automations',
  finances: 'Finances',
  settings: 'Settings',
};

const ALL_MODULES = ['', 'subscriptions', 'services', 'projects', 'social', 'automations', 'finances'];

export function Log() {
  const [data, setData] = useState<LogResponse | null>(null);
  const [moduleFilter, setModuleFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (moduleFilter) params.set('module', moduleFilter);
    api.get<LogResponse>(`/log?${params}`).then(setData).catch(() => {});
  }, [moduleFilter, offset]);

  useEffect(() => { load(); }, [load]);

  function actionLabel(action: string) {
    if (action === 'create') return 'Created';
    if (action === 'update') return 'Updated';
    if (action === 'delete') return 'Deleted';
    return action;
  }

  if (!data) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Activity Log" />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Activity Log"
        actions={<button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /></button>}
      />
      <div className="page-content">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
          <span className="section-label" style={{ marginRight: 4 }}>Module</span>
          {ALL_MODULES.map(m => (
            <button
              key={m || 'all'}
              className={`btn btn-sm${moduleFilter === m ? ' btn-primary' : ' btn-secondary'}`}
              onClick={() => { setModuleFilter(m); setOffset(0); }}
            >
              {m ? (MODULE_LABELS[m] ?? m) : 'All'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12.5, fontFamily: 'var(--font-mono)' }}>
            {data.total} events
          </span>
        </div>

        {data.items.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No activity yet</div>
        ) : (
          <div>
            {data.items.map(item => (
              <div key={item.id} className="log-item">
                <span className={`log-dot log-${item.action}`} />
                <div className="log-content">
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span className="log-name">{item.record_name || `Record #${item.record_id}`}</span>
                    <span className="log-module">{MODULE_LABELS[item.module] ?? item.module}</span>
                    <span style={{ fontSize: 12, color: item.action === 'create' ? 'var(--success)' : item.action === 'delete' ? 'var(--danger)' : '#2c5282', fontWeight: 500 }}>
                      {actionLabel(item.action)}
                    </span>
                  </div>
                  {item.diffs && item.diffs.length > 0 && (
                    <div className="log-diff">
                      {item.diffs.map((d, i) => (
                        <div key={i} className="log-diff-row">
                          <span className="log-diff-field">{d.field}</span>
                          <span className="log-diff-old">{d.old || '—'}</span>
                          <span className="log-diff-arrow">→</span>
                          <span className="log-diff-new">{d.new || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!item.diffs && item.details && (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>{item.details}</div>
                  )}
                  <div className="log-time">{formatRelative(item.created_at)}</div>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {data.total > limit && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingTop: 24 }}>
                <button className="btn btn-secondary btn-sm" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}>← Newer</button>
                <span style={{ padding: '5px 12px', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {offset + 1}–{Math.min(offset + limit, data.total)} of {data.total}
                </span>
                <button className="btn btn-secondary btn-sm" disabled={offset + limit >= data.total} onClick={() => setOffset(o => o + limit)}>Older →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
