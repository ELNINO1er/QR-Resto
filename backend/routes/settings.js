import { Router } from 'express';
import os from 'os';
import { isMysql, queryAll, run } from '../db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { APP_TIME_ZONE, getQrBaseUrl } from '../config.js';

const router = Router();

async function getSettings(filter) {
  const query = filter
    ? `SELECT * FROM settings WHERE key IN (${filter.map(() => '?').join(',')})`
    : 'SELECT * FROM settings';
  const rows = await queryAll(query, filter || []);
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

// Public
router.get('/public', async (_req, res) => {
  res.json(await getSettings(['restaurant_name', 'currency', 'tables_count', 'qr_base_url', 'timezone']));
});

router.get('/network', async (req, res) => {
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
  const settings = await getSettings(['qr_base_url']);
  const detectedOrigin = `http://${preferred}:${port}`;
  const configuredOrigin = getQrBaseUrl(settings.qr_base_url);

  res.json({
    addresses,
    preferred,
    origin: configuredOrigin || detectedOrigin,
    detectedOrigin,
  });
});

// Admin: all settings
router.get('/', authMiddleware, adminOnly, async (_req, res) => {
  res.json(await getSettings());
});

// Admin: update settings
router.patch('/', authMiddleware, adminOnly, async (req, res) => {
  const allowed = new Set(['restaurant_name', 'address', 'phone', 'currency', 'tables_count', 'qr_base_url', 'timezone']);
  const clean = {};

  for (const [key, value] of Object.entries(req.body)) {
    if (!allowed.has(key)) continue;
    const text = String(value ?? '').trim();

    if (['restaurant_name', 'address'].includes(key) && text.length > 120) {
      return res.status(400).json({ error: `${key} trop long` });
    }
    if (key === 'phone' && text.length > 40) {
      return res.status(400).json({ error: 'Telephone trop long' });
    }
    if (key === 'currency' && !['FCFA', 'XOF'].includes(text)) {
      return res.status(400).json({ error: 'Devise invalide' });
    }
    if (key === 'tables_count') {
      const tables = Number(text);
      if (!Number.isInteger(tables) || tables < 1 || tables > 500) {
        return res.status(400).json({ error: 'Nombre de tables invalide' });
      }
      clean[key] = String(tables);
      continue;
    }
    if (key === 'qr_base_url' && text && !/^https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(text)) {
      return res.status(400).json({ error: 'Adresse QR invalide' });
    }
    if (key === 'timezone' && text !== APP_TIME_ZONE) {
      return res.status(400).json({ error: `Fuseau horaire attendu: ${APP_TIME_ZONE}` });
    }

    clean[key] = key === 'qr_base_url' ? getQrBaseUrl(text) : text;
  }

  for (const [key, value] of Object.entries(clean)) {
    if (isMysql()) {
      await run(
        'INSERT INTO settings (restaurant_id, `key`, value) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [key, value]
      );
    } else {
      await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
    }
  }
  res.json(await getSettings());
});

export default router;
