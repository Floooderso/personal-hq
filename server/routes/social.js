const express = require('express');
const db = require('../db/database');
const { logActivity } = require('../utils/activity');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM social_media ORDER BY platform').all());
});

router.post('/', (req, res) => {
  const { platform, username, follower_count, account_email, status, profile_url, notes } = req.body;
  if (!platform || !username) return res.status(400).json({ error: 'platform and username required' });

  const result = db.prepare(
    `INSERT INTO social_media (platform,username,follower_count,account_email,status,profile_url,notes) VALUES (?,?,?,?,?,?,?)`
  ).run(platform, username, follower_count || 0, account_email || null, status || 'active', profile_url || null, notes || null);

  logActivity('create', 'social', result.lastInsertRowid, `${platform} / ${username}`);
  res.status(201).json(db.prepare('SELECT * FROM social_media WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM social_media WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { platform, username, follower_count, account_email, status, profile_url, notes } = req.body;
  db.prepare(
    `UPDATE social_media SET platform=?,username=?,follower_count=?,account_email=?,status=?,profile_url=?,notes=?,updated_at=datetime('now') WHERE id=?`
  ).run(platform ?? row.platform, username ?? row.username, follower_count ?? row.follower_count, account_email ?? row.account_email, status ?? row.status, profile_url ?? row.profile_url, notes ?? row.notes, req.params.id);

  logActivity('update', 'social', req.params.id, `${platform ?? row.platform} / ${username ?? row.username}`);
  res.json(db.prepare('SELECT * FROM social_media WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM social_media WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM social_media WHERE id = ?').run(req.params.id);
  logActivity('delete', 'social', req.params.id, row.platform);
  res.json({ success: true });
});

module.exports = router;
