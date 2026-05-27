const Imap = require('imap');
const { simpleParser } = require('mailparser');
const db = require('../db/database');

const KEYWORDS = ['Rechnung', 'Invoice', 'Quittung', 'Bestellung', 'receipt', 'Zahlung', 'payment confirmation', 'Your subscription', 'Dein Abo', 'order confirmation'];
const AMOUNT_REGEX = /[€$]\s*(\d{1,6}[.,]\d{2})/g;
const SUBSCRIPTION_KEYWORDS = ['subscription', 'abo', 'abonnement', 'renewal', 'verlängerung'];

function extractAmount(text) {
  const matches = [...text.matchAll(AMOUNT_REGEX)];
  if (matches.length === 0) return null;
  const amtStr = matches[0][1].replace(',', '.');
  return parseFloat(amtStr);
}

function scoreSubscription(subject, body) {
  const combined = (subject + ' ' + body).toLowerCase();
  return SUBSCRIPTION_KEYWORDS.filter(k => combined.includes(k.toLowerCase())).length;
}

function syncEmail(config) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.username,
      password: config.password,
      host: config.host,
      port: config.port || 993,
      tls: config.tls !== false,
      tlsOptions: { rejectUnauthorized: false },
    });

    let recordsSynced = 0;

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) { imap.end(); return reject(err); }

        const since = new Date();
        since.setDate(since.getDate() - 30);

        imap.search(['UNSEEN', ['SINCE', since]], (err, results) => {
          if (err || !results || results.length === 0) {
            imap.end();
            return resolve({ recordsSynced: 0 });
          }

          const fetch = imap.fetch(results, { bodies: '' });
          const promises = [];

          fetch.on('message', (msg) => {
            const p = new Promise((res) => {
              msg.on('body', (stream) => {
                simpleParser(stream, (err, parsed) => {
                  if (err) return res();
                  const subject = parsed.subject || '';
                  const text = parsed.text || parsed.html || '';
                  const fromName = parsed.from?.text || '';
                  const fromDomain = parsed.from?.value?.[0]?.address?.split('@')[1] || '';

                  const matched = KEYWORDS.some(k => subject.toLowerCase().includes(k.toLowerCase()));
                  if (!matched) return res();

                  const amount = extractAmount(text + ' ' + subject);
                  if (!amount) return res();

                  const subScore = scoreSubscription(subject, text);
                  const type = subScore >= 2 ? 'subscription' : 'invoice';

                  const existing = db.prepare('SELECT id FROM detected_records WHERE email_subject = ? AND sender_domain = ?').get(subject, fromDomain);
                  if (!existing) {
                    db.prepare(
                      'INSERT INTO detected_records (type,email_subject,sender_name,sender_domain,amount,detected_date) VALUES (?,?,?,?,?,date("now"))'
                    ).run(type, subject, fromName, fromDomain, amount);
                    recordsSynced++;
                  }
                  res();
                });
              });
            });
            promises.push(p);
          });

          fetch.once('end', async () => {
            await Promise.all(promises);
            imap.end();
            resolve({ recordsSynced });
          });
        });
      });
    });

    imap.once('error', (err) => reject(err));
    imap.connect();
  });
}

module.exports = { syncEmail };
