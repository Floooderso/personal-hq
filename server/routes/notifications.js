const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all().map(r => ({ ...r, read: r.read === 1 })));
});

router.get('/unread-count', (req, res) => {
  const count = db.prepare("SELECT COUNT(*) as c FROM notifications WHERE read = 0").get().c;
  res.json({ count });
});

router.put('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.put('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1').run();
  res.json({ success: true });
});

function checkAndCreateNotifications() {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Payment due soon
  const dueSubs = db.prepare(
    "SELECT * FROM subscriptions WHERE status = 'active' AND next_payment_date <= ? AND next_payment_date >= date('now')"
  ).all(in3Days);
  dueSubs.forEach(s => {
    const existing = db.prepare("SELECT id FROM notifications WHERE type = 'payment_due' AND related_id = ? AND created_at >= date('now')").get(s.id);
    if (!existing) {
      db.prepare("INSERT INTO notifications (type,message,related_id,related_module) VALUES (?,?,?,?)").run(
        'payment_due',
        `Payment due for ${s.name} on ${s.next_payment_date}`,
        s.id, 'subscriptions'
      );
    }
  });

  // Overdue invoices
  const overdueInvoices = db.prepare(
    "SELECT * FROM invoices WHERE status != 'paid' AND due_date < date('now')"
  ).all();
  overdueInvoices.forEach(i => {
    const existing = db.prepare("SELECT id FROM notifications WHERE type = 'invoice_overdue' AND related_id = ? AND read = 0").get(i.id);
    if (!existing) {
      db.prepare("INSERT INTO notifications (type,message,related_id,related_module) VALUES (?,?,?,?)").run(
        'invoice_overdue',
        `Invoice from ${i.vendor} (${i.amount}€) is overdue`,
        i.id, 'invoices'
      );
    }
  });

  // Failed automations
  const failedAutos = db.prepare("SELECT * FROM automations WHERE last_run_result = 'failure'").all();
  failedAutos.forEach(a => {
    const existing = db.prepare("SELECT id FROM notifications WHERE type = 'automation_failed' AND related_id = ? AND read = 0").get(a.id);
    if (!existing) {
      db.prepare("INSERT INTO notifications (type,message,related_id,related_module) VALUES (?,?,?,?)").run(
        'automation_failed',
        `Automation "${a.name}" last run failed`,
        a.id, 'automations'
      );
    }
  });

  // Pending subscription suggestions
  const pendingSubs = db.prepare("SELECT COUNT(*) as c FROM suggested_subscriptions WHERE status = 'pending_review'").get().c;
  if (pendingSubs > 0) {
    const existing = db.prepare("SELECT id FROM notifications WHERE type = 'subscription_review' AND read = 0").get();
    if (!existing) {
      db.prepare("INSERT INTO notifications (type,message,related_id,related_module) VALUES (?,?,?,?)").run(
        'subscription_review',
        `${pendingSubs} subscription(s) detected from bank transactions, awaiting review`,
        null, 'finances'
      );
    }
  }
}

module.exports = router;
module.exports.checkAndCreateNotifications = checkAndCreateNotifications;
