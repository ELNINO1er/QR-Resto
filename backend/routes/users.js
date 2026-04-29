import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryAll, queryOne, run } from '../db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const router = Router();
const roles = ['admin', 'serveur', 'cuisine', 'caisse'];

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: !user.default_password_changed,
    createdAt: user.created_at,
  };
}

router.use(authMiddleware, adminOnly);

router.get('/', (_req, res) => {
  const users = queryAll('SELECT id, email, name, role, default_password_changed, created_at FROM users ORDER BY created_at DESC');
  res.json(users.map(formatUser));
});

router.post('/', (req, res) => {
  const { email, name, role, password } = req.body;
  if (!email || !name || !roles.includes(role) || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email, nom, role et mot de passe de 8 caracteres requis' });
  }

  const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(409).json({ error: 'Email deja utilise' });

  const hash = bcrypt.hashSync(password, 10);
  const result = run(
    'INSERT INTO users (email, password, role, name, default_password_changed) VALUES (?, ?, ?, ?, ?)',
    [email, hash, role, name, 0]
  );
  const user = queryOne('SELECT id, email, name, role, default_password_changed, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(formatUser(user));
});

router.patch('/:id', (req, res) => {
  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const role = req.body.role ?? user.role;
  if (!roles.includes(role)) return res.status(400).json({ error: 'Role invalide' });

  if (req.body.password) {
    if (req.body.password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court' });
    const hash = bcrypt.hashSync(req.body.password, 10);
    run(
      'UPDATE users SET email = ?, name = ?, role = ?, password = ?, default_password_changed = 0 WHERE id = ?',
      [req.body.email ?? user.email, req.body.name ?? user.name, role, hash, req.params.id]
    );
  } else {
    run(
      'UPDATE users SET email = ?, name = ?, role = ? WHERE id = ?',
      [req.body.email ?? user.email, req.body.name ?? user.name, role, req.params.id]
    );
  }

  const updated = queryOne('SELECT id, email, name, role, default_password_changed, created_at FROM users WHERE id = ?', [req.params.id]);
  res.json(formatUser(updated));
});

router.delete('/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  }
  const result = run('DELETE FROM users WHERE id = ?', [req.params.id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ success: true });
});

export default router;
