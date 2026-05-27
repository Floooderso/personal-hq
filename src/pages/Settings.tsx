import { useState, useEffect } from 'react';
import { Shield, Database, RefreshCw, Trash2, Upload, Download, Lock, Tag } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../components/common/Toast';
import { Modal } from '../components/common/Modal';
import { api, exportData } from '../utils/api';
import { useUIStore } from '../store';
import { formatRelative } from '../utils/format';
import type { Tag as TagType } from '../types';

interface AppSettings { profile_name?: string; profile_address?: string; }
interface IntegrationSettings {
  bank_integration_enabled?: string; bank_blz?: string; bank_username?: string;
  bank_last_sync?: string; bank_last_sync_result?: string;
  imap_integration_enabled?: string; imap_host?: string; imap_port?: string;
  imap_tls?: string; imap_username?: string; imap_last_sync?: string; imap_last_sync_result?: string;
  n8n_integration_enabled?: string; n8n_url?: string; n8n_last_sync?: string;
}
interface LockStatus { unlocked: boolean; initialized: boolean; }

const TAG_COLORS = ['#6b6b68','#5c7a6b','#7c6b3a','#6b5c7a','#5c6b7a','#7a5c5c','#5c7a7a','#7a6b5c'];

export function Settings() {
  const { denseMode, setDenseMode } = useUIStore();
  const [profile, setProfile] = useState({ name: '', address: '' });
  const [integrations, setIntegrations] = useState<IntegrationSettings>({});
  const [lockStatus, setLockStatus] = useState<LockStatus>({ unlocked: false, initialized: false });
  const [masterPassword, setMasterPassword] = useState('');
  const [bankForm, setBankForm] = useState({ blz: '', username: '', pin: '' });
  const [imapForm, setImapForm] = useState({ host: '', port: '993', tls: true, username: '', password: '' });
  const [n8nForm, setN8nForm] = useState({ url: '', api_key: '' });
  const [clearConfirm, setClearConfirm] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [tags, setTags] = useState<TagType[]>([]);
  const [newTag, setNewTag] = useState({ name: '', color: TAG_COLORS[0] });
  const toast = useToast();

  useEffect(() => {
    api.get<AppSettings>('/settings').then(s => setProfile({ name: s.profile_name ?? '', address: s.profile_address ?? '' })).catch(() => {});
    api.get<IntegrationSettings>('/settings/integrations').then(setIntegrations).catch(() => {});
    api.get<LockStatus>('/settings/lock-status').then(setLockStatus).catch(() => {});
    api.get<TagType[]>('/tags').then(setTags).catch(() => {});
  }, []);

  async function saveProfile() {
    await api.put('/settings', { profile_name: profile.name, profile_address: profile.address });
    toast.success('Profile saved');
  }

  async function unlock() {
    try {
      const r = await api.post<{ success: boolean }>('/settings/unlock', { password: masterPassword });
      if (r.success) {
        setLockStatus({ unlocked: true, initialized: true });
        setMasterPassword('');
        toast.success(lockStatus.initialized ? 'Unlocked' : 'Master password set');
      }
    } catch (e) { toast.error((e as Error).message); }
  }

  async function saveBankIntegration() {
    await api.post('/settings/integrations/bank', { ...bankForm, enabled: true });
    setBankForm(f => ({ ...f, pin: '' }));
    toast.success('Bank integration saved');
    api.get<IntegrationSettings>('/settings/integrations').then(setIntegrations).catch(() => {});
  }

  async function saveImapIntegration() {
    await api.post('/settings/integrations/imap', { ...imapForm, enabled: true });
    setImapForm(f => ({ ...f, password: '' }));
    toast.success('IMAP integration saved');
    api.get<IntegrationSettings>('/settings/integrations').then(setIntegrations).catch(() => {});
  }

  async function saveN8nIntegration() {
    await api.post('/settings/integrations/n8n', { ...n8nForm, enabled: true });
    toast.success('n8n integration saved');
    api.get<IntegrationSettings>('/settings/integrations').then(setIntegrations).catch(() => {});
  }

  async function syncNow(type: string) {
    setSyncing(type);
    try {
      await api.post(`/sync/${type}`);
      toast.success(`${type} sync complete`);
    } catch (e) { toast.error((e as Error).message); }
    setSyncing(null);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      await api.post('/settings/import', JSON.parse(text));
      toast.success('Data imported successfully');
    } catch { toast.error('Invalid JSON file'); }
  }

  async function clearAllData() {
    if (clearConfirm !== 'DELETE ALL DATA') return;
    await api.delete('/settings/data');
    toast.success('All data cleared');
    setShowClearModal(false);
    setClearConfirm('');
  }

  async function addTag() {
    if (!newTag.name.trim()) return;
    try {
      const r = await api.post<TagType>('/tags', newTag);
      setTags(prev => [...prev, r]);
      setNewTag(t => ({ ...t, name: '' }));
    } catch { toast.error('Tag already exists'); }
  }

  async function deleteTag(id: number) {
    await api.delete(`/tags/${id}`);
    setTags(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader title="Settings" />
      <div className="page-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>

          {/* Profile */}
          <section className="card">
            <p className="section-label" style={{ marginBottom: 14 }}>Profile</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your Name" />
              </div>
              <div className="form-group">
                <label className="form-label">Address (used in Kündigung PDFs)</label>
                <textarea className="form-textarea" value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} placeholder={"Musterstraße 1\n12345 Berlin"} style={{ minHeight: 64 }} />
              </div>
              <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={saveProfile}>Save Profile</button>
            </div>
          </section>

          {/* Appearance */}
          <section className="card">
            <p className="section-label" style={{ marginBottom: 14 }}>Appearance</p>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontWeight: 500, fontSize: 13.5 }}>Dense Mode</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reduce row heights and padding for more information density</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={denseMode} onChange={e => setDenseMode(e.target.checked)} />
                <div className="toggle-track"><div className="toggle-thumb" /></div>
              </label>
            </div>
          </section>

          {/* Security */}
          <section className="card">
            <div className="flex items-center gap-8" style={{ marginBottom: 14 }}>
              <Shield size={15} color="var(--text-secondary)" />
              <p className="section-label">Master Password</p>
              {lockStatus.unlocked
                ? <span className="pill pill-green">Unlocked</span>
                : <span className="pill pill-gray">Locked</span>}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {lockStatus.initialized
                ? 'Enter your master password to unlock credential storage.'
                : 'Set a master password to encrypt your bank and email credentials.'}
            </p>
            <div className="flex gap-8">
              <input
                className="form-input"
                type="password"
                placeholder={lockStatus.initialized ? 'Master password' : 'Choose a master password'}
                value={masterPassword}
                onChange={e => setMasterPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') unlock(); }}
              />
              <button className="btn btn-primary btn-sm" onClick={unlock} style={{ whiteSpace: 'nowrap' }}>
                <Lock size={13} /> {lockStatus.initialized ? 'Unlock' : 'Set Password'}
              </button>
            </div>
          </section>

          {/* Bank Integration */}
          <IntegrationCard
            title="Bank Integration (FinTS/HBCI)"
            enabled={integrations.bank_integration_enabled === 'true'}
            lastSync={integrations.bank_last_sync}
            lastResult={integrations.bank_last_sync_result}
            onSync={() => syncNow('bank')}
            syncing={syncing === 'bank'}
            locked={!lockStatus.unlocked}
          >
            <div className="form-group">
              <label className="form-label">Bank BLZ (Bankleitzahl)</label>
              <input className="form-input" value={bankForm.blz} onChange={e => setBankForm(f => ({ ...f, blz: e.target.value }))} placeholder="12345678" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Online Banking Username</label>
                <input className="form-input" value={bankForm.username} onChange={e => setBankForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">PIN (encrypted)</label>
                <input className="form-input" type="password" value={bankForm.pin} onChange={e => setBankForm(f => ({ ...f, pin: e.target.value }))} placeholder="••••••" />
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveBankIntegration} disabled={!lockStatus.unlocked}>Save Bank Settings</button>
          </IntegrationCard>

          {/* IMAP Integration */}
          <IntegrationCard
            title="IMAP Email Integration"
            enabled={integrations.imap_integration_enabled === 'true'}
            lastSync={integrations.imap_last_sync}
            lastResult={integrations.imap_last_sync_result}
            onSync={() => syncNow('email')}
            syncing={syncing === 'email'}
            locked={!lockStatus.unlocked}
          >
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">IMAP Host</label>
                <input className="form-input" value={imapForm.host} onChange={e => setImapForm(f => ({ ...f, host: e.target.value }))} placeholder="imap.gmail.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Port</label>
                <input className="form-input" value={imapForm.port} onChange={e => setImapForm(f => ({ ...f, port: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={imapForm.username} onChange={e => setImapForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Password (encrypted)</label>
                <input className="form-input" type="password" value={imapForm.password} onChange={e => setImapForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
              </div>
            </div>
            <div className="flex items-center gap-8">
              <label className="toggle">
                <input type="checkbox" checked={imapForm.tls} onChange={e => setImapForm(f => ({ ...f, tls: e.target.checked }))} />
                <div className="toggle-track"><div className="toggle-thumb" /></div>
              </label>
              <span style={{ fontSize: 13 }}>Use TLS</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveImapIntegration} disabled={!lockStatus.unlocked}>Save IMAP Settings</button>
          </IntegrationCard>

          {/* n8n Integration */}
          <IntegrationCard
            title="n8n Automation Integration"
            enabled={integrations.n8n_integration_enabled === 'true'}
            lastSync={integrations.n8n_last_sync ?? null}
            lastResult={null}
            onSync={() => syncNow('all')}
            syncing={syncing === 'all'}
            locked={!lockStatus.unlocked}
          >
            <div className="form-group">
              <label className="form-label">n8n URL</label>
              <input className="form-input" value={n8nForm.url} onChange={e => setN8nForm(f => ({ ...f, url: e.target.value }))} placeholder="http://localhost:5678" />
            </div>
            <div className="form-group">
              <label className="form-label">API Key (encrypted)</label>
              <input className="form-input" type="password" value={n8nForm.api_key} onChange={e => setN8nForm(f => ({ ...f, api_key: e.target.value }))} placeholder="••••••••" />
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveN8nIntegration} disabled={!lockStatus.unlocked}>Save n8n Settings</button>
          </IntegrationCard>

          {/* Global Tags */}
          <section className="card">
            <div className="flex items-center gap-8" style={{ marginBottom: 14 }}>
              <Tag size={15} color="var(--text-secondary)" />
              <p className="section-label">Global Tags</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-4" style={{ background: tag.color + '18', border: `1px solid ${tag.color}40`, borderRadius: 100, padding: '3px 10px 3px 8px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: tag.color }} />
                  <span style={{ fontSize: 12, color: tag.color, fontWeight: 500 }}>{tag.name}</span>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '0 0 0 4px', lineHeight: 1 }} onClick={() => deleteTag(tag.id)}>×</button>
                </div>
              ))}
              {tags.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tags yet — they'll be created automatically when you use them in forms.</span>}
            </div>
            <div className="flex gap-8">
              <input className="form-input" style={{ flex: 1 }} placeholder="Tag name" value={newTag.name} onChange={e => setNewTag(t => ({ ...t, name: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addTag(); }} />
              <div style={{ display: 'flex', gap: 4 }}>
                {TAG_COLORS.map(c => (
                  <button key={c} onClick={() => setNewTag(t => ({ ...t, color: c }))} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: newTag.color === c ? `2px solid var(--text)` : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={addTag}>Add</button>
            </div>
          </section>

          {/* Data Management */}
          <section className="card">
            <div className="flex items-center gap-8" style={{ marginBottom: 14 }}>
              <Database size={15} color="var(--text-secondary)" />
              <p className="section-label">Data Management</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontWeight: 500, fontSize: 13.5 }}>Export All Data</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Download all your data as JSON</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={exportData}><Download size={12} /> Export</button>
              </div>
              <hr className="divider" />
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontWeight: 500, fontSize: 13.5 }}>Import Data</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Restore from a JSON export file</p>
                </div>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  <Upload size={12} /> Import
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
                </label>
              </div>
              <hr className="divider" />
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontWeight: 500, fontSize: 13.5, color: 'var(--danger)' }}>Clear All Data</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Permanently delete all records. Cannot be undone.</p>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => setShowClearModal(true)}><Trash2 size={12} /> Clear All</button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal title="Clear All Data" open={showClearModal} onClose={() => setShowClearModal(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowClearModal(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={clearAllData} disabled={clearConfirm !== 'DELETE ALL DATA'}>Delete Everything</button>
        </>}
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          This will permanently delete ALL your data including subscriptions, services, projects, and more. This cannot be undone.
        </p>
        <div className="form-group">
          <label className="form-label">Type <strong>DELETE ALL DATA</strong> to confirm</label>
          <input className="form-input" value={clearConfirm} onChange={e => setClearConfirm(e.target.value)} placeholder="DELETE ALL DATA" />
        </div>
      </Modal>
    </div>
  );
}

function IntegrationCard({ title, enabled, lastSync, lastResult, onSync, syncing, locked, children }: {
  title: string; enabled: boolean; lastSync?: string | null; lastResult?: string | null;
  onSync: () => void; syncing: boolean; locked: boolean; children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div className="flex items-center gap-8">
          <p className="section-label">{title}</p>
          {enabled ? <span className="pill pill-green">Enabled</span> : <span className="pill pill-gray">Disabled</span>}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onSync} disabled={syncing || locked || !enabled}>
          <RefreshCw size={12} className={syncing ? 'spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>
      {lastSync && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Last sync: {formatRelative(lastSync)}
          {lastResult && <span style={{ marginLeft: 8, color: lastResult.startsWith('error') ? 'var(--danger)' : 'var(--success)' }}>{lastResult}</span>}
        </p>
      )}
      {locked && (
        <div className="flex items-center gap-6" style={{ padding: '8px 12px', background: 'var(--warning-bg)', borderRadius: 6, marginBottom: 12, fontSize: 12, color: 'var(--warning)' }}>
          <Lock size={12} /> Unlock with master password to edit credentials
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </section>
  );
}
