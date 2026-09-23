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

// Same as requireAuth, but also accepts the short-lived token issued right
// after password login when the admin hasn't set up 2FA yet. Only used on
// the two /api/admin/2fa/* routes, so an admin can reach the QR-code setup
// screen without a full session token first.
function requireAdminOrSetup(req, res, next) {
  const payload = verifyAdminToken(req, res, ['admin', 'admin_2fa_setup_required']);
  if (!payload) return;
  req.admin = payload;
  next();
}

// Coast Guard accounts only ever hit two kinds of routes: the read-only
// schedules list and the shared chat — both use this instead of requireAuth.
// Every other /api/admin/* route is untouched and keeps using plain
// requireAuth, which only accepts 'admin' — so a coast_guard token is
// rejected there automatically, without each of those routes needing its
// own role check.
function requireAdminOrCoastGuard(req, res, next) {
  const payload = verifyAdminToken(req, res, ['admin', 'coast_guard']);
  if (!payload) return;
  req.admin = payload;
  next();
}

module.exports = { requireAuth, requireAdminOrSetup, requireAdminOrCoastGuard };