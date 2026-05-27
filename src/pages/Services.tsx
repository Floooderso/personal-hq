import { useEffect, useState, useCallback } from 'react';
import { Plus, ExternalLink, RefreshCw, X, Activity } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../components/common/Toast';
import { TagInput } from '../components/common/TagInput';
import { api } from '../utils/api';
import { formatRelative } from '../utils/format';
import type { Service, ServiceCheck } from '../types';

const CATEGORIES = ['Media', 'Storage', 'Monitoring', 'Security', 'Productivity', 'Infrastructure', 'Other'];

function StatusDot({ status }: { status: string }) {
  const cls = status === 'up' ? 'service-status-up' : status === 'down' ? 'service-status-down' : 'service-status-unknown';
  return <span className={`service-status-dot ${cls}`} />;
}

function Sparkline({ checks }: { checks: ServiceCheck[] }) {
  const w = 144, h = 18;
  if (checks.length === 0) return <svg width={w} height={h} className="service-sparkline"><rect x={0} y={0} width={w} height={h} fill="var(--border)" rx={2} /></svg>;
  const segW = w / 288;
  const padded: (ServiceCheck | null)[] = Array(288).fill(null);
  checks.slice(-288).forEach((c, i) => { padded[i + Math.max(0, 288 - checks.length)] = c; });
  return (
    <svg width={w} height={h} className="service-sparkline" style={{ borderRadius: 2, overflow: 'hidden' }}>
      <rect x={0} y={0} width={w} height={h} fill="var(--bg)" />
      {padded.map((c, i) => (
        <rect
          key={i}
          x={i * segW}
          y={0}
          width={Math.max(segW - 0.5, 0.5)}
          height={h}
          fill={c === null ? 'var(--border)' : c.success ? 'var(--success)' : 'var(--danger)'}
          opacity={c === null ? 0.4 : 0.8}
        />
      ))}
    </svg>
  );
}

function uptime(checks: ServiceCheck[]): string {
  if (checks.length === 0) return '—';
  const pct = (checks.filter(c => c.success).length / checks.length) * 100;
  return pct.toFixed(1) + '%';
}

const EMPTY_FORM = { name: '', internal_url: '', external_url: '', hosting_location: '', server_name: '', category: 'Other', version: '', notes: '', tags: [] as string[] };

export function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [checks, setChecks] = useState<Record<number, ServiceCheck[]>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [checking, setChecking] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const load = useCallback(() => {
    api.get<Service[]>('/services').then(setServices).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('new') === '1') openCreate();
  }, [searchParams]);

  async function loadChecks(id: number) {
    try {
      const c = await api.get<ServiceCheck[]>(`/services/${id}/checks`);
      setChecks(prev => ({ ...prev, [id]: c }));
    } catch {}
  }

  useEffect(() => {
    services.forEach(s => loadChecks(s.id));
  }, [services]);

  function openCreate() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setFormMode('create');
  }

  function openEdit(s: Service) {
    setSelectedId(s.id);
    setForm({ name: s.name, internal_url: s.internal_url ?? '', external_url: s.external_url ?? '', hosting_location: s.hosting_location ?? '', server_name: s.server_name ?? '', category: s.category, version: s.version ?? '', notes: s.notes ?? '', tags: s.tags });
    setFormMode('edit');
  }

  function closePanel() { setFormMode(null); setSelectedId(null); }

  async function handleSave() {
    try {
      if (formMode === 'create') {
        await api.post('/services', form);
        toast.success('Service added');
      } else if (selectedId) {
        await api.put(`/services/${selectedId}`, form);
        toast.success('Service updated');
      }
      load();
      closePanel();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this service?')) return;
    await api.delete(`/services/${id}`);
    toast.success('Deleted');
    load();
    if (selectedId === id) closePanel();
  }

  async function handleCheck(id: number) {
    setChecking(id);
    try {
      await api.post(`/services/${id}/check`, {});
      load();
      loadChecks(id);
      toast.success('Check complete');
    } catch { toast.error('Check failed'); }
    setChecking(null);
  }

  async function openUrl(url: string | null) {
    if (!url) return;
    try { await api.post('/open-url', { url }); } catch { toast.error('Could not open URL'); }
  }

  const allChecks = Object.values(checks).flat();
  const totalUp = services.filter(s => s.status === 'up').length;

  const panelOpen = formMode !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Services"
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /></button>
            <button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={14} /> New Service</button>
          </>
        }
      />

      {panelOpen ? (
        <div className="split-layout">
          {/* Left: list */}
          <div className="split-left">
            <UptimeSummary total={services.length} up={totalUp} allChecks={allChecks} />
            <ServiceTable services={services} checks={checks} selectedId={selectedId} onSelect={openEdit} onCheck={handleCheck} onOpen={openUrl} onDelete={handleDelete} checking={checking} />
          </div>
          <div className="split-divider" />
          {/* Right: form */}
          <div className="split-right">
            <div className="split-right-header">
              <span className="split-right-title">{formMode === 'create' ? 'New Service' : 'Edit Service'}</span>
              <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <ServiceForm form={form} setForm={setForm} onSave={handleSave} onCancel={closePanel} />
          </div>
        </div>
      ) : (
        <div className="page-content">
          <UptimeSummary total={services.length} up={totalUp} allChecks={allChecks} />
          {services.length === 0
            ? <EmptyState title="No services yet" subtitle="Add your first self-hosted service to start tracking uptime." action={<button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={13} /> New Service</button>} />
            : <ServiceTable services={services} checks={checks} selectedId={selectedId} onSelect={openEdit} onCheck={handleCheck} onOpen={openUrl} onDelete={handleDelete} checking={checking} />
          }
        </div>
      )}
    </div>
  );
}

