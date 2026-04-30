import { Router } from 'express';
import os from 'os';
import { queryAll, run } from '../db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const router = Router();

function getSettings(filter) {
  const query = filter
    ? `SELECT * FROM settings WHERE key IN (${filter.map(() => '?').join(',')})`
    : 'SELECT * FROM settings';
  const rows = queryAll(query, filter || []);
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

// Public
router.get('/public', (_req, res) => {
  res.json(getSettings(['restaurant_name', 'currency', 'tables_count']));
});

router.get('/network', (req, res) => {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const entry of interfaces || []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }

  const referer = req.headers.referer || '';
  const refererPort = referer.match(/^https?:\/\/[^/:]+:(\d+)/)?.[1];
  const host = req.headers.host || 'localhost:5173';
  const hostPort = host.includes(':') ? host.split(':').pop() : '';
  const port = refererPort || (hostPort && hostPort !== '3001' ? hostPort : '5173');
  const preferred = addresses.find(ip => ip.startsWith('192.168.')) || addresses[0] || 'localhost';

  res.json({
    addresses,
    preferred,
    origin: `http://${preferred}:${port}`,
  });
});

// Admin: all settings
router.get('/', authMiddleware, adminOnly, (_req, res) => {
  res.json(getSettings());
});

// Admin: update settings
router.patch('/', authMiddleware, adminOnly, (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, String(value)]);
  }
  res.json(getSettings());
});

export default router;
