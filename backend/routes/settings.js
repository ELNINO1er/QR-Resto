import { Router } from 'express';
import os from 'os';
import { isMysql, queryAll, run } from '../db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { requestedRestaurantId, requireActiveRestaurant, scopedRestaurantId } from '../middleware/tenant.js';
import { APP_TIME_ZONE, getQrBaseUrl } from '../config.js';

const router = Router();

async function getSettings(restaurantId, filter) {
  const query = filter
    ? `SELECT \`key\`, value FROM settings WHERE restaurant_id = ? AND \`key\` IN (${filter.map(() => '?').join(',')})`
    : 'SELECT `key`, value FROM settings WHERE restaurant_id = ?';
  const rows = await queryAll(query, [restaurantId, ...(filter || [])]);
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

// Public
router.get('/public', async (req, res) => {
  const restaurantId = requestedRestaurantId(req) || 1;
  res.json(await getSettings(restaurantId, ['restaurant_name', 'address', 'phone', 'currency', 'tables_count', 'qr_base_url', 'timezone', 'receipt_thank_you']));
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
  const restaurantId = requestedRestaurantId(req) || 1;
  const settings = await getSettings(restaurantId, ['qr_base_url']);
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
router.get('/', authMiddleware, requireActiveRestaurant, adminOnly, async (req, res) => {
  res.json(await getSettings(scopedRestaurantId(req)));
});

// Admin: update settings
router.patch('/', authMiddleware, requireActiveRestaurant, adminOnly, async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const allowed = new Set(['restaurant_name', 'address', 'phone', 'currency', 'tables_count', 'qr_base_url', 'timezone', 'receipt_thank_you']);
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
    if (key === 'receipt_thank_you' && text.length > 220) {
      return res.status(400).json({ error: 'Message de facture trop long' });
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
        'INSERT INTO settings (restaurant_id, `key`, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [restaurantId, key, value]
      );
    } else {
      await run(
        'INSERT INTO settings (restaurant_id, key, value) VALUES (?, ?, ?) ON CONFLICT(restaurant_id, key) DO UPDATE SET value = excluded.value',
        [restaurantId, key, value]
      );
    }
  }
  if (clean.restaurant_name) {
    await run('UPDATE restaurants SET name = ? WHERE id = ?', [clean.restaurant_name, restaurantId]);
  }
  res.json(await getSettings(restaurantId));
});

export default router;
