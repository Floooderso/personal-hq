const db = require('./database');
require('./migrate');

function seed() {
  const alreadySeeded = db.prepare("SELECT value FROM settings WHERE key = 'seeded'").get();
  if (alreadySeeded) {
    console.log('Already seeded, skipping.');
    return;
  }

  const today = new Date();
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().split('T')[0]; };
  const subDays = (d, n) => addDays(d, -n);

  // Subscriptions
  const insertSub = db.prepare(`INSERT INTO subscriptions (name,category,amount,billing_cycle,next_payment_date,payment_method,status,cancel_method,cancel_url,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  insertSub.run('Netflix', 'Entertainment', 17.99, 'monthly', addDays(today,12), 'Visa •••• 4242', 'active', 'url', 'https://www.netflix.com/cancelplan', 'Standard plan');
  insertSub.run('Spotify', 'Entertainment', 9.99, 'monthly', addDays(today,5), 'PayPal', 'active', 'url', 'https://www.spotify.com/account/subscription/', 'Individual plan');
  insertSub.run('GitHub Pro', 'Development', 4.00, 'monthly', addDays(today,18), 'Visa •••• 4242', 'active', 'url', 'https://github.com/settings/billing', null);
  insertSub.run('Adobe Creative Cloud', 'Design', 59.99, 'monthly', addDays(today,3), 'Mastercard •••• 9999', 'active', 'email', 'kundigung@adobe.com', 'All apps plan');
  insertSub.run('Notion', 'Productivity', 10.00, 'monthly', addDays(today,21), 'PayPal', 'paused', 'url', 'https://www.notion.so/my-account', 'Plus plan, paused during vacation');

  // Services (self-hosted)
  const insertSvc = db.prepare(`INSERT INTO services (name,internal_url,hosting_location,server_name,category,status,notes,tags) VALUES (?,?,?,?,?,?,?,?)`);
  insertSvc.run('Nextcloud', 'https://nextcloud.home.arpa', 'Homelab', 'pi4-main', 'Storage', 'unknown', 'File sync and sharing', '["homelab","storage"]');
  insertSvc.run('Vaultwarden', 'https://vault.home.arpa', 'Homelab', 'pi4-main', 'Security', 'unknown', 'Self-hosted Bitwarden', '["security","passwords"]');
  insertSvc.run('Uptime Kuma', 'https://status.home.arpa', 'Homelab', 'pi4-main', 'Monitoring', 'unknown', 'Service monitoring dashboard', '["monitoring"]');
  insertSvc.run('Gitea', 'https://git.home.arpa', 'Hetzner VPS', 'vps-cx21', 'Productivity', 'unknown', 'Private git server', '["git","dev"]');
  insertSvc.run('Jellyfin', 'https://jellyfin.home.arpa', 'Homelab', 'nas-01', 'Media', 'unknown', 'Media server', '["media","streaming"]');

  // Legacy shops (kept for backward compat)
  const insertShop = db.prepare(`INSERT INTO shops (name,url,category,account_email,tags,notes) VALUES (?,?,?,?,?,?)`);
  insertShop.run('Amazon', 'https://amazon.de', 'Electronics', 'user@example.com', '["frequent","prime"]', 'Prime member, free shipping');
  insertShop.run('Steam', 'https://store.steampowered.com', 'Gaming', 'user@example.com', '["gaming","digital"]', 'Sale watchlist active');

  // Projects
  const insertProject = db.prepare(`INSERT INTO projects (title,status,priority,tags,progress,due_date,notes) VALUES (?,?,?,?,?,?,?)`);
  const p1 = insertProject.run('Personal Website Redesign', 'active', 'P1', '["web","design"]', 65, addDays(today,30), '## Overview\nComplete redesign of personal portfolio using modern stack.\n\n## Goals\n- New dark theme\n- Project showcase\n- Blog section');
  const p2 = insertProject.run('Home Automation Setup', 'planning', 'P2', '["iot","home"]', 20, addDays(today,60), '## Overview\nSetting up Home Assistant with smart lights and sensors.');
  insertProject.run('Learn Spanish', 'active', 'P3', '["learning","language"]', 40, addDays(today,180), '## Progress\nCurrently at B1 level. Using Duolingo + podcasts.');
  insertProject.run('Side Project: Budget Tracker', 'ideas', 'P2', '["app","finance"]', 0, null, '## Idea\nSimple budget tracking app with bank sync.');
  insertProject.run('Photography Portfolio', 'done', 'P3', '["photography","creative"]', 100, subDays(today,10), '## Status\nCompleted and published!');

  db.prepare(`INSERT INTO project_status_history (project_id, status) VALUES (?,?)`).run(p1.lastInsertRowid, 'ideas');
  db.prepare(`INSERT INTO project_status_history (project_id, status) VALUES (?,?)`).run(p1.lastInsertRowid, 'planning');
  db.prepare(`INSERT INTO project_status_history (project_id, status) VALUES (?,?)`).run(p1.lastInsertRowid, 'active');
  db.prepare(`INSERT INTO project_status_history (project_id, status) VALUES (?,?)`).run(p2.lastInsertRowid, 'ideas');
  db.prepare(`INSERT INTO project_status_history (project_id, status) VALUES (?,?)`).run(p2.lastInsertRowid, 'planning');

  // Social Media
  const insertSocial = db.prepare(`INSERT INTO social_media (platform,username,follower_count,account_email,status,profile_url,notes) VALUES (?,?,?,?,?,?,?)`);
  insertSocial.run('Twitter / X', '@yourhandle', 1240, 'user@example.com', 'active', 'https://twitter.com/yourhandle', 'Mainly tech & design posts');
  insertSocial.run('Instagram', '@yourhandle', 3800, 'user@example.com', 'active', 'https://instagram.com/yourhandle', 'Photography & lifestyle');
  insertSocial.run('LinkedIn', 'Your Name', 890, 'user@example.com', 'active', 'https://linkedin.com/in/yourhandle', 'Professional profile');
  insertSocial.run('YouTube', 'Your Channel', 560, 'user@example.com', 'active', 'https://youtube.com/@yourhandle', '12 videos published');
  insertSocial.run('GitHub', 'yourhandle', 220, 'user@example.com', 'active', 'https://github.com/yourhandle', 'Open source contributions');

  // Automations
  const insertAuto = db.prepare(`INSERT INTO automations (name,description,tool,webhook_url,status,last_run_at,last_run_result) VALUES (?,?,?,?,?,?,?)`);
  insertAuto.run('Daily Backup', 'Backs up important files to cloud storage every night', 'custom', null, 'active', subDays(today,1)+'T02:00:00', 'success');
  insertAuto.run('Weekly Newsletter', 'Sends curated content digest every Monday', 'make', 'https://hook.eu1.make.com/example123', 'active', subDays(today,7)+'T09:00:00', 'success');
  insertAuto.run('Social Media Scheduler', 'Posts scheduled content to Twitter and Instagram', 'zapier', 'https://hooks.zapier.com/hooks/catch/example456', 'active', subDays(today,2)+'T10:00:00', 'success');
  insertAuto.run('Invoice Processor', 'Scans email for invoices and categorizes them', 'n8n', null, 'paused', subDays(today,14)+'T08:00:00', 'failure');
  insertAuto.run('Health Check Ping', 'Pings monitoring endpoints every 5 minutes', 'custom', null, 'active', new Date().toISOString(), 'success');

  // Invoices
  const insertInv = db.prepare(`INSERT INTO invoices (invoice_number,vendor,amount,due_date,status,category,notes) VALUES (?,?,?,?,?,?,?)`);
  insertInv.run('INV-2024-001', 'Hetzner Online GmbH', 35.90, subDays(today,5), 'paid', 'Hosting', 'Server hosting January');
  insertInv.run('INV-2024-042', 'Adobe Systems', 718.80, addDays(today,5), 'pending', 'Software', 'Annual CC subscription renewal');
  insertInv.run('INV-2023-198', 'Steuerberatung Müller', 450.00, subDays(today,30), 'overdue', 'Professional Services', 'Tax consulting Q4 2023');
  insertInv.run('REC-2024-007', 'Apple Store', 12.99, subDays(today,2), 'paid', 'Software', 'iCloud+ 200GB January');
  insertInv.run('INV-2024-089', 'Freelancer Client GmbH', 2400.00, addDays(today,14), 'pending', 'Income', 'Web design project milestone 2');

  // Categories
  const insertCat = db.prepare(`INSERT INTO categories (module,name,color) VALUES (?,?,?)`);
  ['Entertainment','Development','Design','Productivity','Health','Finance','Other'].forEach(n => insertCat.run('subscriptions', n, '#6366f1'));
  ['Electronics','Fashion','Home','Gaming','Food','Other'].forEach(n => insertCat.run('shops', n, '#a78bfa'));
  ['Work','Personal','Learning','Health','Finance','Other'].forEach(n => insertCat.run('projects', n, '#22c55e'));
  ['Hosting','Software','Professional Services','Income','Other'].forEach(n => insertCat.run('invoices', n, '#3b82f6'));

  // Settings defaults
  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)`);
  insertSetting.run('profile_name', 'Your Name');
  insertSetting.run('profile_address', 'Musterstraße 1\n12345 Berlin');
  insertSetting.run('bank_integration_enabled', 'false');
  insertSetting.run('imap_integration_enabled', 'false');
  insertSetting.run('n8n_integration_enabled', 'false');
  insertSetting.run('bank_sync_schedule', '0 6 * * *');
  insertSetting.run('notification_check_schedule', '0 * * * *');

  // Activity log seeds
  const insertActivity = db.prepare(`INSERT INTO activity_log (action,module,record_id,record_name,details) VALUES (?,?,?,?,?)`);
  insertActivity.run('create', 'subscriptions', 1, 'Netflix', null);
  insertActivity.run('create', 'subscriptions', 2, 'Spotify', null);
  insertActivity.run('create', 'projects', 1, 'Personal Website Redesign', null);
  insertActivity.run('update', 'projects', 1, 'Personal Website Redesign', 'Progress updated to 65%');
  insertActivity.run('create', 'invoices', 3, 'Steuerberatung Müller', null);

  db.prepare("INSERT INTO settings (key,value) VALUES ('seeded','true')").run();
  console.log('Seed complete.');
}

seed();
module.exports = { seed };
