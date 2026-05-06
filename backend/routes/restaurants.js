import { Router } from 'express';
import { isMysql, queryAll, queryOne, run } from '../db.js';
import { authMiddleware, superAdminOnly } from '../middleware/auth.js';

const router = Router();

function cleanSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

router.use(authMiddleware, superAdminOnly);

router.get('/', async (_req, res) => {
  res.json(await queryAll('SELECT * FROM restaurants ORDER BY created_at DESC'));
});

router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const slug = cleanSlug(req.body.slug || name);
  if (name.length < 2 || name.length > 120 || !slug) {
    return res.status(400).json({ error: 'Nom de restaurant invalide' });
  }
  const existing = await queryOne('SELECT id FROM restaurants WHERE slug = ?', [slug]);
  if (existing) return res.status(409).json({ error: 'Restaurant deja existant' });

  const result = await run('INSERT INTO restaurants (name, slug, status) VALUES (?, ?, ?)', [name, slug, 'active']);
  const restaurantId = result.lastInsertRowid;
  const defaults = [
    ['restaurant_name', name],
    ['address', ''],
    ['phone', ''],
    ['currency', 'FCFA'],
    ['tables_count', '12'],
    ['qr_base_url', process.env.QR_BASE_URL || ''],
    ['timezone', process.env.APP_TIME_ZONE || 'Africa/Abidjan'],
    ['receipt_thank_you', 'Merci pour votre visite et a bientot.'],
  ];
  for (const [key, value] of defaults) {
    if (isMysql()) {
      await run('INSERT INTO settings (restaurant_id, `key`, value) VALUES (?, ?, ?)', [restaurantId, key, value]);
    } else {
      await run('INSERT INTO settings (restaurant_id, key, value) VALUES (?, ?, ?)', [restaurantId, key, value]);
    }
  }
  res.status(201).json(await queryOne('SELECT * FROM restaurants WHERE id = ?', [restaurantId]));
});

router.patch('/:id', async (req, res) => {
  const restaurant = await queryOne('SELECT * FROM restaurants WHERE id = ?', [req.params.id]);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' });

  const name = String(req.body.name ?? restaurant.name).trim();
  const status = req.body.status ?? restaurant.status;
  if (name.length < 2 || name.length > 120 || !['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Restaurant invalide' });
  }

  await run('UPDATE restaurants SET name = ?, status = ? WHERE id = ?', [name, status, req.params.id]);
  res.json(await queryOne('SELECT * FROM restaurants WHERE id = ?', [req.params.id]));
});

export default router;
