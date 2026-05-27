const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const row = db.prepare('SELECT * FROM scratch_notes ORDER BY id LIMIT 1').get();
  if (!row) {
    db.prepare("INSERT INTO scratch_notes (content) VALUES ('')").run();
    return res.json({ id: 1, content: '', updated_at: new Date().toISOString() });
  }
  res.json(row);
});

router.put('/', (req, res) => {
  const { content } = req.body;
  const existing = db.prepare('SELECT id FROM scratch_notes ORDER BY id LIMIT 1').get();
  if (existing) {
    db.prepare("UPDATE scratch_notes SET content=?,updated_at=datetime('now') WHERE id=?").run(content ?? '', existing.id);
  } else {
    db.prepare("INSERT INTO scratch_notes (content) VALUES (?)").run(content ?? '');
  }
  const row = db.prepare('SELECT * FROM scratch_notes ORDER BY id LIMIT 1').get();
  res.json(row);
});

module.exports = router;
