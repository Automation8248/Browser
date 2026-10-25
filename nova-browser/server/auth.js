import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Try again later.' },
});

export function verifyJwt(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function verifyToken(req, res, next) {
  const token = req.cookies?.nova_token ||
    (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = verifyJwt(token);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
}

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  if (username !== config.adminUser || !config.adminPassHash) {
    return res.status(401).json({ error: 'Invalid login' });
  }
  const ok = await bcrypt.compare(password, config.adminPassHash);
  if (!ok) return res.status(401).json({ error: 'Invalid login' });

  const token = jwt.sign(
    { sub: username, role: 'admin' },
    config.jwtSecret,
    { expiresIn: `${config.sessionTtl}h` }
  );

  res.cookie('nova_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.env === 'production',
    maxAge: config.sessionTtl * 3600 * 1000,
  });
  res.json({ ok: true, user: username });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('nova_token');
  res.json({ ok: true });
});

router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user.sub, role: req.user.role });
});

export { router };
