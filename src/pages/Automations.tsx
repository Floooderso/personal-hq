import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Play, Trash2, Terminal } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusPill } from '../components/common/StatusPill';
import { SlideOver } from '../components/common/SlideOver';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../components/common/Toast';
import { api } from '../utils/api';
import { formatRelative } from '../utils/format';
import type { Automation } from '../types';
import { useKeyboard } from '../hooks/useKeyboard';

const TOOLS = ['n8n', 'make', 'zapier', 'custom'] as const;

const defaultForm = {
  name: '', description: '', tool: 'custom' as Automation['tool'],
  webhook_url: '', workflow_id: '', script_body: '', status: 'active',
};

export function Automations() {
  const [data, setData] = useState<Automation[]>([]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Automation | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logModal, setLogModal] = useState<{ auto: Automation; lines: string[]; done: boolean } | null>(null);
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const load = useCallback(() => {
    api.get<Automation[]>('/automations').then(setData).catch(() => toast.error('Failed to load'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (searchParams.get('action') === 'new-automation') openNew(); }, [searchParams]);
  useKeyboard('n', () => { if (!slideOpen) openNew(); }, [slideOpen]);

  function openNew() {
    setEditRecord(null);
    setForm(defaultForm);
    setErrors({});
    setSlideOpen(true);
  }

  function openEdit(auto: Automation) {
    setEditRecord(auto);
    setForm({ name: auto.name, description: auto.description ?? '', tool: auto.tool, webhook_url: auto.webhook_url ?? '', workflow_id: auto.workflow_id ?? '', script_body: auto.script_body ?? '', status: auto.status });
    setErrors({});
    setSlideOpen(true);
  }

  async function save() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      if (editRecord) { await api.put(`/automations/${editRecord.id}`, form); toast.success('Updated'); }
      else { await api.post('/automations', form); toast.success('Created'); }
      setSlideOpen(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function deleteAuto(auto: Automation) {
    if (!confirm(`Delete "${auto.name}"?`)) return;
    await api.delete(`/automations/${auto.id}`);
    toast.success('Deleted');
    setSlideOpen(false);
    load();
  }

  async function toggleStatus(auto: Automation) {
    const newStatus = auto.status === 'active' ? 'paused' : 'active';
    await api.put(`/automations/${auto.id}`, { status: newStatus });
    load();
  }

  function triggerAutomation(auto: Automation) {
    if (auto.tool === 'custom') {
      setLogModal({ auto, lines: [], done: false });
      const es = new EventSource(`/api/automations/${auto.id}/trigger`);
      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.line) setLogModal(prev => prev ? { ...prev, lines: [...prev.lines, data.line] } : null);
        if (data.done) {
          setLogModal(prev => prev ? { ...prev, done: true } : null);
          es.close();
          load();
          toast[data.success ? 'success' : 'error'](`Automation ${data.success ? 'succeeded' : 'failed'}`);
        }
      };
      es.onerror = () => { setLogModal(prev => prev ? { ...prev, done: true } : null); es.close(); };
    } else {
      api.post<{ success: boolean }>(`/automations/${auto.id}/trigger`)
        .then(r => { toast[r.success ? 'success' : 'error'](`Trigger ${r.success ? 'sent' : 'failed'}`); load(); })
        .catch(e => toast.error((e as Error).message));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader title="Automations" actions={
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New Automation</button>
      } />
      <div className="page-content">
        {data.length === 0 ? (
          <EmptyState title="No automations" subtitle="Connect n8n, Make, Zapier or run custom scripts." action={<button className="btn btn-primary" onClick={openNew}><Plus size={15} /> Add Automation</button>} />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Name</th><th>Tool</th><th>Status</th><th>Last Run</th><th>Result</th><th></th></tr>
              </thead>
              <tbody>
                {data.map(auto => (
                  <tr key={auto.id} onClick={() => openEdit(auto)} style={{ cursor: 'pointer' }}>
                    <td>
                      <strong>{auto.name}</strong>
                      {auto.description && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{auto.description}</p>}
                    </td>
                    <td><span className="pill pill-purple">{auto.tool}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <label className="toggle" title="Toggle active/paused">
                        <input type="checkbox" checked={auto.status === 'active'} onChange={() => toggleStatus(auto)} />
                        <div className="toggle-track"><div className="toggle-thumb" /></div>
                      </label>
                    </td>
                    <td style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text-muted)' }}>
                      {auto.last_run_at ? formatRelative(auto.last_run_at) : '—'}
                    </td>
                    <td>
                      {auto.last_run_result ? <StatusPill status={auto.last_run_result} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => triggerAutomation(auto)}
                        disabled={auto.status !== 'active'}
                      >
                        {auto.tool === 'custom' ? <Terminal size={13} /> : <Play size={13} />}
                        Run
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {logModal && (
        <Modal title={`Running: ${logModal.auto.name}`} open={true} onClose={() => setLogModal(null)} size="lg">
          <div className="terminal">
            {logModal.lines.map((line, i) => (
              <p key={i} className={`terminal-line ${line.startsWith('[err]') ? 'terminal-error' : ''}`}>{line}</p>
            ))}
            {!logModal.done && <p className="terminal-line" style={{ opacity: 0.5 }}>⠋ Running...</p>}
            {logModal.done && <p className="terminal-line" style={{ color: 'var(--green)', marginTop: 8 }}>— Done —</p>}
          </div>
        </Modal>
      )}

      <SlideOver title={editRecord ? 'Edit Automation' : 'New Automation'} open={slideOpen} onClose={() => setSlideOpen(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setSlideOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </>}
      >
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tool</label>
            <select className="form-select" value={form.tool} onChange={e => setForm(f => ({ ...f, tool: e.target.value as Automation['tool'] }))}>
              {TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>
        {(form.tool === 'make' || form.tool === 'zapier') && (
          <div className="form-group">
            <label className="form-label">Webhook URL</label>
            <input className="form-input" value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))} placeholder="https://hook.eu1.make.com/..." />
          </div>
        )}
        {form.tool === 'n8n' && (
          <div className="form-group">
            <label className="form-label">Workflow ID</label>
            <input className="form-input" value={form.workflow_id} onChange={e => setForm(f => ({ ...f, workflow_id: e.target.value }))} />
          </div>
        )}
        {form.tool === 'custom' && (
          <div className="form-group">
            <label className="form-label">Script Body</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 120, fontFamily: 'DM Mono', fontSize: 12 }}
              value={form.script_body}
              onChange={e => setForm(f => ({ ...f, script_body: e.target.value }))}
              placeholder="echo 'Hello World'"
            />
          </div>
        )}
        {editRecord && <button className="btn btn-danger w-full" onClick={() => deleteAuto(editRecord)}><Trash2 size={14} /> Delete</button>}
      </SlideOver>
    </div>
  );
}
