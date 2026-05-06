import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryAll, queryOne, run } from '../db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { requestedRestaurantId, requireActiveRestaurant } from '../middleware/tenant.js';

const router = Router();
const roles = ['admin', 'serveur', 'cuisine', 'caisse'];
const superAdminRoles = ['superadmin', ...roles];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanUserInput(body, existing = {}, actorRole = 'admin') {
  const allowedRoles = actorRole === 'superadmin' ? superAdminRoles : roles;
  const email = String(body.email ?? existing.email ?? '').trim().toLowerCase();
  const name = String(body.name ?? existing.name ?? '').trim();
  const role = body.role ?? existing.role;

  if (!emailPattern.test(email)) throw new Error('Email invalide');
  if (name.length < 2 || name.length > 80) throw new Error('Nom invalide');
  if (!allowedRoles.includes(role)) throw new Error('Role invalide');

  return { email, name, role };
}

function formatUser(user) {
  return {
    id: user.id,
    restaurantId: user.restaurant_id || 1,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: !user.default_password_changed,
    createdAt: user.created_at,
  };
}

router.use(authMiddleware, requireActiveRestaurant, adminOnly);

router.get('/', async (req, res) => {
  const selectedRestaurantId = req.user.role === 'superadmin' ? requestedRestaurantId(req) : null;
  const users = req.user.role === 'superadmin' && !selectedRestaurantId
    ? await queryAll('SELECT id, restaurant_id, email, name, role, default_password_changed, created_at FROM users ORDER BY created_at DESC')
    : await queryAll('SELECT id, restaurant_id, email, name, role, default_password_changed, created_at FROM users WHERE restaurant_id = ? ORDER BY created_at DESC', [selectedRestaurantId || req.user.restaurantId || 1]);
  res.json(users.map(formatUser));
});

router.post('/', async (req, res) => {
  let clean;
  try {
    clean = cleanUserInput(req.body, {}, req.user.role);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Email, nom, role et mot de passe de 8 caracteres requis' });
  }

  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [clean.email]);
  if (existing) return res.status(409).json({ error: 'Email deja utilise' });

  const restaurantId = req.user.role === 'superadmin'
    ? Number(req.body.restaurantId || requestedRestaurantId(req) || req.user.restaurantId || 1)
    : (req.user.restaurantId || 1);
  const hash = bcrypt.hashSync(password, 10);
  const result = await run(
    'INSERT INTO users (restaurant_id, email, password, role, name, default_password_changed) VALUES (?, ?, ?, ?, ?, ?)',
    [restaurantId, clean.email, hash, clean.role, clean.name, 0]
  );
  const user = await queryOne('SELECT id, restaurant_id, email, name, role, default_password_changed, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(formatUser(user));
});

router.patch('/:id', async (req, res) => {
  const user = req.user.role === 'superadmin'
    ? await queryOne('SELECT * FROM users WHERE id = ?', [req.params.id])
    : await queryOne('SELECT * FROM users WHERE id = ? AND restaurant_id = ?', [req.params.id, req.user.restaurantId || 1]);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  let clean;
  try {
    clean = cleanUserInput(req.body, user, req.user.role);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (req.body.password) {
    if (req.body.password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court' });
    const hash = bcrypt.hashSync(req.body.password, 10);
    await run(
      'UPDATE users SET email = ?, name = ?, role = ?, password = ?, default_password_changed = 0 WHERE id = ?',
      [clean.email, clean.name, clean.role, hash, req.params.id]
    );
  } else {
    await run(
      'UPDATE users SET email = ?, name = ?, role = ? WHERE id = ?',
      [clean.email, clean.name, clean.role, req.params.id]
    );
  }

  const updated = await queryOne('SELECT id, restaurant_id, email, name, role, default_password_changed, created_at FROM users WHERE id = ?', [req.params.id]);
  res.json(formatUser(updated));
});

router.delete('/:id', async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  }
  const result = req.user.role === 'superadmin'
    ? await run('DELETE FROM users WHERE id = ?', [req.params.id])
    : await run('DELETE FROM users WHERE id = ? AND restaurant_id = ?', [req.params.id, req.user.restaurantId || 1]);
  if (result.changes === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ success: true });
});

export default router;
