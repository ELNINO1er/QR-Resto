import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'resto-qr-secret-key-change-in-production';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
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
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acces interdit' });
  }
  next();
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Acces interdit' });
    }
    next();
  };
}
