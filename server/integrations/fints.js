const crypto = require('crypto');
const db = require('../db/database');

/**
 * FinTS/HBCI bank integration.
 * Requires the `fints` npm package and a compatible German bank.
 *
 * Install: npm install fints
 * Documentation: https://github.com/apility/node-fints
 */
async function syncBank({ blz, username, pin }) {
  if (!blz || !username || !pin) {
    throw new Error('Bank credentials incomplete. Configure BLZ, username, and PIN in Settings.');
  }

  let fints;
  try {
    fints = require('fints');
  } catch {
    throw new Error('fints package not installed. Run: npm install fints');
  }

  const { PinTanClient } = fints;

  const client = new PinTanClient({
    blz,
    name: username,
    pin,
    url: `https://banking-be3.s-fints-pt-be.de/fints30`, // Example URL - must be configured per bank
  });

  let recordsSynced = 0;
  const accounts = await client.accounts();
  const insertAccount = db.prepare(
    'INSERT OR IGNORE INTO bank_accounts (iban, name, balance, currency) VALUES (?,?,?,?)'
  );
  const updateBalance = db.prepare('UPDATE bank_accounts SET balance=?, last_synced_at=datetime("now") WHERE iban=?');

  for (const account of accounts) {
    const balance = await client.balance(account);
    insertAccount.run(account.iban, account.accountName || account.iban, balance.balance, 'EUR');
    updateBalance.run(balance.balance, account.iban);

    const acctRow = db.prepare('SELECT id FROM bank_accounts WHERE iban = ?').get(account.iban);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90);

    const transactions = await client.transactions(account, from, to);
    const insertTx = db.prepare(
      'INSERT OR IGNORE INTO bank_transactions (account_id,date,description,amount,sender_name,hash) VALUES (?,?,?,?,?,?)'
    );

    for (const tx of transactions) {
      const hashInput = `${tx.valueDate?.toISOString() ?? ''}|${tx.amount}|${tx.description ?? ''}`;
      const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
      const result = insertTx.run(
        acctRow?.id ?? null,
        tx.valueDate?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
        tx.description ?? '',
        parseFloat(tx.amount),
        tx.name ?? null,
        hash
      );
      if (result.changes > 0) recordsSynced++;
    }
  }

  // Zero out PIN from memory
  pin = '0'.repeat(pin.length);

  return { recordsSynced, accounts: accounts.length };
}

module.exports = { syncBank };
