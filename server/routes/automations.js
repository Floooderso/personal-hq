const express = require('express');
const db = require('../db/database');
const { logActivity } = require('../utils/activity');
const { exec } = require('child_process');
function fetch(url, opts = {}) {
  const http = require('http');
  const https = require('https');
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: opts.method || 'POST', headers: opts.headers }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, ok: res.statusCode < 400 }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM automations ORDER BY name').all());
});

router.post('/', (req, res) => {
  const { name, description, tool, webhook_url, workflow_id, script_body, status } = req.body;
  if (!name || !tool) return res.status(400).json({ error: 'name and tool required' });

  const result = db.prepare(
    `INSERT INTO automations (name,description,tool,webhook_url,workflow_id,script_body,status) VALUES (?,?,?,?,?,?,?)`
  ).run(name, description || null, tool, webhook_url || null, workflow_id || null, script_body || null, status || 'active');

  logActivity('create', 'automations', result.lastInsertRowid, name);
  res.status(201).json(db.prepare('SELECT * FROM automations WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { name, description, tool, webhook_url, workflow_id, script_body, status } = req.body;
  db.prepare(
    `UPDATE automations SET name=?,description=?,tool=?,webhook_url=?,workflow_id=?,script_body=?,status=?,updated_at=datetime('now') WHERE id=?`
  ).run(name ?? row.name, description ?? row.description, tool ?? row.tool, webhook_url ?? row.webhook_url, workflow_id ?? row.workflow_id, script_body ?? row.script_body, status ?? row.status, req.params.id);

  logActivity('update', 'automations', req.params.id, name ?? row.name);
  res.json(db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM automations WHERE id = ?').run(req.params.id);
  logActivity('delete', 'automations', req.params.id, row.name);
  res.json({ success: true });
});

router.post('/:id/trigger', async (req, res) => {
  const auto = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);
  if (!auto) return res.status(404).json({ error: 'Not found' });

  if (auto.tool === 'custom') {
    // SSE streaming for custom scripts
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!auto.script_body) {
      res.write(`data: ${JSON.stringify({ line: 'No script body configured.' })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true, success: false })}\n\n`);
      return res.end();
    }

    const child = exec(auto.script_body, { timeout: 30000, shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' });
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
      const success = code === 0;
      db.prepare(`UPDATE automations SET last_run_at=datetime('now'),last_run_result=? WHERE id=?`).run(success ? 'success' : 'failure', auto.id);
      res.write(`data: ${JSON.stringify({ done: true, success })}\n\n`);
      res.end();
    });
    return;
  }

  // Webhook-based (make, zapier, n8n)
  if (!auto.webhook_url) {
    return res.status(400).json({ error: 'No webhook URL configured' });
  }

  try {
    const response = await fetch(auto.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'personal-hq', automation_id: auto.id, triggered_at: new Date().toISOString() }),
    });

    const success = response.ok;
    db.prepare(`UPDATE automations SET last_run_at=datetime('now'),last_run_result=? WHERE id=?`).run(success ? 'success' : 'failure', auto.id);
    res.json({ success, status: response.status });
  } catch (err) {
    db.prepare(`UPDATE automations SET last_run_at=datetime('now'),last_run_result='failure' WHERE id=?`).run(auto.id);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
