const express = require('express');
const db = require('../db/database');
const { logActivity } = require('../utils/activity');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM shops ORDER BY name').all();
  res.json(rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') })));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...row, tags: JSON.parse(row.tags || '[]') });
});

router.post('/', (req, res) => {
  const { name, url, category, account_email, tags, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const result = db.prepare(
    `INSERT INTO shops (name,url,category,account_email,tags,notes) VALUES (?,?,?,?,?,?)`
  ).run(name, url || null, category || 'Other', account_email || null, JSON.stringify(tags || []), notes || null);

  logActivity('create', 'shops', result.lastInsertRowid, name);
  const row = db.prepare('SELECT * FROM shops WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...row, tags: JSON.parse(row.tags || '[]') });
});

router.put('/:id', (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Not found' });

  const { name, url, category, account_email, tags, notes } = req.body;
  db.prepare(
    `UPDATE shops SET name=?,url=?,category=?,account_email=?,tags=?,notes=?,updated_at=datetime('now') WHERE id=?`
  ).run(name ?? shop.name, url ?? shop.url, category ?? shop.category, account_email ?? shop.account_email, JSON.stringify(tags ?? JSON.parse(shop.tags || '[]')), notes ?? shop.notes, req.params.id);

  logActivity('update', 'shops', req.params.id, name ?? shop.name);
  const row = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
  res.json({ ...row, tags: JSON.parse(row.tags || '[]') });
});

router.delete('/:id', (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM shops WHERE id = ?').run(req.params.id);
  logActivity('delete', 'shops', req.params.id, shop.name);
  res.json({ success: true });
});

module.exports = router;
