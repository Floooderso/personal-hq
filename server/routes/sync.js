const express = require('express');
const db = require('../db/database');
const { checkAndCreateNotifications } = require('./notifications');

const router = express.Router();

function logSync(integration, status, recordsSynced, errorMessage = null) {
  db.prepare('INSERT INTO sync_log (integration,status,records_synced,error_message) VALUES (?,?,?,?)').run(integration, status, recordsSynced, errorMessage);
  const settingKey = `${integration}_last_sync`;
  const resultKey = `${integration}_last_sync_result`;
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(settingKey, new Date().toISOString());
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(resultKey, status === 'success' ? `synced ${recordsSynced} records` : `error: ${errorMessage}`);
}

router.get('/status', (req, res) => {
  const logs = db.prepare('SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 20').all();
  const settings = db.prepare("SELECT key,value FROM settings WHERE key LIKE '%_last_sync%'").all();
  const status = Object.fromEntries(settings.map(r => [r.key, r.value]));
  res.json({ logs, status });
});

router.post('/bank', async (req, res) => {
  const { isUnlocked, decrypt } = require('../utils/crypto');
  if (!isUnlocked()) return res.status(403).json({ error: 'App locked. Enter master password in Settings.' });

  const settings = Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r => [r.key, r.value]));
  if (settings.bank_integration_enabled !== 'true') {
    return res.status(400).json({ error: 'Bank integration not enabled' });
  }

  try {
    const { syncBank } = require('../integrations/fints');
    const pinEncrypted = settings.bank_pin_encrypted;
    const pin = pinEncrypted ? decrypt(pinEncrypted) : null;

    const result = await syncBank({
      blz: settings.bank_blz,
      username: settings.bank_username,
      pin,
    });

    logSync('bank', 'success', result.recordsSynced);
    checkAndCreateNotifications();

    // Detect recurring charges
    detectRecurringCharges();

    res.json({ success: true, ...result });
  } catch (err) {
    logSync('bank', 'error', 0, err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/email', async (req, res) => {
  const { isUnlocked, decrypt } = require('../utils/crypto');
  if (!isUnlocked()) return res.status(403).json({ error: 'App locked.' });

  const settings = Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r => [r.key, r.value]));
  if (settings.imap_integration_enabled !== 'true') {
    return res.status(400).json({ error: 'IMAP integration not enabled' });
  }

  try {
    const { syncEmail } = require('../integrations/imap');
    const passwordEncrypted = settings.imap_password_encrypted;
    const password = passwordEncrypted ? decrypt(passwordEncrypted) : null;

    const result = await syncEmail({
      host: settings.imap_host,
      port: parseInt(settings.imap_port || '993'),
      tls: settings.imap_tls !== 'false',
      username: settings.imap_username,
      password,
    });

    logSync('email', 'success', result.recordsSynced);
    checkAndCreateNotifications();
    res.json({ success: true, ...result });
  } catch (err) {
    logSync('email', 'error', 0, err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/all', async (req, res) => {
  const results = [];
  const settings = Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r => [r.key, r.value]));

  const syncs = [];
  if (settings.bank_integration_enabled === 'true') syncs.push('bank');
  if (settings.imap_integration_enabled === 'true') syncs.push('email');

  const { isUnlocked, decrypt } = require('../utils/crypto');

  for (const syncType of syncs) {
    try {
      if (syncType === 'bank' && isUnlocked()) {
        const { syncBank } = require('../integrations/fints');
        const pin = settings.bank_pin_encrypted ? decrypt(settings.bank_pin_encrypted) : null;
        const result = await syncBank({ blz: settings.bank_blz, username: settings.bank_username, pin });
        logSync('bank', 'success', result.recordsSynced);
        results.push({ type: 'bank', success: true, ...result });
        detectRecurringCharges();
      } else if (syncType === 'email' && isUnlocked()) {
        const { syncEmail } = require('../integrations/imap');
        const password = settings.imap_password_encrypted ? decrypt(settings.imap_password_encrypted) : null;
        const result = await syncEmail({ host: settings.imap_host, port: parseInt(settings.imap_port || '993'), tls: settings.imap_tls !== 'false', username: settings.imap_username, password });
        logSync('email', 'success', result.recordsSynced);
        results.push({ type: 'email', success: true, ...result });
      }
    } catch (err) {
      logSync(syncType, 'error', 0, err.message);
      results.push({ type: syncType, success: false, error: err.message });
    }
  }

  checkAndCreateNotifications();
  res.json({ results });
});

function detectRecurringCharges() {
  const transactions = db.prepare('SELECT * FROM bank_transactions WHERE amount < 0 ORDER BY date DESC').all();
  const groups = {};

  for (const tx of transactions) {
    const key = tx.sender_name ? tx.sender_name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) : 'unknown';
    if (!groups[key]) groups[key] = { name: tx.sender_name, txs: [] };
    groups[key].txs.push(tx);
  }

  for (const [, group] of Object.entries(groups)) {
    if (group.txs.length < 2) continue;

    const amounts = group.txs.map(t => Math.abs(t.amount));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const allSimilar = amounts.every(a => Math.abs(a - avgAmount) <= 0.5);
    if (!allSimilar) continue;

    // Check interval
    const dates = group.txs.map(t => new Date(t.date).getTime()).sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    let cycle = null;
    if (Math.abs(avgInterval - 30) <= 5) cycle = 'monthly';
    else if (Math.abs(avgInterval - 365) <= 10) cycle = 'yearly';
    if (!cycle) continue;

    const existing = db.prepare("SELECT id FROM suggested_subscriptions WHERE sender_name = ? AND status = 'pending_review'").get(group.name);
    if (!existing) {
      db.prepare('INSERT INTO suggested_subscriptions (sender_name,amount,billing_cycle,total_spent,transaction_count) VALUES (?,?,?,?,?)').run(
        group.name, avgAmount, cycle,
        group.txs.reduce((sum, t) => sum + Math.abs(t.amount), 0),
        group.txs.length
      );
    }

    // Match to shops
    const { findBestMatch } = require('../utils/levenshtein');
    const shops = db.prepare('SELECT id, name FROM shops').all();
    const match = findBestMatch(group.name || '', shops);
    if (match) {
      const spend = group.txs.filter(t => {
        const now = new Date();
        const d = new Date(t.date);
        return now.getMonth() === d.getMonth() && now.getFullYear() === d.getFullYear();
      }).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      db.prepare("UPDATE shops SET estimated_monthly_spend = ? WHERE id = ?").run(spend, match.id);
    }
  }
}

module.exports = router;
