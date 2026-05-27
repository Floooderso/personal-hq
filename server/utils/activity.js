const db = require('../db/database');

const insert = db.prepare(
  `INSERT INTO activity_log (action, module, record_id, record_name, details) VALUES (?, ?, ?, ?, ?)`
);

function logActivity(action, module, recordId, recordName, details = null) {
  try {
    const detailsStr = details !== null && typeof details === 'object'
      ? JSON.stringify(details)
      : details;
    insert.run(action, module, recordId, recordName, detailsStr);
  } catch (_) {}
}

function buildDiff(before, after, fields) {
  return fields
    .filter(f => String(before[f] ?? '') !== String(after[f] ?? ''))
    .map(f => ({ field: f, old: String(before[f] ?? ''), new: String(after[f] ?? '') }));
}

module.exports = { logActivity, buildDiff };
