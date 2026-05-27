const db = require('./database');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Other',
      amount REAL NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      next_payment_date TEXT,
      payment_method TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      cancel_method TEXT,
      cancel_url TEXT,
      cancel_email TEXT,
      anbieter_address TEXT,
      kundennummer TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      internal_url TEXT,
      external_url TEXT,
      hosting_location TEXT,
      server_name TEXT,
      category TEXT DEFAULT 'Other',
      status TEXT DEFAULT 'unknown',
      last_checked TEXT,
      last_status_code INTEGER,
      last_latency_ms INTEGER,
      version TEXT,
      notes TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS service_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      checked_at TEXT DEFAULT (datetime('now')),
      status_code INTEGER,
      latency_ms INTEGER,
      success INTEGER DEFAULT 0,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'ideas',
      priority TEXT DEFAULT 'P3',
      tags TEXT DEFAULT '[]',
      progress INTEGER DEFAULT 0,
      due_date TEXT,
      notes TEXT DEFAULT '',
      subtasks TEXT DEFAULT '[]',
      github_url TEXT,
      github_token TEXT,
      notion_url TEXT,
      linear_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      changed_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS social_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      username TEXT NOT NULL,
      follower_count INTEGER DEFAULT 0,
      account_email TEXT,
      status TEXT DEFAULT 'active',
      profile_url TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      tool TEXT NOT NULL DEFAULT 'custom',
      webhook_url TEXT,
      workflow_id TEXT,
      script_body TEXT,
      status TEXT DEFAULT 'active',
      last_run_at TEXT,
      last_run_result TEXT,
      last_run_output TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT,
      vendor TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      category TEXT DEFAULT 'Other',
      notes TEXT,
      matched_transaction_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      iban TEXT,
      name TEXT,
      balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      last_synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      date TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      sender_name TEXT,
      hash TEXT UNIQUE,
      matched_shop_id INTEGER,
      matched_invoice_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suggested_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_name TEXT,
      amount REAL,
      billing_cycle TEXT,
      total_spent REAL,
      transaction_count INTEGER,
      status TEXT DEFAULT 'pending_review',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS detected_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      email_subject TEXT,
      sender_name TEXT,
      sender_domain TEXT,
      amount REAL,
      detected_date TEXT,
      raw_body TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_id INTEGER,
      related_module TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id INTEGER,
      record_name TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration TEXT NOT NULL,
      status TEXT NOT NULL,
      records_synced INTEGER DEFAULT 0,
      error_message TEXT,
      synced_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS github_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL UNIQUE,
      data TEXT NOT NULL,
      cached_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6b6b68',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6b6b68',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scratch_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Keep shops for backward compatibility
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT,
      category TEXT DEFAULT 'Other',
      account_email TEXT,
      tags TEXT DEFAULT '[]',
      notes TEXT,
      estimated_monthly_spend REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bank_transactions_hash ON bank_transactions(hash);
    CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_service_checks_service ON service_checks(service_id, checked_at DESC);
    CREATE INDEX IF NOT EXISTS idx_service_checks_time ON service_checks(checked_at DESC);
  `);

  console.log('Migration complete.');
}

const EXPECTED_TABLES = [
  'subscriptions', 'services', 'service_checks', 'projects',
  'social_media', 'automations', 'invoices', 'bank_accounts',
  'bank_transactions', 'notifications', 'activity_log',
  'settings', 'categories', 'tags', 'scratch_notes',
];

function healthCheck() {
  const result = { ok: true, missing_tables: [], integrity: 'ok' };
  try {
    const integ = db.prepare("PRAGMA integrity_check").get();
    result.integrity = integ.integrity_check;
    if (integ.integrity_check !== 'ok') result.ok = false;

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all().map(r => r.name);

    result.missing_tables = EXPECTED_TABLES.filter(t => !tables.includes(t));
    if (result.missing_tables.length > 0) result.ok = false;
  } catch (err) {
    result.ok = false;
    result.error = err.message;
  }
  return result;
}

migrate();
module.exports = { migrate, healthCheck };
