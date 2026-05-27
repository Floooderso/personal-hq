const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return res.json([]);

  const like = `%${q}%`;

  const subs = db.prepare(
    "SELECT id, name, status, 'subscriptions' as module FROM subscriptions WHERE name LIKE ? LIMIT 5"
  ).all(like);

  const shops = db.prepare(
    "SELECT id, name, category as subtitle, 'shops' as module FROM shops WHERE name LIKE ? OR notes LIKE ? LIMIT 5"
  ).all(like, like);

  const projects = db.prepare(
    "SELECT id, title as name, status as subtitle, 'projects' as module FROM projects WHERE title LIKE ? LIMIT 5"
  ).all(like);

  const social = db.prepare(
    "SELECT id, username as name, platform as subtitle, 'social' as module FROM social_media WHERE username LIKE ? OR platform LIKE ? LIMIT 5"
  ).all(like, like);

  const invoices = db.prepare(
    "SELECT id, vendor as name, status as subtitle, 'invoices' as module FROM invoices WHERE vendor LIKE ? OR invoice_number LIKE ? LIMIT 5"
  ).all(like, like);

  const results = [
    ...subs.map(r => ({ ...r, subtitle: r.status })),
    ...shops,
    ...projects,
    ...social,
    ...invoices,
  ];

  res.json(results);
});

module.exports = router;
