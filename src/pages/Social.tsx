import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useReactTable, getCoreRowModel, getSortedRowModel, createColumnHelper, flexRender, type SortingState } from '@tanstack/react-table';
import { Plus, ExternalLink, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusPill } from '../components/common/StatusPill';
import { SlideOver } from '../components/common/SlideOver';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../components/common/Toast';
import { api } from '../utils/api';
import type { SocialAccount } from '../types';
import { useKeyboard } from '../hooks/useKeyboard';

const col = createColumnHelper<SocialAccount>();

const PLATFORM_COLORS: Record<string, string> = {
  'Twitter / X': '#1da1f2', Instagram: '#e1306c', LinkedIn: '#0077b5',
  YouTube: '#ff0000', GitHub: '#333', TikTok: '#010101', Facebook: '#1877f2',
};

const defaultForm = { platform: '', username: '', follower_count: '0', account_email: '', status: 'active', profile_url: '', notes: '' };

export function Social() {
  const [data, setData] = useState<SocialAccount[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<SocialAccount | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const load = useCallback(() => {
    api.get<SocialAccount[]>('/social').then(setData).catch(() => toast.error('Failed to load'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (searchParams.get('action') === 'new-social') openNew(); }, [searchParams]);
  useKeyboard('n', () => { if (!slideOpen) openNew(); }, [slideOpen]);

  function openNew() {
    setEditRecord(null);
    setForm(defaultForm);
    setErrors({});
    setSlideOpen(true);
  }

  function openEdit(acc: SocialAccount) {
    setEditRecord(acc);
    setForm({ platform: acc.platform, username: acc.username, follower_count: String(acc.follower_count), account_email: acc.account_email ?? '', status: acc.status, profile_url: acc.profile_url ?? '', notes: acc.notes ?? '' });
    setErrors({});
    setSlideOpen(true);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.platform.trim()) errs.platform = 'Platform required';
    if (!form.username.trim()) errs.username = 'Username required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function save() {
    if (!validate()) return;
    try {
      const payload = { ...form, follower_count: Number(form.follower_count) };
      if (editRecord) { await api.put(`/social/${editRecord.id}`, payload); toast.success('Updated'); }
      else { await api.post('/social', payload); toast.success('Added'); }
      setSlideOpen(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function deleteAcc(acc: SocialAccount) {
    if (!confirm(`Delete ${acc.platform} account?`)) return;
    await api.delete(`/social/${acc.id}`);
    toast.success('Deleted');
    setSlideOpen(false);
    load();
  }

  async function openURL(url: string) { await api.post('/open-url', { url }); }

  const columns = [
    col.accessor('platform', {
      header: 'Platform',
      cell: info => (
        <span style={{ fontWeight: 600, color: PLATFORM_COLORS[info.getValue()] ?? 'var(--primary)', fontSize: 13 }}>
          {info.getValue()}
        </span>
      ),
    }),
    col.accessor('username', { header: 'Username', cell: i => <span className="mono">{i.getValue()}</span> }),
    col.accessor('follower_count', {
      header: 'Followers',
      cell: i => <span className="mono">{i.getValue().toLocaleString()}</span>,
    }),
    col.accessor('account_email', { header: 'Email', cell: i => i.getValue() ?? '—' }),
    col.accessor('status', { header: 'Status', cell: i => <StatusPill status={i.getValue()} /> }),
    col.accessor('profile_url', {
      header: 'Profile',
      cell: info => {
        const url = info.getValue();
        if (!url) return '—';
        return (
          <button className="btn btn-ghost btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); openURL(url); }}>
            <ExternalLink size={14} />
          </button>
        );
      },
    }),
  ];

  const table = useReactTable({
    data, columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader title="Social Media" actions={
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New Account</button>
      } />
      <div className="page-content">
        {data.length === 0 ? (
          <EmptyState title="No social accounts" subtitle="Track your online presence across all platforms." action={<button className="btn btn-primary" onClick={openNew}><Plus size={15} /> Add Account</button>} />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>{hg.headers.map(h => <th key={h.id} className="sortable" onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} onClick={() => openEdit(row.original)} style={{ cursor: 'pointer' }}>
                    {row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SlideOver title={editRecord ? 'Edit Account' : 'New Account'} open={slideOpen} onClose={() => setSlideOpen(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setSlideOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </>}
      >
        <div className="form-group">
          <label className="form-label">Platform *</label>
          <input className="form-input" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} placeholder="Twitter / X, Instagram..." />
          {errors.platform && <span className="form-error">{errors.platform}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Username *</label>
          <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="@yourhandle" />
          {errors.username && <span className="form-error">{errors.username}</span>}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Followers</label>
            <input className="form-input" type="number" value={form.follower_count} onChange={e => setForm(f => ({ ...f, follower_count: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Account Email</label>
          <input className="form-input" value={form.account_email} onChange={e => setForm(f => ({ ...f, account_email: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Profile URL</label>
          <input className="form-input" value={form.profile_url} onChange={e => setForm(f => ({ ...f, profile_url: e.target.value }))} placeholder="https://..." />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        {editRecord && <button className="btn btn-danger w-full" onClick={() => deleteAcc(editRecord)}><Trash2 size={14} /> Delete</button>}
      </SlideOver>
    </div>
  );
}
