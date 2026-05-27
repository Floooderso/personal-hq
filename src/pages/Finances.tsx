import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Download, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusPill } from '../components/common/StatusPill';
import { SlideOver } from '../components/common/SlideOver';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../components/common/Toast';
import { api, exportCSV } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import type { Invoice, BankTransaction } from '../types';
import { useKeyboard } from '../hooks/useKeyboard';

const CHART_COLORS = ['#6366f1', '#a78bfa', '#22c55e', '#3b82f6', '#f97316', '#eab308', '#ef4444'];

interface OverviewData {
  monthly: Record<string, number | string>[];
  pie: { name: string; value: number }[];
  categories: string[];
}

const defaultForm = {
  invoice_number: '', vendor: '', amount: '', due_date: '', status: 'pending', category: 'Other', notes: '',
};

export function Finances() {
  const [tab, setTab] = useState<'invoices' | 'overview' | 'transactions'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Invoice | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const load = useCallback(() => {
    api.get<Invoice[]>('/finances/invoices').then(setInvoices).catch(() => toast.error('Failed to load'));
    if (tab === 'overview') api.get<OverviewData>('/finances/overview').then(setOverview).catch(() => {});
    if (tab === 'transactions') api.get<BankTransaction[]>('/finances/transactions').then(setTransactions).catch(() => {});
  }, [tab, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (searchParams.get('action') === 'new-invoice') openNew(); }, [searchParams]);
  useKeyboard('n', () => { if (!slideOpen && tab === 'invoices') openNew(); }, [slideOpen, tab]);

  function openNew() {
    setEditRecord(null);
    setForm(defaultForm);
    setErrors({});
    setSlideOpen(true);
  }

  function openEdit(inv: Invoice) {
    setEditRecord(inv);
    setForm({ invoice_number: inv.invoice_number ?? '', vendor: inv.vendor, amount: String(inv.amount), due_date: inv.due_date ?? '', status: inv.status, category: inv.category ?? 'Other', notes: inv.notes ?? '' });
    setErrors({});
    setSlideOpen(true);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.vendor.trim()) errs.vendor = 'Vendor required';
    if (!form.amount || isNaN(Number(form.amount))) errs.amount = 'Valid amount required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function save() {
    if (!validate()) return;
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editRecord) { await api.put(`/finances/invoices/${editRecord.id}`, payload); toast.success('Updated'); }
      else { await api.post('/finances/invoices', payload); toast.success('Created'); }
      setSlideOpen(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function deleteInvoice(inv: Invoice) {
    if (!confirm(`Delete invoice from "${inv.vendor}"?`)) return;
    await api.delete(`/finances/invoices/${inv.id}`);
    toast.success('Deleted');
    setSlideOpen(false);
    load();
  }

  async function matchTransaction(txId: number, invoiceId: number) {
    await api.post(`/finances/transactions/${txId}/match`, { invoice_id: invoiceId });
    toast.success('Matched to invoice');
    load();
  }

  const filtered = invoices.filter(i => {
    const matchesText = i.vendor.toLowerCase().includes(filter.toLowerCase()) || (i.invoice_number ?? '').includes(filter);
    const matchesStatus = !statusFilter || i.status === statusFilter;
    return matchesText && matchesStatus;
  });

  const totals = {
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
    pending: invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0),
    overdue: invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Finances"
        actions={
          <>
            {tab === 'invoices' && (
              <>
                <button className="btn btn-secondary" onClick={exportCSV}><Download size={14} /> Export CSV</button>
                <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New Invoice</button>
              </>
            )}
          </>
        }
        tabs={
          <div className="tabs" style={{ marginBottom: 0 }}>
            {(['invoices', 'overview', 'transactions'] as const).map(t => (
              <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            ))}
          </div>
        }
      />
      <div className="page-content">
        {tab === 'invoices' && (
          <>
            {/* Summary */}
            <div className="summary-bar">
              <div className="summary-item"><span className="summary-item-label">Paid</span><span className="summary-item-value" style={{ color: 'var(--green)' }}>{formatCurrency(totals.paid)}</span></div>
              <div className="summary-item"><span className="summary-item-label">Pending</span><span className="summary-item-value" style={{ color: 'var(--yellow)' }}>{formatCurrency(totals.pending)}</span></div>
              <div className="summary-item"><span className="summary-item-label">Overdue</span><span className="summary-item-value" style={{ color: 'var(--red)' }}>{formatCurrency(totals.overdue)}</span></div>
            </div>

            <div className="flex gap-8" style={{ marginBottom: 12 }}>
              <input className="form-input" style={{ maxWidth: 280 }} placeholder="Search invoices..." value={filter} onChange={e => setFilter(e.target.value)} />
              <select className="form-select" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {invoices.length === 0 ? (
              <EmptyState title="No invoices" subtitle="Track your bills and keep your finances organized." action={<button className="btn btn-primary" onClick={openNew}><Plus size={15} /> Add Invoice</button>} />
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Invoice #</th><th>Vendor</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Category</th></tr></thead>
                  <tbody>
                    {filtered.map(inv => (
                      <tr key={inv.id} onClick={() => openEdit(inv)} style={{ cursor: 'pointer' }}>
                        <td className="mono" style={{ fontSize: 12 }}>{inv.invoice_number ?? '—'}</td>
                        <td><strong>{inv.vendor}</strong></td>
                        <td className="mono">{formatCurrency(inv.amount)}</td>
                        <td className="mono" style={{ color: inv.status === 'overdue' ? 'var(--red)' : undefined }}>{formatDate(inv.due_date)}</td>
                        <td><StatusPill status={inv.status} /></td>
                        <td>{inv.category ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {overview ? (
              <>
                <div className="card">
                  <h3 style={{ marginBottom: 20 }}>Monthly Expenses by Category</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={overview.monthly} margin={{ left: -20 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v)]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {overview.categories.map((cat, i) => (
                        <Bar key={cat} dataKey={cat} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === overview.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card" style={{ maxWidth: 400 }}>
                  <h3 style={{ marginBottom: 20 }}>Spend by Category</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={overview.pie} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                        {overview.pie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading overview...</div>
            )}
          </div>
        )}

        {tab === 'transactions' && (
          <>
            {transactions.length === 0 ? (
              <EmptyState
                title="No transactions"
                subtitle="Connect your bank via FinTS/HBCI in Settings to see transactions here."
              />
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Sender</th><th></th></tr></thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td className="mono" style={{ fontSize: 12 }}>{formatDate(tx.date)}</td>
                        <td style={{ maxWidth: 300 }} className="truncate">{tx.description ?? '—'}</td>
                        <td className="mono" style={{ color: tx.amount < 0 ? 'var(--red)' : 'var(--green)' }}>
                          {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </td>
                        <td style={{ fontSize: 12 }}>{tx.sender_name ?? '—'}</td>
                        <td>
                          {!tx.matched_invoice_id && (
                            <select
                              className="form-select"
                              style={{ fontSize: 11, padding: '3px 6px' }}
                              onChange={e => { if (e.target.value) matchTransaction(tx.id, Number(e.target.value)); }}
                              defaultValue=""
                            >
                              <option value="">Match invoice...</option>
                              {invoices.filter(i => i.status !== 'paid').map(i => (
                                <option key={i.id} value={i.id}>{i.vendor} ({formatCurrency(i.amount)})</option>
                              ))}
                            </select>
                          )}
                          {tx.matched_invoice_id && <span className="pill pill-green" style={{ fontSize: 10 }}>Matched</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <SlideOver title={editRecord ? 'Edit Invoice' : 'New Invoice'} open={slideOpen} onClose={() => setSlideOpen(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setSlideOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </>}
      >
        <div className="form-group">
          <label className="form-label">Invoice Number</label>
          <input className="form-input" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="INV-2024-001" />
        </div>
        <div className="form-group">
          <label className="form-label">Vendor *</label>
          <input className="form-input" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
          {errors.vendor && <span className="form-error">{errors.vendor}</span>}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Amount *</label>
            <input className="form-input" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            {errors.amount && <span className="form-error">{errors.amount}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        {editRecord && <button className="btn btn-danger w-full" onClick={() => deleteInvoice(editRecord)}><Trash2 size={14} /> Delete</button>}
      </SlideOver>
    </div>
  );
}
