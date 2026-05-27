const express = require('express');
const db = require('../db/database');
const { logActivity } = require('../utils/activity');

const router = express.Router();

function parseService(row) {
  return { ...row, tags: JSON.parse(row.tags || '[]'), success: row.success === 1 };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM services ORDER BY name').all();
  res.json(rows.map(parseService));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(parseService(row));
});

router.get('/:id/checks', (req, res) => {
  const limit = parseInt(req.query.limit) || 288;
  const rows = db.prepare(
    'SELECT * FROM service_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT ?'
  ).all(req.params.id, limit);
  res.json(rows.reverse());
});

router.post('/', (req, res) => {
  const { name, internal_url, external_url, hosting_location, server_name, category, version, notes, tags } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const result = db.prepare(
    `INSERT INTO services (name,internal_url,external_url,hosting_location,server_name,category,version,notes,tags)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    name, internal_url || null, external_url || null,
    hosting_location || null, server_name || null,
    category || 'Other', version || null,
    notes || null, JSON.stringify(tags || [])
  );

  logActivity('create', 'services', result.lastInsertRowid, name);
  res.status(201).json(parseService(db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid)));
});

router.put('/:id', (req, res) => {
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!svc) return res.status(404).json({ error: 'Not found' });

  const { name, internal_url, external_url, hosting_location, server_name, category, version, notes, tags } = req.body;
  db.prepare(
    `UPDATE services SET name=?,internal_url=?,external_url=?,hosting_location=?,server_name=?,
     category=?,version=?,notes=?,tags=?,updated_at=datetime('now') WHERE id=?`
  ).run(
    name ?? svc.name, internal_url ?? svc.internal_url, external_url ?? svc.external_url,
    hosting_location ?? svc.hosting_location, server_name ?? svc.server_name,
    category ?? svc.category, version ?? svc.version,
    notes ?? svc.notes, JSON.stringify(tags ?? JSON.parse(svc.tags || '[]')),
    req.params.id
  );

  logActivity('update', 'services', req.params.id, name ?? svc.name);
  res.json(parseService(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!svc) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  logActivity('delete', 'services', req.params.id, svc.name);
  res.json({ success: true });
});

// Manual health check trigger for a single service
router.post('/:id/check', async (req, res) => {
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!svc) return res.status(404).json({ error: 'Not found' });
  const result = await checkService(svc);
  res.json(result);
});

async function checkService(svc) {
  const url = svc.internal_url || svc.external_url;
  if (!url) return { success: false, status_code: null, latency_ms: null };

  const http = require('http');
  const https = require('https');
  const start = Date.now();

  return new Promise((resolve) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, { timeout: 5000 }, (res2) => {
        const latency_ms = Date.now() - start;
        const success = res2.statusCode < 400;
        const status_code = res2.statusCode;
        res2.destroy();

        db.prepare(
          `INSERT INTO service_checks (service_id, status_code, latency_ms, success) VALUES (?,?,?,?)`
        ).run(svc.id, status_code, latency_ms, success ? 1 : 0);

        db.prepare(
          `UPDATE services SET status=?,last_checked=datetime('now'),last_status_code=?,last_latency_ms=?,updated_at=datetime('now') WHERE id=?`
        ).run(success ? 'up' : 'down', status_code, latency_ms, svc.id);

        // Keep only last 30 days of checks (≈8640 records) per service
        db.prepare(
          `DELETE FROM service_checks WHERE service_id=? AND checked_at < datetime('now', '-30 days')`
        ).run(svc.id);

        resolve({ success, status_code, latency_ms });
      });

      req.on('error', () => {
        const latency_ms = Date.now() - start;
        db.prepare(
          `INSERT INTO service_checks (service_id, status_code, latency_ms, success) VALUES (?,?,?,0)`
        ).run(svc.id, null, latency_ms);
        db.prepare(
          `UPDATE services SET status='down',last_checked=datetime('now'),last_latency_ms=?,updated_at=datetime('now') WHERE id=?`
        ).run(latency_ms, svc.id);
        resolve({ success: false, status_code: null, latency_ms });
      });

      req.on('timeout', () => {
        req.destroy();
        const latency_ms = Date.now() - start;
        db.prepare(
          `INSERT INTO service_checks (service_id, status_code, latency_ms, success) VALUES (?,?,?,0)`
        ).run(svc.id, null, latency_ms);
        db.prepare(
          `UPDATE services SET status='down',last_checked=datetime('now'),last_latency_ms=?,updated_at=datetime('now') WHERE id=?`
        ).run(latency_ms, svc.id);
        resolve({ success: false, status_code: null, latency_ms });
      });
    } catch {
      resolve({ success: false, status_code: null, latency_ms: null });
    }
  });
}

module.exports = router;
module.exports.checkService = checkService;
