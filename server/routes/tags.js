const express = require('express');
const db = require('../db/database');

const router = express.Router();

const TAG_COLORS = ['#6b6b68','#5c7a6b','#7c6b3a','#6b5c7a','#5c6b7a','#7a5c5c','#5c7a7a','#7a6b5c'];

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM tags ORDER BY name').all());
});

router.post('/', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const c = color || TAG_COLORS[0];
  try {
    const result = db.prepare('INSERT INTO tags (name, color) VALUES (?,?)').run(name.trim(), c);
    res.status(201).json(db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid));
  } catch {
    res.status(409).json({ error: 'Tag already exists' });
  }
});

router.put('/:id', (req, res) => {
  const { name, color } = req.body;
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE tags SET name=?,color=? WHERE id=?').run(name ?? tag.name, color ?? tag.color, req.params.id);
  res.json(db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
module.exports.TAG_COLORS = TAG_COLORS;
