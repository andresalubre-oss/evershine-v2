const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Both admin and customer tokens are signed with the same JWT_SECRET, so
    // a valid signature alone isn't enough — a customer's token would pass
    // that check too. Only a token minted by the admin /api/login route
    // carries role: 'admin', so this is what actually keeps customers out
    // of admin-only routes.
    if (payload.role !== 'admin') {
      return res.status(401).json({ error: 'Not logged in' });
    }

    req.admin = payload; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired login' });
  }
}

module.exports = requireAuth;