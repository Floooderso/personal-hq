const express = require('express');
const db = require('../db/database');

const router = express.Router();

function monthlyAmount(amount, cycle) {
  switch (cycle) {
    case 'yearly': return amount / 12;
    case 'weekly': return amount * 4.33;
    case 'quarterly': return amount / 3;
    default: return amount;
  }
}

router.get('/stats', (req, res) => {
  const subs = db.prepare("SELECT amount, billing_cycle FROM subscriptions WHERE status = 'active'").all();
  const monthly_subscription_cost = subs.reduce((sum, s) => sum + monthlyAmount(s.amount, s.billing_cycle), 0);
  const active_subscriptions = subs.length;

  const open_invoices = db.prepare(
    "SELECT COUNT(*) as c FROM invoices WHERE status IN ('pending','overdue')"
  ).get().c;

  const active_projects = db.prepare(
    "SELECT COUNT(*) as c FROM projects WHERE status = 'active'"
  ).get().c;

  res.json({ monthly_subscription_cost, active_subscriptions, open_invoices, active_projects });
});

router.get('/activity', (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20"
  ).all();
  res.json(rows);
});

router.get('/chart', (req, res) => {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      month: d.toLocaleString('en', { month: 'short' }) + ' ' + d.getFullYear().toString().slice(2),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
  }

  // Compute monthly spend from active subscriptions per category
  const subs = db.prepare("SELECT category, amount, billing_cycle FROM subscriptions WHERE status = 'active'").all();
  const categories = [...new Set(subs.map(s => s.category))];

  const data = months.map(m => {
    const entry = { month: m.month };
    categories.forEach(cat => {
      entry[cat] = subs
        .filter(s => s.category === cat)
        .reduce((sum, s) => sum + monthlyAmount(s.amount, s.billing_cycle), 0);
    });
    return entry;
  });

  res.json({ data, categories });
});

router.get('/suggestions', (req, res) => {
  const suggestions = db.prepare(
    "SELECT * FROM suggested_subscriptions WHERE status = 'pending_review' ORDER BY total_spent DESC"
  ).all();
  const detected = db.prepare(
    "SELECT * FROM detected_records WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10"
  ).all();
  res.json({ suggestions, detected });
});

module.exports = router;
