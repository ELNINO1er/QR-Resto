import { Router } from 'express';
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
