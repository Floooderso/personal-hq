const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');

// Initialize DB and run migrations + seed
require('./db/migrate');
require('./db/seed');

const { healthCheck } = require('./db/migrate');
const app = express();
const PORT = 3001;

// Run startup DB integrity check
const dbHealth = healthCheck();
if (!dbHealth.ok) {
  console.error('[startup] DB health check FAILED:', dbHealth);
}
// Expose via global for the /api/health route
global.dbHealth = dbHealth;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/open-url',      require('./routes/openUrl'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/services',      require('./routes/services'));
app.use('/api/projects',      require('./routes/projects'));
app.use('/api/social',        require('./routes/social'));
app.use('/api/automations',   require('./routes/automations'));
app.use('/api/finances',      require('./routes/finances'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/search',        require('./routes/search'));
app.use('/api/sync',          require('./routes/sync'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/notes',         require('./routes/notes'));
app.use('/api/log',           require('./routes/log'));
app.use('/api/tags',          require('./routes/tags'));

// Health check — includes DB state
app.get('/api/health', (req, res) => {
  const health = global.dbHealth || { ok: true, missing_tables: [] };
  res.json({
    status: health.ok ? 'ok' : 'error',
    version: '1.0.0',
    db_ok: health.ok,
    missing_tables: health.missing_tables || [],
    error: health.error || undefined,
  });
});

// Cron: check notifications every hour
const { checkAndCreateNotifications } = require('./routes/notifications');
cron.schedule('0 * * * *', () => { checkAndCreateNotifications(); });

// Cron: service health checks every 5 minutes
const { checkService } = require('./routes/services');
const db = require('./db/database');

cron.schedule('*/5 * * * *', async () => {
  const services = db.prepare('SELECT * FROM services').all();
  for (const svc of services) {
    try { await checkService(svc); } catch {}
  }
});

// Cron: bank sync daily 06:00
cron.schedule('0 6 * * *', async () => {
  const settings = Object.fromEntries(
    db.prepare('SELECT key,value FROM settings').all().map(r => [r.key, r.value])
  );
  if (settings.bank_integration_enabled === 'true') {
    try {
      const { isUnlocked, decrypt } = require('./utils/crypto');
      if (!isUnlocked()) return;
      const { syncBank } = require('./integrations/fints');
      const pin = settings.bank_pin_encrypted ? decrypt(settings.bank_pin_encrypted) : null;
      await syncBank({ blz: settings.bank_blz, username: settings.bank_username, pin });
      checkAndCreateNotifications();
    } catch (err) {
      console.error('[cron] Bank sync error:', err.message);
    }
  }
});

// Initial checks on startup
setTimeout(checkAndCreateNotifications, 2000);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Personal HQ Server`);
  console.log(`  Backend:  http://localhost:${PORT}`);
  console.log(`  Frontend: http://localhost:5173`);
  console.log(`  DB:       ${dbHealth.ok ? 'OK' : 'ERROR — ' + (dbHealth.missing_tables || []).join(', ')}\n`);
});
