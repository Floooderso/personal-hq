import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Grid, List, ExternalLink, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { SlideOver } from '../components/common/SlideOver';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../components/common/Toast';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';
interface Shop { id: number; name: string; url: string | null; category: string | null; account_email: string | null; tags: string[]; notes: string | null; estimated_monthly_spend: number; created_at: string; updated_at: string; }
import { useKeyboard } from '../hooks/useKeyboard';

const defaultForm = {
  name: '', url: '', category: 'Other', account_email: '', tags: '', notes: '',
};

export function Shops() {
  const [data, setData] = useState<Shop[]>([]);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Shop | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const load = useCallback(() => {
    api.get<Shop[]>('/shops').then(setData).catch(() => toast.error('Failed to load shops'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (searchParams.get('action') === 'new-shop') openNew(); }, [searchParams]);
  useKeyboard('n', () => { if (!slideOpen) openNew(); }, [slideOpen]);

  function openNew() {
    setEditRecord(null);
    setForm(defaultForm);
    setErrors({});
    setSlideOpen(true);
  }

  function openEdit(shop: Shop) {
    setEditRecord(shop);
    setForm({ name: shop.name, url: shop.url ?? '', category: shop.category ?? 'Other', account_email: shop.account_email ?? '', tags: shop.tags.join(', '), notes: shop.notes ?? '' });
    setErrors({});
    setSlideOpen(true);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function save() {
    if (!validate()) return;
    try {
      const payload = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
      if (editRecord) {
        await api.put(`/shops/${editRecord.id}`, payload);
        toast.success('Shop updated');
      } else {
        await api.post('/shops', payload);
        toast.success('Shop added');
      }
      setSlideOpen(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function deleteShop(shop: Shop) {
    if (!confirm(`Delete "${shop.name}"?`)) return;
    await api.delete(`/shops/${shop.id}`);
    toast.success('Deleted');
    setSlideOpen(false);
    load();
  }

  async function openShop(url: string) {
    await api.post('/open-url', { url });
  }

  const filtered = data.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()) || (s.category ?? '').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Shops"
        actions={
          <>
            <button className={`btn ${view === 'grid' ? 'btn-primary' : 'btn-secondary'} btn-icon`} onClick={() => setView('grid')}><Grid size={15} /></button>
            <button className={`btn ${view === 'table' ? 'btn-primary' : 'btn-secondary'} btn-icon`} onClick={() => setView('table')}><List size={15} /></button>
            <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New Shop</button>
          </>
        }
      />
      <div className="page-content">
        <input
          className="form-input"
          style={{ maxWidth: 280, marginBottom: 16 }}
          placeholder="Filter shops..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />

        {data.length === 0 ? (
          <EmptyState
            title="No shops yet"
            subtitle="Save your favourite online shops with login info, notes and spending insights."
            action={<button className="btn btn-primary" onClick={openNew}><Plus size={15} /> Add Shop</button>}
          />
        ) : view === 'grid' ? (
          <div className="shop-grid">
            {filtered.map(shop => (
              <div key={shop.id} className="shop-card">
                <div className="shop-card-header">
                  {shop.url ? (
                    <img
                      className="shop-favicon"
                      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(shop.url)}&sz=64`}
                      alt=""
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="shop-favicon" style={{ background: 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 700 }}>
                      {shop.name[0]}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="shop-name truncate">{shop.name}</p>
                    {shop.category && <span className="pill pill-purple" style={{ fontSize: 10 }}>{shop.category}</span>}
                  </div>
                </div>
                {shop.account_email && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{shop.account_email}</p>
                )}
                {shop.tags.length > 0 && (
                  <div className="flex" style={{ gap: 4, flexWrap: 'wrap' }}>
                    {shop.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
                  </div>
                )}
                {shop.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)' }} className="truncate">{shop.notes}</p>}
                {shop.estimated_monthly_spend > 0 && (
                  <p style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--green)' }}>~{formatCurrency(shop.estimated_monthly_spend)}/mo</p>
                )}
                <div className="flex gap-8" style={{ marginTop: 4 }}>
                  {shop.url && (
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => openShop(shop.url!)}>
                      <ExternalLink size={13} /> Öffnen
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(shop)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Category</th><th>Account Email</th><th>Tags</th><th>Monthly Spend</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(shop => (
                  <tr key={shop.id} onClick={() => openEdit(shop)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div className="flex items-center gap-8">
                        {shop.url && <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(shop.url)}&sz=32`} alt="" style={{ width: 16, height: 16 }} />}
                        <strong>{shop.name}</strong>
                      </div>
                    </td>
                    <td>{shop.category}</td>
                    <td style={{ fontFamily: 'DM Mono', fontSize: 12 }}>{shop.account_email ?? '—'}</td>
                    <td>{shop.tags.map((t: string) => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)}</td>
                    <td className="mono">{shop.estimated_monthly_spend > 0 ? formatCurrency(shop.estimated_monthly_spend) : '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {shop.url && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openShop(shop.url!)}><ExternalLink size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SlideOver
        title={editRecord ? 'Edit Shop' : 'New Shop'}
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
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">URL</label>
          <input className="form-input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Account Email</label>
            <input className="form-input" value={form.account_email} onChange={e => setForm(f => ({ ...f, account_email: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Tags (comma-separated)</label>
          <input className="form-input" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="fashion, returns, frequent" />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        {editRecord && (
          <button className="btn btn-danger w-full" onClick={() => deleteShop(editRecord)}>
            <Trash2 size={14} /> Delete Shop
          </button>
        )}
      </SlideOver>
    </div>
  );
}
