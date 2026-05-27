const express = require('express');
const db = require('../db/database');
const { logActivity } = require('../utils/activity');
const { generateKuendigungPDF } = require('../utils/pdf');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const router = express.Router();

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM subscriptions ORDER BY name').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, category, amount, billing_cycle, next_payment_date, payment_method, status, cancel_method, cancel_url, cancel_email, anbieter_address, kundennummer, notes } = req.body;
  if (!name || !amount || !billing_cycle) return res.status(400).json({ error: 'name, amount, billing_cycle required' });

  const result = db.prepare(
    `INSERT INTO subscriptions (name,category,amount,billing_cycle,next_payment_date,payment_method,status,cancel_method,cancel_url,cancel_email,anbieter_address,kundennummer,notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(name, category || 'Other', amount, billing_cycle, next_payment_date || null, payment_method || '', status || 'active', cancel_method || null, cancel_url || null, cancel_email || null, anbieter_address || null, kundennummer || null, notes || null);

  logActivity('create', 'subscriptions', result.lastInsertRowid, name);
  res.status(201).json(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });

  const { name, category, amount, billing_cycle, next_payment_date, payment_method, status, cancel_method, cancel_url, cancel_email, anbieter_address, kundennummer, notes } = req.body;
  db.prepare(
    `UPDATE subscriptions SET name=?,category=?,amount=?,billing_cycle=?,next_payment_date=?,payment_method=?,status=?,cancel_method=?,cancel_url=?,cancel_email=?,anbieter_address=?,kundennummer=?,notes=?,updated_at=datetime('now') WHERE id=?`
  ).run(name ?? sub.name, category ?? sub.category, amount ?? sub.amount, billing_cycle ?? sub.billing_cycle, next_payment_date ?? sub.next_payment_date, payment_method ?? sub.payment_method, status ?? sub.status, cancel_method ?? sub.cancel_method, cancel_url ?? sub.cancel_url, cancel_email ?? sub.cancel_email, anbieter_address ?? sub.anbieter_address, kundennummer ?? sub.kundennummer, notes ?? sub.notes, req.params.id);

  logActivity('update', 'subscriptions', req.params.id, name ?? sub.name);
  res.json(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM subscriptions WHERE id = ?').run(req.params.id);
  logActivity('delete', 'subscriptions', req.params.id, sub.name);
  res.json({ success: true });
});

router.post('/:id/cancel-pdf', (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });

  const settings = getSettings();
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let nextBillingDate = null;
  if (sub.next_payment_date) {
    nextBillingDate = new Date(sub.next_payment_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  generateKuendigungPDF(res, {
    subscriptionName: sub.name,
    anbieterAddress: sub.anbieter_address,
    senderName: settings.profile_name || 'Your Name',
    senderAddress: settings.profile_address || '',
    kundennummer: sub.kundennummer,
    nextBillingDate,
    today,
  });
});

router.post('/:id/cancel-automation', (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });

  const scriptName = sub.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const scriptPath = path.join(__dirname, '..', 'integrations', 'cancel-scripts', `${scriptName}.js`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!fs.existsSync(scriptPath)) {
    res.write(`data: ${JSON.stringify({ line: `No cancel script found for "${sub.name}". Create server/integrations/cancel-scripts/${scriptName}.js` })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true, success: false })}\n\n`);
    return res.end();
  }

  const child = spawn('node', [scriptPath], { timeout: 60000 });
  child.stdout.on('data', chunk => {
    chunk.toString().split('\n').filter(Boolean).forEach(line => {
      res.write(`data: ${JSON.stringify({ line })}\n\n`);
    });
  });
  child.stderr.on('data', chunk => {
    chunk.toString().split('\n').filter(Boolean).forEach(line => {
      res.write(`data: ${JSON.stringify({ line: `[err] ${line}` })}\n\n`);
    });
  });
  child.on('close', code => {
    res.write(`data: ${JSON.stringify({ done: true, success: code === 0 })}\n\n`);
    res.end();
  });
});

module.exports = router;
