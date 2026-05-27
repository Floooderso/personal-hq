import { useState, useEffect } from 'react';
import { X, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useUIStore } from '../../store';
import { api } from '../../utils/api';
import { formatRelative } from '../../utils/format';
import { useToast } from './Toast';

interface SyncStatus {
  [key: string]: string | null;
}

interface SyncLog {
  id: number;
  integration: string;
  status: string;
  records_synced: number;
  error_message: string | null;
  synced_at: string;
}

interface SyncData {
  logs: SyncLog[];
  status: SyncStatus;
}

const INTEGRATIONS = [
  { key: 'bank', label: 'Bank (FinTS/HBCI)', enabledKey: 'bank_integration_enabled' },
  { key: 'email', label: 'IMAP Email', enabledKey: 'imap_integration_enabled' },
];

export function SyncCenter() {
  const { syncCenterOpen, setSyncCenterOpen } = useUIStore();
  const [syncData, setSyncData] = useState<SyncData | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const toast = useToast();

  useEffect(() => {
    if (!syncCenterOpen) return;
    api.get<SyncData>('/sync/status').then(setSyncData).catch(() => {});
    api.get<Record<string, string>>('/settings').then(setSettings).catch(() => {});
  }, [syncCenterOpen]);

  async function syncOne(type: string) {
    setSyncing(type);
    try {
      await api.post(`/sync/${type}`);
      toast.success(`${type} sync complete`);
      api.get<SyncData>('/sync/status').then(setSyncData).catch(() => {});
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSyncing(null);
  }

  async function syncAll() {
    setSyncing('all');
    try {
      await api.post('/sync/all');
      toast.success('All syncs complete');
      api.get<SyncData>('/sync/status').then(setSyncData).catch(() => {});
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSyncing(null);
  }

  if (!syncCenterOpen) return null;

  return (
    <>
      <div className="slideover-backdrop" onClick={() => setSyncCenterOpen(false)} />
      <div className="slideover-panel" style={{ width: 380 }}>
        <div className="slideover-header">
          <div className="flex items-center gap-8">
            <RefreshCw size={18} />
            <span className="slideover-title">Sync Center</span>
          </div>
          <div className="flex gap-8">
            <button
              className="btn btn-primary btn-sm"
              onClick={syncAll}
              disabled={syncing !== null}
            >
              <RefreshCw size={13} style={{ animation: syncing === 'all' ? 'spin 1s linear infinite' : 'none' }} />
              Sync All
            </button>
            <button className="btn btn-ghost btn-icon" onClick={() => setSyncCenterOpen(false)}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="slideover-body" style={{ gap: 0, padding: 0 }}>
          {/* Integration status */}
          {INTEGRATIONS.map(({ key, label, enabledKey }) => {
            const isEnabled = settings[enabledKey] === 'true';
            const lastSync = syncData?.status[`${key}_last_sync`];
            const lastResult = syncData?.status[`${key}_last_sync_result`];
            const isError = lastResult?.startsWith('error');
            const isSyncing = syncing === key;

            return (
              <div
                key={key}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-8" style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
                    {isEnabled
                      ? <span className="pill pill-green" style={{ fontSize: 10 }}>enabled</span>
                      : <span className="pill pill-gray" style={{ fontSize: 10 }}>disabled</span>
                    }
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {lastSync ? (
                      <>
                        <Clock size={11} />
                        {formatRelative(lastSync)}
                      </>
                    ) : (
                      <span>Never synced</span>
                    )}
                    {lastResult && (
                      <span style={{ color: isError ? 'var(--red)' : 'var(--green)' }}>
                        · {isError ? lastResult.replace('error: ', '') : lastResult}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {lastResult && (
                    isError
                      ? <XCircle size={15} color="var(--red)" />
                      : <CheckCircle size={15} color="var(--green)" />
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => syncOne(key)}
                    disabled={!isEnabled || syncing !== null}
                  >
                    <RefreshCw
                      size={12}
                      style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}
                    />
                    {isSyncing ? 'Syncing…' : 'Sync'}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Recent sync log */}
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Recent Activity
            </p>
            {!syncData || syncData.logs.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No sync history yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {syncData.logs.slice(0, 10).map(log => (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {log.status === 'success'
                      ? <CheckCircle size={13} color="var(--green)" style={{ marginTop: 2, flexShrink: 0 }} />
                      : <XCircle size={13} color="var(--red)" style={{ marginTop: 2, flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, color: 'var(--text)' }}>
                        <strong>{log.integration}</strong>
                        {log.status === 'success'
                          ? ` · ${log.records_synced} records`
                          : ` · ${log.error_message ?? 'error'}`
                        }
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                        {formatRelative(log.synced_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