function UptimeSummary({ total, up, allChecks }: { total: number; up: number; allChecks: ServiceCheck[] }) {
  if (total === 0) return null;
  const pct = allChecks.length ? ((allChecks.filter(c => c.success).length / allChecks.length) * 100).toFixed(1) : '—';
  return (
    <div className="uptime-summary">
      <div className="uptime-summary-item">
        <span className="uptime-summary-label">Services</span>
        <span className="uptime-summary-value">{total}</span>
      </div>
      <div className="uptime-summary-item">
        <span className="uptime-summary-label">Online</span>
        <span className="uptime-summary-value" style={{ color: up === total ? 'var(--success)' : up === 0 ? 'var(--danger)' : 'var(--warning)' }}>{up} / {total}</span>
      </div>
      <div className="uptime-summary-item">
        <span className="uptime-summary-label">24h Uptime</span>
        <span className="uptime-summary-value">{pct}{typeof pct === 'string' && pct !== '—' ? '%' : ''}</span>
      </div>
    </div>
  );
}

interface TableProps {
  services: Service[];
  checks: Record<number, ServiceCheck[]>;
  selectedId: number | null;
  onSelect: (s: Service) => void;
  onCheck: (id: number) => void;
  onOpen: (url: string | null) => void;
  onDelete: (id: number) => void;
  checking: number | null;
}

function ServiceTable({ services, checks, selectedId, onSelect, onCheck, onOpen, onDelete, checking }: TableProps) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style={{ width: 12 }}></th>
            <th>Name</th>
            <th>Category</th>
            <th>Location</th>
            <th>Latency</th>
            <th>24h Uptime</th>
            <th>Last Checked</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {services.map(s => (
            <tr key={s.id} className={selectedId === s.id ? 'selected' : ''} onClick={() => onSelect(s)} style={{ cursor: 'pointer' }}>
              <td style={{ paddingRight: 0 }}><StatusDot status={s.status} /></td>
              <td>
                <div style={{ fontWeight: 500 }}>{s.name}</div>
                {s.internal_url && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{s.internal_url}</div>}
              </td>
              <td><span className="tag">{s.category}</span></td>
              <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{s.hosting_location || '—'}</td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
                {s.last_latency_ms != null ? `${s.last_latency_ms}ms` : '—'}
              </td>
              <td>
                {checks[s.id] ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkline checks={checks[s.id]} />
                    <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: 40 }}>
                      {uptime(checks[s.id])}
                    </span>
                  </div>
                ) : '—'}
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {s.last_checked ? formatRelative(s.last_checked) : 'Never'}
              </td>
              <td onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => onCheck(s.id)} title="Check now" disabled={checking === s.id}>
                    <Activity size={12} className={checking === s.id ? 'spin' : ''} />
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => onOpen(s.internal_url || s.external_url)} title="Open URL">
                    <ExternalLink size={12} />
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(s.id)}>×</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface FormProps {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  onSave: () => void;
  onCancel: () => void;
}

function ServiceForm({ form, setForm, onSave, onCancel }: FormProps) {
  function f(key: keyof typeof EMPTY_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  return (
    <>
      <div className="form-group">
        <label className="form-label">Name *</label>
        <input className="form-input" value={form.name} onChange={f('name')} placeholder="Nextcloud" autoFocus />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Internal URL</label>
          <input className="form-input" value={form.internal_url} onChange={f('internal_url')} placeholder="https://nextcloud.home.arpa" />
        </div>
        <div className="form-group">
          <label className="form-label">External URL</label>
          <input className="form-input" value={form.external_url} onChange={f('external_url')} placeholder="https://cloud.example.com" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-select" value={form.category} onChange={f('category')}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Version</label>
          <input className="form-input" value={form.version} onChange={f('version')} placeholder="28.0.1" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Hosting Location</label>
          <input className="form-input" value={form.hosting_location} onChange={f('hosting_location')} placeholder="Hetzner VPS / Homelab" />
        </div>
        <div className="form-group">
          <label className="form-label">Server / Machine</label>
          <input className="form-input" value={form.server_name} onChange={f('server_name')} placeholder="pi4-main" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Tags</label>
        <TagInput value={form.tags} onChange={tags => setForm(prev => ({ ...prev, tags }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" value={form.notes} onChange={f('notes')} placeholder="Admin URL, credentials, …" rows={3} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave}>Save</button>
      </div>
    </>
  );
}
