const express = require('express');
const db = require('../db/database');
const { logActivity } = require('../utils/activity');

const router = express.Router();

// Auto-compute overdue status
function computeStatus(row) {
  if (row.status === 'paid') return 'paid';
  if (row.due_date && new Date(row.due_date) < new Date() && row.status !== 'paid') return 'overdue';
  return row.status || 'pending';
}

router.get('/invoices', (req, res) => {
  const rows = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({ ...r, status: computeStatus(r) })));
});

router.get('/invoices/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...row, status: computeStatus(row) });
});

router.post('/invoices', (req, res) => {
  const { invoice_number, vendor, amount, due_date, status, category, notes } = req.body;
  if (!vendor || !amount) return res.status(400).json({ error: 'vendor and amount required' });

  const result = db.prepare(
    `INSERT INTO invoices (invoice_number,vendor,amount,due_date,status,category,notes) VALUES (?,?,?,?,?,?,?)`
  ).run(invoice_number || null, vendor, amount, due_date || null, status || 'pending', category || 'Other', notes || null);

  logActivity('create', 'invoices', result.lastInsertRowid, vendor);
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...row, status: computeStatus(row) });
});

router.put('/invoices/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });

  const { invoice_number, vendor, amount, due_date, status, category, notes } = req.body;
  db.prepare(
    `UPDATE invoices SET invoice_number=?,vendor=?,amount=?,due_date=?,status=?,category=?,notes=?,updated_at=datetime('now') WHERE id=?`
  ).run(invoice_number ?? inv.invoice_number, vendor ?? inv.vendor, amount ?? inv.amount, due_date ?? inv.due_date, status ?? inv.status, category ?? inv.category, notes ?? inv.notes, req.params.id);

  logActivity('update', 'invoices', req.params.id, vendor ?? inv.vendor);
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  res.json({ ...row, status: computeStatus(row) });
});

router.delete('/invoices/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  logActivity('delete', 'invoices', req.params.id, inv.vendor);
  res.json({ success: true });
});

router.get('/overview', (req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices').all();
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ month: d.toLocaleString('en', { month: 'short' }) + ' ' + d.getFullYear().toString().slice(2), key });
  }

  const categories = [...new Set(invoices.map(i => i.category).filter(Boolean))];

  const monthly = months.map(m => {
    const entry = { month: m.month };
    categories.forEach(cat => {
      entry[cat] = invoices
        .filter(i => i.created_at && i.created_at.startsWith(m.key) && i.category === cat)
        .reduce((sum, i) => sum + i.amount, 0);
    });
    return entry;
  });

  const pie = categories.map(cat => ({
    name: cat,
    value: invoices.filter(i => i.category === cat).reduce((sum, i) => sum + i.amount, 0),
  }));

  res.json({ monthly, pie, categories });
});

router.get('/transactions', (req, res) => {
  const rows = db.prepare('SELECT * FROM bank_transactions ORDER BY date DESC LIMIT 200').all();
  res.json(rows);
});

router.post('/transactions/:id/match', (req, res) => {
  const { invoice_id } = req.body;
  db.prepare('UPDATE bank_transactions SET matched_invoice_id = ? WHERE id = ?').run(invoice_id, req.params.id);
  db.prepare('UPDATE invoices SET matched_transaction_id = ?, status = ? WHERE id = ?').run(req.params.id, 'paid', invoice_id);
  res.json({ success: true });
});

router.get('/export', (req, res) => {
  const rows = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all().map(r => ({ ...r, status: computeStatus(r) }));

  const headers = ['id', 'invoice_number', 'vendor', 'amount', 'due_date', 'status', 'category', 'notes', 'created_at'];
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const val = r[h] === null || r[h] === undefined ? '' : String(r[h]);
      return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"');
  res.send(csv);
});

router.get('/suggestions', (req, res) => {
  const subs = db.prepare("SELECT * FROM suggested_subscriptions WHERE status = 'pending_review'").all();
  res.json(subs);
});

router.post('/suggestions/:id/confirm', (req, res) => {
  const s = db.prepare('SELECT * FROM suggested_subscriptions WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });

  const result = db.prepare(
    `INSERT INTO subscriptions (name,amount,billing_cycle,status) VALUES (?,?,?,?)`
  ).run(s.sender_name, s.amount, s.billing_cycle || 'monthly', 'active');

  db.prepare("UPDATE suggested_subscriptions SET status = 'confirmed' WHERE id = ?").run(req.params.id);
  logActivity('create', 'subscriptions', result.lastInsertRowid, s.sender_name);
  res.json({ success: true });
});

router.post('/suggestions/:id/dismiss', (req, res) => {
  db.prepare("UPDATE suggested_subscriptions SET status = 'dismissed' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
