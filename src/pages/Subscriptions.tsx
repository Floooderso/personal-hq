import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  createColumnHelper, flexRender, type SortingState, type ColumnFiltersState,
} from '@tanstack/react-table';
import { Plus, ExternalLink, Mail, Cpu, MoreHorizontal, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusPill } from '../components/common/StatusPill';
import { SlideOver } from '../components/common/SlideOver';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../components/common/Toast';
import { api, downloadPDF } from '../utils/api';
import { formatCurrency, formatDate, toMonthly, daysUntil } from '../utils/format';
import type { Subscription } from '../types';
import { useKeyboard } from '../hooks/useKeyboard';

const col = createColumnHelper<Subscription>();

const BILLING_OPTIONS = ['monthly', 'yearly', 'weekly', 'quarterly'];
const STATUS_OPTIONS = ['active', 'paused', 'cancelled'];

const defaultForm = {
  name: '', category: 'Other', amount: '', billing_cycle: 'monthly',
  next_payment_date: '', payment_method: '', status: 'active',
  cancel_method: '', cancel_url: '', cancel_email: '',
  anbieter_address: '', kundennummer: '', notes: '',
};

export function Subscriptions() {
  const [data, setData] = useState<Subscription[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Subscription | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sub: Subscription } | null>(null);
  const [automationModal, setAutomationModal] = useState<{ sub: Subscription; lines: string[]; done: boolean } | null>(null);
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const load = useCallback(() => {
    api.get<Subscription[]>('/subscriptions').then(setData).catch(() => toast.error('Failed to load subscriptions'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('action') === 'new-subscription') openNew();
  }, [searchParams]);

  useKeyboard('n', () => { if (!slideOpen) openNew(); }, [slideOpen]);

  function openNew() {
    setEditRecord(null);
    setForm(defaultForm);
    setErrors({});
    setSlideOpen(true);
  }

  function openEdit(sub: Subscription) {
    setEditRecord(sub);
    setForm({
      name: sub.name, category: sub.category, amount: String(sub.amount),
      billing_cycle: sub.billing_cycle, next_payment_date: sub.next_payment_date ?? '',
      payment_method: sub.payment_method, status: sub.status,
      cancel_method: sub.cancel_method ?? '', cancel_url: sub.cancel_url ?? '',
      cancel_email: sub.cancel_email ?? '', anbieter_address: sub.anbieter_address ?? '',
      kundennummer: sub.kundennummer ?? '', notes: sub.notes ?? '',
    });
    setErrors({});
    setSlideOpen(true);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) errs.amount = 'Valid amount required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function save() {
    if (!validate()) return;
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editRecord) {
        await api.put(`/subscriptions/${editRecord.id}`, payload);
        toast.success('Subscription updated');
      } else {
        await api.post('/subscriptions', payload);
        toast.success('Subscription created');
      }
      setSlideOpen(false);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deleteSub(sub: Subscription) {
    if (!confirm(`Delete "${sub.name}"?`)) return;
    await api.delete(`/subscriptions/${sub.id}`);
    toast.success('Deleted');
    setContextMenu(null);
    load();
  }

  async function cancelPDF(sub: Subscription) {
    try {
      await downloadPDF(sub.id);
      toast.success('Kündigung PDF downloaded');
    } catch { toast.error('PDF generation failed'); }
    setContextMenu(null);
  }

  async function openURL(url: string) {
    await api.post('/open-url', { url });
    setContextMenu(null);
  }

  async function runAutomation(sub: Subscription) {
    setContextMenu(null);
    setAutomationModal({ sub, lines: [], done: false });
    const es = new EventSource(`/api/subscriptions/${sub.id}/cancel-automation`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.line) setAutomationModal(prev => prev ? { ...prev, lines: [...prev.lines, data.line] } : null);
      if (data.done) { setAutomationModal(prev => prev ? { ...prev, done: true } : null); es.close(); }
    };
    es.onerror = () => { setAutomationModal(prev => prev ? { ...prev, done: true } : null); es.close(); };
  }

  const monthly = data.filter(s => s.status === 'active').reduce((sum, s) => sum + toMonthly(s.amount, s.billing_cycle), 0);
  const yearly = monthly * 12;

  const columns = [
    col.accessor('name', {
      header: 'Name',
      cell: info => <strong>{info.getValue()}</strong>,
    }),
    col.accessor('category', { header: 'Category' }),
    col.accessor(row => toMonthly(row.amount, row.billing_cycle), {
      id: 'monthly_cost',
      header: 'Monthly Cost',
      cell: info => <span className="mono">{formatCurrency(info.getValue())}</span>,
    }),
    col.accessor('billing_cycle', { header: 'Cycle' }),
    col.accessor('next_payment_date', {
      header: 'Next Payment',
      cell: info => {
        const d = info.getValue();
        const days = daysUntil(d);
        return (
          <span className="mono" style={{ color: days !== null && days <= 3 ? 'var(--yellow)' : undefined }}>
            {formatDate(d ?? null)}
            {days !== null && days <= 7 && <span style={{ marginLeft: 6, fontSize: 11 }}>({days}d)</span>}
          </span>
        );
      },
    }),
    col.accessor('payment_method', { header: 'Payment' }),
    col.accessor('status', {
      header: 'Status',
      cell: info => <StatusPill status={info.getValue()} />,
    }),
    col.display({
      id: 'actions',
      header: '',
      cell: info => (
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY, sub: info.row.original });
          }}
        >
          <MoreHorizontal size={15} />
        </button>
      ),
    }),
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Subscriptions"
        actions={
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={15} /> New Subscription
          </button>
        }
      />
      <div className="page-content">
        {/* Summary bar */}
        <div className="summary-bar">
          <div className="summary-item">
            <span className="summary-item-label">Monthly Total</span>
            <span className="summary-item-value">{formatCurrency(monthly)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-item-label">Annual Projection</span>
            <span className="summary-item-value">{formatCurrency(yearly)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-item-label">Active</span>
            <span className="summary-item-value">{data.filter(s => s.status === 'active').length}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-8" style={{ marginBottom: 12 }}>
          <input
            className="form-input"
            style={{ maxWidth: 280 }}
            placeholder="Search subscriptions..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
          <select
            className="form-select"
            style={{ width: 140 }}
            onChange={(e) => table.getColumn('status')?.setFilterValue(e.target.value || undefined)}
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            className="form-select"
            style={{ width: 160 }}
            onChange={(e) => table.getColumn('billing_cycle')?.setFilterValue(e.target.value || undefined)}
          >
            <option value="">All Cycles</option>
            {BILLING_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Table */}
        {data.length === 0 ? (
          <EmptyState
            title="No subscriptions yet"
            subtitle="Track your recurring payments and never miss a cancellation deadline."
            action={<button className="btn btn-primary" onClick={openNew}><Plus size={15} /> Add Subscription</button>}
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        className={header.column.getCanSort() ? 'sortable' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} onClick={() => openEdit(row.original)} style={{ cursor: 'pointer' }}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setContextMenu(null)} />
          <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <div className="context-menu-item" onClick={() => { openEdit(contextMenu.sub); setContextMenu(null); }}>Edit</div>
            <div className="context-menu-sep" />
            {contextMenu.sub.cancel_method === 'url' && contextMenu.sub.cancel_url && (
              <div className="context-menu-item" onClick={() => openURL(contextMenu.sub.cancel_url!)}>
                <ExternalLink size={14} /> Kündigen (URL)
              </div>
            )}
            {contextMenu.sub.cancel_method === 'email' && (
              <div className="context-menu-item" onClick={() => cancelPDF(contextMenu.sub)}>
                <Mail size={14} /> Kündigung PDF herunterladen
              </div>
            )}
            {contextMenu.sub.cancel_method === 'automation' && (
              <div className="context-menu-item" onClick={() => runAutomation(contextMenu.sub)}>
                <Cpu size={14} /> Kündigen (Automation)
              </div>
            )}
            <div className="context-menu-sep" />
            <div className="context-menu-item danger" onClick={() => deleteSub(contextMenu.sub)}>
              <Trash2 size={14} /> Delete
            </div>
          </div>
        </>
      )}

      {/* Automation log modal */}
      {automationModal && (
        <Modal
          title={`Cancel Automation: ${automationModal.sub.name}`}
          open={true}
          onClose={() => setAutomationModal(null)}
          size="lg"
        >
          <div className="terminal">
            {automationModal.lines.map((line, i) => (
              <p key={i} className={`terminal-line ${line.startsWith('[err]') ? 'terminal-error' : ''}`}>{line}</p>
            ))}
            {!automationModal.done && <p className="terminal-line" style={{ opacity: 0.5 }}>Running...</p>}
            {automationModal.done && <p className="terminal-line" style={{ color: 'var(--green)' }}>— Done —</p>}
          </div>
        </Modal>
      )}

      {/* SlideOver for create/edit */}
      <SlideOver
        title={editRecord ? 'Edit Subscription' : 'New Subscription'}
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setSlideOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Netflix, Spotify..." />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Amount *</label>
            <input className="form-input" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="9.99" />
            {errors.amount && <span className="form-error">{errors.amount}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Billing Cycle</label>
            <select className="form-select" value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}>
              {BILLING_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Next Payment Date</label>
          <input className="form-input" type="date" value={form.next_payment_date} onChange={e => setForm(f => ({ ...f, next_payment_date: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Payment Method</label>
          <input className="form-input" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} placeholder="Visa •••• 4242" />
        </div>
        <hr className="divider" />
        <div className="form-group">
          <label className="form-label">Cancel Method</label>
          <select className="form-select" value={form.cancel_method} onChange={e => setForm(f => ({ ...f, cancel_method: e.target.value }))}>
            <option value="">None</option>
            <option value="url">URL</option>
            <option value="email">Email (PDF)</option>
            <option value="automation">Automation (Playwright)</option>
          </select>
        </div>
        {form.cancel_method === 'url' && (
          <div className="form-group">
            <label className="form-label">Cancel URL</label>
            <input className="form-input" value={form.cancel_url} onChange={e => setForm(f => ({ ...f, cancel_url: e.target.value }))} placeholder="https://..." />
          </div>
        )}
        {form.cancel_method === 'email' && (
          <>
            <div className="form-group">
              <label className="form-label">Cancel Email</label>
              <input className="form-input" value={form.cancel_email} onChange={e => setForm(f => ({ ...f, cancel_email: e.target.value }))} placeholder="kundigung@service.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Anbieter Address</label>
              <textarea className="form-textarea" value={form.anbieter_address} onChange={e => setForm(f => ({ ...f, anbieter_address: e.target.value }))} placeholder="Service GmbH&#10;Musterstraße 1&#10;12345 Berlin" />
            </div>
            <div className="form-group">
              <label className="form-label">Kundennummer</label>
              <input className="form-input" value={form.kundennummer} onChange={e => setForm(f => ({ ...f, kundennummer: e.target.value }))} />
            </div>
          </>
        )}
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        {editRecord && (
          <button className="btn btn-danger w-full" onClick={() => deleteSub(editRecord)}>
            <Trash2 size={14} /> Delete Subscription
          </button>
        )}
      </SlideOver>
    </div>
  );
}
