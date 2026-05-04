import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (process.env.NODE_ENV !== 'test' && !JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Set a long random secret for this installation.');
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, restaurantId: user.restaurant_id || 1 },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const token = header.split(' ')[1];
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

export function adminOnly(req, res, next) {
  if (!['admin', 'superadmin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Acces interdit' });
  }
  next();
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (req.user?.role !== 'superadmin' && !roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Acces interdit' });
    }
    next();
  };
}

export function superAdminOnly(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acces super admin requis' });
  }
  next();
}
