import { Router } from 'express';
import { queryAll, queryOne, run } from '../db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { getRestaurantOrNull, requestedRestaurantId, requireActiveRestaurant, scopedRestaurantId } from '../middleware/tenant.js';

const router = Router();
const MAX_IMAGE_LENGTH = 3 * 1024 * 1024;
const VALID_CATEGORIES = ['entrees', 'plats', 'desserts', 'boissons'];

// 14 allergens reglementaires EU
const VALID_ALLERGENS = [
  'gluten', 'crustaces', 'oeufs', 'poisson', 'arachides', 'soja', 'lait',
  'fruits_a_coque', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin', 'mollusques',
];

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanText(value, field, { required = false, max = 255 } = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) throw createHttpError(`${field} requis`);
  if (text.length > max) throw createHttpError(`${field} trop long`);
  return text;
}

function cleanPositiveInteger(value, field, { required = false, min = 1, max = 999999 } = {}) {
  if ((value == null || value === '') && !required) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw createHttpError(`${field} invalide`);
  }
  return number;
}

function parseAllergens(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function isAvailableNow(from, until) {
  if (!from && !until) return true;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (from && hhmm < from) return false;
  if (until && hhmm > until) return false;
  return true;
}

function formatDish(d) {
  const visible = d.visible == null ? 1 : d.visible;
  const allergens = parseAllergens(d.allergens);
  return {
    id: d.id, name: d.name, description: d.description, price: d.price,
    category: d.category, image: d.image, stock: d.stock,
    available: !!visible && d.stock > 0 && isAvailableNow(d.available_from, d.available_until),
    visible: !!visible, veg: !!d.veg, glutenFree: !!d.gluten_free,
    spicy: !!d.spicy, prepTime: d.prep_time, rating: d.rating,
    allergens,
    availableFrom: d.available_from || null,
    availableUntil: d.available_until || null,
    orderCount: d.order_count || 0,
  };
}

function validateImage(image) {
  if (!image) return '🍽️';
  if (typeof image !== 'string') {
    const error = new Error('Image invalide');
    error.status = 400;
    throw error;
  }
  if (image.length > MAX_IMAGE_LENGTH) {
    const error = new Error('Image trop volumineuse');
    error.status = 413;
    throw error;
  }
  if (image.startsWith('data:') && !image.startsWith('data:image/')) {
    const error = new Error('Format image invalide');
    error.status = 400;
    throw error;
  }
  return image;
}

function cleanDishInput(body, existing = {}) {
  const name = body.name != null
    ? cleanText(body.name, 'Nom', { required: true, max: 120 })
    : existing.name;
  const description = body.description != null
    ? cleanText(body.description, 'Description', { max: 600 })
    : (existing.description ?? '');
  const price = body.price != null
    ? cleanPositiveInteger(body.price, 'Prix', { required: true, min: 1, max: 10000000 })
    : existing.price;
  const category = body.category != null
    ? cleanText(body.category, 'Categorie', { required: true, max: 40 })
    : existing.category;

  if (!name || !price || !category) throw createHttpError('Nom, prix et categorie requis');
  if (!VALID_CATEGORIES.includes(category)) throw createHttpError('Categorie invalide');

  const stockValue = body.stock != null
    ? cleanPositiveInteger(body.stock, 'Stock', { min: 0, max: 9999 })
    : (existing.stock ?? 0);
  const prepTime = body.prepTime != null
    ? cleanPositiveInteger(body.prepTime, 'Temps de preparation', { min: 1, max: 240 })
    : (existing.prep_time ?? 15);

  return {
    name,
    description,
    price,
    category,
    stock: stockValue,
    prepTime,
  };
}

async function sendMenu(req, res, includeAll = false) {
  const restaurantId = includeAll ? scopedRestaurantId(req) : (requestedRestaurantId(req) || 1);
  const restaurant = await getRestaurantOrNull(restaurantId);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' });
  if (restaurant.status !== 'active' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Restaurant suspendu' });
  }
  const dishes = includeAll
    ? queryAll('SELECT * FROM dishes WHERE restaurant_id = ? ORDER BY category, order_count DESC, name', [restaurantId])
    : queryAll('SELECT * FROM dishes WHERE restaurant_id = ? AND COALESCE(visible, 1) = 1 AND stock > 0 ORDER BY category, order_count DESC, name', [restaurantId]);
  const formatted = (await dishes).map(formatDish);
  // Filter out time-restricted dishes for public view
  if (!includeAll) {
    return res.json(formatted.filter(d => d.available));
  }
  return res.json(formatted);
}

// Public: get menu. Admin can request all dishes with ?all=1.
router.get('/', async (req, res) => {
  if (req.query.all === '1') {
    return authMiddleware(req, res, () => requireActiveRestaurant(req, res, () => adminOnly(req, res, () => sendMenu(req, res, true))));
  }
  return await sendMenu(req, res);
});

// Admin: add dish
router.post('/', authMiddleware, requireActiveRestaurant, adminOnly, async (req, res) => {
  const { image, available, visible, veg, glutenFree, spicy, allergens, availableFrom, availableUntil } = req.body;
  let cleanInput;
  let cleanImage;
  try {
    cleanInput = cleanDishInput(req.body);
    cleanImage = validateImage(image);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }

  const cleanVisible = visible != null ? (visible ? 1 : 0) : (available != null ? (available ? 1 : 0) : 1);
  const cleanAllergens = Array.isArray(allergens) ? JSON.stringify(allergens.filter(a => VALID_ALLERGENS.includes(a))) : '[]';

  const result = await run(
    'INSERT INTO dishes (restaurant_id, name, description, price, category, image, stock, available, visible, veg, gluten_free, spicy, prep_time, allergens, available_from, available_until) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [
      req.user.restaurantId || 1, cleanInput.name, cleanInput.description, cleanInput.price, cleanInput.category,
      cleanImage, cleanInput.stock, cleanVisible && cleanInput.stock > 0 ? 1 : 0,
      cleanVisible, veg ? 1 : 0, glutenFree ? 1 : 0, spicy ? 1 : 0, cleanInput.prepTime,
      cleanAllergens, availableFrom || null, availableUntil || null,
    ]
  );

  const dish = await queryOne('SELECT * FROM dishes WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(formatDish(dish));
});

// Admin: update dish
router.patch('/:id', authMiddleware, requireActiveRestaurant, adminOnly, async (req, res) => {
  const { id } = req.params;
  const existing = req.user.role === 'superadmin'
    ? await queryOne('SELECT * FROM dishes WHERE id = ?', [id])
    : await queryOne('SELECT * FROM dishes WHERE id = ? AND restaurant_id = ?', [id, scopedRestaurantId(req)]);
  if (!existing) return res.status(404).json({ error: 'Plat introuvable' });

  const b = req.body;
  let cleanInput;
  let cleanImage;
  try {
    cleanInput = cleanDishInput(b, existing);
    cleanImage = b.image != null ? validateImage(b.image) : existing.image;
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }
  const newStock = cleanInput.stock;
  const existingVisible = existing.visible == null ? 1 : existing.visible;
  const newVisible = b.visible != null
    ? (b.visible ? 1 : 0)
    : b.available != null
      ? (b.available ? 1 : 0)
      : existingVisible;
  const newAvailable = newVisible && newStock > 0 ? 1 : 0;

  const cleanAllergens = Array.isArray(b.allergens) ? JSON.stringify(b.allergens.filter(a => VALID_ALLERGENS.includes(a))) : (existing.allergens || '[]');
  const newFrom = b.availableFrom !== undefined ? (b.availableFrom || null) : existing.available_from;
  const newUntil = b.availableUntil !== undefined ? (b.availableUntil || null) : existing.available_until;

  await run(
    `UPDATE dishes SET
      name = ?, description = ?, price = ?, category = ?, image = ?,
      stock = ?, available = ?, visible = ?, veg = ?, gluten_free = ?, spicy = ?, prep_time = ?,
      allergens = ?, available_from = ?, available_until = ?
    WHERE id = ?`,
    [
      cleanInput.name, cleanInput.description, cleanInput.price, cleanInput.category,
      cleanImage, cleanInput.stock, newAvailable, newVisible,
      b.veg != null ? (b.veg ? 1 : 0) : existing.veg,
      b.glutenFree != null ? (b.glutenFree ? 1 : 0) : existing.gluten_free,
      b.spicy != null ? (b.spicy ? 1 : 0) : existing.spicy,
      cleanInput.prepTime, cleanAllergens, newFrom, newUntil, id
    ]
  );

  const dish = await queryOne('SELECT * FROM dishes WHERE id = ?', [id]);
  res.json(formatDish(dish));
});

// Admin: delete dish
router.delete('/:id', authMiddleware, requireActiveRestaurant, adminOnly, async (req, res) => {
  const result = req.user.role === 'superadmin'
    ? await run('DELETE FROM dishes WHERE id = ?', [req.params.id])
    : await run('DELETE FROM dishes WHERE id = ? AND restaurant_id = ?', [req.params.id, scopedRestaurantId(req)]);
  if (result.changes === 0) return res.status(404).json({ error: 'Plat introuvable' });
  res.json({ success: true });
});

// ---- Formulas (menus/combos) ----

function formatFormula(f, items) {
  return {
    id: f.id, name: f.name, description: f.description, price: f.price,
    image: f.image, available: !!f.available,
    availableFrom: f.available_from || null, availableUntil: f.available_until || null,
    items: items.map(i => ({ id: i.id, category: i.category, dishId: i.dish_id, label: i.label })),
  };
}

// Public: list formulas
router.get('/formulas', async (req, res) => {
  const restaurantId = requestedRestaurantId(req) || 1;
  const formulas = await queryAll('SELECT * FROM formulas WHERE restaurant_id = ? AND available = 1 ORDER BY name', [restaurantId]);
  const result = [];
  for (const f of formulas) {
    if (!isAvailableNow(f.available_from, f.available_until)) continue;
    const items = await queryAll('SELECT * FROM formula_items WHERE formula_id = ?', [f.id]);
    result.push(formatFormula(f, items));
  }
  res.json(result);
});

// Admin: create formula
router.post('/formulas', authMiddleware, requireActiveRestaurant, adminOnly, async (req, res) => {
  const { name, description, price, image, items, availableFrom, availableUntil } = req.body;
  if (!name || !price || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Nom, prix et articles requis' });
  }
  const cleanImage = validateImage(image);
  const result = await run(
    'INSERT INTO formulas (restaurant_id, name, description, price, image, available_from, available_until) VALUES (?,?,?,?,?,?,?)',
    [scopedRestaurantId(req), name, description || '', price, cleanImage, availableFrom || null, availableUntil || null]
  );
  const insertedId = Number(result?.lastInsertRowid || 0);
  const formulaId = insertedId > 0
    ? insertedId
    : (await queryOne('SELECT MAX(id) as id FROM formulas WHERE restaurant_id = ?', [scopedRestaurantId(req)])).id;
  for (const item of items) {
    await run('INSERT INTO formula_items (formula_id, category, dish_id, label) VALUES (?,?,?,?)',
      [formulaId, item.category || '', item.dishId || null, item.label || '']);
  }
  const formula = await queryOne('SELECT * FROM formulas WHERE id = ?', [formulaId]) || {
    id: formulaId,
    name,
    description: description || '',
    price,
    image: cleanImage,
    available: 1,
    available_from: availableFrom || null,
    available_until: availableUntil || null,
  };
  const formulaItems = await queryAll('SELECT * FROM formula_items WHERE formula_id = ?', [formulaId]);
  res.status(201).json(formatFormula(formula, formulaItems));
});

router.get('/formulas/all', authMiddleware, requireActiveRestaurant, adminOnly, async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const formulas = await queryAll('SELECT * FROM formulas WHERE restaurant_id = ? ORDER BY name', [restaurantId]);
  const result = [];
  for (const f of formulas) {
    const items = await queryAll('SELECT * FROM formula_items WHERE formula_id = ?', [f.id]);
    result.push(formatFormula(f, items));
  }
  res.json(result);
});

// Admin: delete formula
router.delete('/formulas/:id', authMiddleware, requireActiveRestaurant, adminOnly, async (req, res) => {
  await run('DELETE FROM formula_items WHERE formula_id = ?', [req.params.id]);
  const result = await run('DELETE FROM formulas WHERE id = ? AND restaurant_id = ?', [req.params.id, scopedRestaurantId(req)]);
  if (result.changes === 0) return res.status(404).json({ error: 'Formule introuvable' });
  res.json({ success: true });
});

// Allergens list (reference)
router.get('/allergens', (_req, res) => {
  res.json(VALID_ALLERGENS);
});

export default router;
