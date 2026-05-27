const express = require('express');
const db = require('../db/database');
const { encrypt, decrypt, unlockWithPassword, isUnlocked, isInitialized } = require('../utils/crypto');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key NOT LIKE '%_encrypted'").all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

router.put('/', (req, res) => {
  const allowed = ['profile_name', 'profile_address', 'theme', 'bank_sync_schedule', 'notification_check_schedule'];
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      upsert.run(key, String(req.body[key]));
    }
  }
  res.json({ success: true });
});

// Integration settings
router.get('/integrations', (req, res) => {
  const keys = [
    'bank_integration_enabled', 'bank_blz', 'bank_username', 'bank_last_sync', 'bank_last_sync_result',
    'imap_integration_enabled', 'imap_host', 'imap_port', 'imap_tls', 'imap_username', 'imap_last_sync', 'imap_last_sync_result',
    'n8n_integration_enabled', 'n8n_url', 'n8n_api_key', 'n8n_last_sync',
  ];
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));

  // Never expose encrypted fields
  const result = {};
  for (const key of keys) {
    result[key] = settings[key] ?? null;
  }
  res.json(result);
});

router.post('/integrations/bank', (req, res) => {
  const { blz, username, pin, enabled } = req.body;
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  if (enabled !== undefined) upsert.run('bank_integration_enabled', enabled ? 'true' : 'false');
  if (blz) upsert.run('bank_blz', blz);
  if (username) upsert.run('bank_username', username);

  if (pin) {
    if (!isUnlocked()) return res.status(403).json({ error: 'App locked. Unlock first.' });
    upsert.run('bank_pin_encrypted', encrypt(pin));
  }

  res.json({ success: true });
});

router.post('/integrations/imap', (req, res) => {
  const { host, port, tls, username, password, enabled } = req.body;
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  if (enabled !== undefined) upsert.run('imap_integration_enabled', enabled ? 'true' : 'false');
  if (host) upsert.run('imap_host', host);
  if (port) upsert.run('imap_port', String(port));
  if (tls !== undefined) upsert.run('imap_tls', tls ? 'true' : 'false');
  if (username) upsert.run('imap_username', username);

  if (password) {
    if (!isUnlocked()) return res.status(403).json({ error: 'App locked. Unlock first.' });
    upsert.run('imap_password_encrypted', encrypt(password));
  }

  res.json({ success: true });
});

router.post('/integrations/n8n', (req, res) => {
  const { url, api_key, enabled } = req.body;
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  if (enabled !== undefined) upsert.run('n8n_integration_enabled', enabled ? 'true' : 'false');
  if (url) upsert.run('n8n_url', url);
  if (api_key) {
    if (!isUnlocked()) return res.status(403).json({ error: 'App locked. Unlock first.' });
    upsert.run('n8n_api_key_encrypted', encrypt(api_key));
  }

  res.json({ success: true });
});

// Master password
router.post('/unlock', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password required' });
  try {
    unlockWithPassword(password);
    res.json({ success: true, initialized: isInitialized() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/lock-status', (req, res) => {
  res.json({ unlocked: isUnlocked(), initialized: isInitialized() });
});

// Categories
router.get('/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY module, name').all());
});

router.post('/categories', (req, res) => {
  const { module, name, color } = req.body;
  if (!module || !name) return res.status(400).json({ error: 'module and name required' });
  const result = db.prepare('INSERT INTO categories (module, name, color) VALUES (?, ?, ?)').run(module, name, color || '#6366f1');
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/categories/:id', (req, res) => {
  const { name, color } = req.body;
  db.prepare('UPDATE categories SET name=?, color=? WHERE id=?').run(name, color, req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

router.delete('/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Data export
router.get('/export', (req, res) => {
  const data = {
    subscriptions: db.prepare('SELECT * FROM subscriptions').all(),
    shops: db.prepare('SELECT * FROM shops').all(),
    projects: db.prepare('SELECT * FROM projects').all(),
    social_media: db.prepare('SELECT * FROM social_media').all(),
    automations: db.prepare('SELECT * FROM automations').all().map(a => ({ ...a, script_body: undefined })),
    invoices: db.prepare('SELECT * FROM invoices').all(),
    categories: db.prepare('SELECT * FROM categories').all(),
    exported_at: new Date().toISOString(),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="personal-hq-export.json"');
  res.json(data);
});

// Data import
router.post('/import', express.json({ limit: '10mb' }), (req, res) => {
  const data = req.body;
  const tx = db.transaction(() => {
    if (data.subscriptions) {
      data.subscriptions.forEach(r => {
        db.prepare(`INSERT OR IGNORE INTO subscriptions (name,category,amount,billing_cycle,next_payment_date,status,cancel_method,cancel_url,notes) VALUES (?,?,?,?,?,?,?,?,?)`).run(r.name, r.category, r.amount, r.billing_cycle, r.next_payment_date, r.status, r.cancel_method, r.cancel_url, r.notes);
      });
    }
    if (data.shops) {
      data.shops.forEach(r => {
        db.prepare(`INSERT OR IGNORE INTO shops (name,url,category,account_email,tags,notes) VALUES (?,?,?,?,?,?)`).run(r.name, r.url, r.category, r.account_email, r.tags, r.notes);
      });
    }
    if (data.invoices) {
      data.invoices.forEach(r => {
        db.prepare(`INSERT OR IGNORE INTO invoices (invoice_number,vendor,amount,due_date,status,category,notes) VALUES (?,?,?,?,?,?,?)`).run(r.invoice_number, r.vendor, r.amount, r.due_date, r.status, r.category, r.notes);
      });
    }
  });
  tx();
  res.json({ success: true });
});

// Clear all data
router.delete('/data', (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'DELETE ALL DATA') return res.status(400).json({ error: 'Confirmation text required' });
  const tables = ['subscriptions', 'shops', 'projects', 'social_media', 'automations', 'invoices', 'bank_transactions', 'suggested_subscriptions', 'notifications', 'activity_log'];
  tables.forEach(t => db.prepare(`DELETE FROM ${t}`).run());
  db.prepare("DELETE FROM settings WHERE key = 'seeded'").run();
  res.json({ success: true });
});

module.exports = router;
