import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, run } from '../db.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  if (user.role !== 'superadmin') {
    const restaurant = await queryOne('SELECT status FROM restaurants WHERE id = ?', [user.restaurant_id || 1]);
    if (!restaurant || restaurant.status !== 'active') {
      return res.status(403).json({ error: 'Restaurant suspendu' });
    }
  }

  const token = generateToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      restaurantId: user.restaurant_id || 1,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: !user.default_password_changed,
    },
  });
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await queryOne('SELECT id, restaurant_id, email, name, role, default_password_changed FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({
    id: user.id,
    restaurantId: user.restaurant_id || 1,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: !user.default_password_changed,
  });
});

router.patch('/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe de 8 caracteres requis' });
  }

  const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await run('UPDATE users SET password = ?, default_password_changed = 1 WHERE id = ?', [hash, req.user.id]);
  res.json({ success: true });
});

export default router;
