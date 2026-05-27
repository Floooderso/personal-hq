const express = require('express');
const open = require('open');
const { URL } = require('url');

const router = express.Router();

const BLOCKED_PROTOCOLS = ['file:', 'javascript:', 'data:', 'vbscript:'];
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^localhost$/i,
];

function isBlockedHost(hostname) {
  return PRIVATE_IP_RANGES.some(r => r.test(hostname));
}

router.post('/', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL required' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (BLOCKED_PROTOCOLS.includes(parsed.protocol)) {
    return res.status(403).json({ error: 'Blocked protocol' });
  }

  if (isBlockedHost(parsed.hostname)) {
    return res.status(403).json({ error: 'Private IP ranges not allowed' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(403).json({ error: 'Only http/https allowed' });
  }

  await open(url);
  res.json({ success: true });
});

module.exports = router;
