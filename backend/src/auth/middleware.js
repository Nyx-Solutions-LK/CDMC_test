const usersRepo = require('../repositories/users.repo');
const { HttpError } = require('../utils/errors');
const { asyncHandler } = require('../utils/asyncHandler');

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    companyName: user.company_name,
    mustChangePassword: Boolean(user.must_change_password),
    isDisabled: Boolean(user.is_disabled),
    createdAt: user.created_at,
  };
}

// Populates req.user from the session if present, but never rejects — used
// on every request so public-but-role-aware bits (like login-status checks)
// work without a hard auth requirement.
const attachUser = asyncHandler(async (req, res, next) => {
  if (req.session && req.session.userId) {
    const user = await usersRepo.findById(req.session.userId);
    if (user && !user.is_disabled) {
      req.user = user;
    }
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) {
    throw new HttpError(401, 'Login required', 'UNAUTHENTICATED');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    throw new HttpError(401, 'Login required', 'UNAUTHENTICATED');
  }
  if (req.user.role !== 'admin') {
    throw new HttpError(403, 'Admin access required', 'FORBIDDEN');
  }
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin, serializeUser };
