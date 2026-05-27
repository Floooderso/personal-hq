const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const module = req.query.module || null;

  let sql = 'SELECT * FROM activity_log';
  const params = [];
  if (module) { sql += ' WHERE module = ?'; params.push(module); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);
  const total = db.prepare(
    module ? 'SELECT COUNT(*) as c FROM activity_log WHERE module=?' : 'SELECT COUNT(*) as c FROM activity_log'
  ).get(...(module ? [module] : [])).c;

  res.json({
    items: rows.map(r => ({
      ...r,
      diffs: parseDiffs(r.details),
    })),
    total,
    limit,
    offset,
  });
});

function parseDiffs(details) {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed];
  } catch {}
  return null;
}

module.exports = router;
