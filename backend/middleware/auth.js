const jwt = require('jsonwebtoken');

function verifyAdminToken(req, res, allowedRoles) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not logged in' });
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!allowedRoles.includes(payload.role)) {
      res.status(401).json({ error: 'Not logged in' });
      return null;
    }
    return payload;
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired login' });
    return null;
  }
}

function requireAuth(req, res, next) {
  const payload = verifyAdminToken(req, res, ['admin']);
  if (!payload) return;
  req.admin = payload;
  next();
}

function requireAdminOrSetup(req, res, next) {
  const payload = verifyAdminToken(req, res, ['admin', 'admin_2fa_setup_required']);
  if (!payload) return;
  req.admin = payload;
  next();
}

function requireAdminOrCoastGuard(req, res, next) {
  const payload = verifyAdminToken(req, res, ['admin', 'coast_guard']);
  if (!payload) return;
  req.admin = payload;
  next();
}

module.exports = { requireAuth, requireAdminOrSetup, requireAdminOrCoastGuard };