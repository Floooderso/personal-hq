const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'data', 'config.enc.json');

let encryptionKey = null;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

function saveConfig(data) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function isInitialized() {
  const cfg = loadConfig();
  return !!(cfg && cfg.initialized);
}

function isUnlocked() {
  return encryptionKey !== null;
}

function initMasterPassword(password) {
  const salt = crypto.randomBytes(32);
  encryptionKey = deriveKey(password, salt);
  saveConfig({ salt: salt.toString('hex'), initialized: true });
  return true;
}

function unlockWithPassword(password) {
  const cfg = loadConfig();
  if (!cfg || !cfg.salt) {
    return initMasterPassword(password);
  }
  const salt = Buffer.from(cfg.salt, 'hex');
  encryptionKey = deriveKey(password, salt);
  return true;
}

function encrypt(text) {
  if (!encryptionKey) throw new Error('App locked');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('hex'), data: encrypted.toString('hex'), tag: tag.toString('hex') });
}

function decrypt(encryptedJson) {
  if (!encryptionKey) throw new Error('App locked');
  const { iv, data, tag } = JSON.parse(encryptedJson);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt, unlockWithPassword, initMasterPassword, isUnlocked, isInitialized };
