const { HttpError } = require('../utils/errors');
const usersRepo = require('../repositories/users.repo');

async function attachUser(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await usersRepo.findById(req.session.userId);
      if (user && !user.is_disabled) {
        req.user = user;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return next(new HttpError(401, 'Authentication required', 'UNAUTHENTICATED'));
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(new HttpError(401, 'Authentication required', 'UNAUTHENTICATED'));
  }
  if (req.user.role !== 'admin') {
    return next(new HttpError(403, 'Admin role required', 'FORBIDDEN'));
  }
  next();
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    courseId: user.course_id,
    phoneNumber: user.phone_number,
    role: user.role,
    mustChangePassword: Boolean(user.must_change_password),
    isDisabled: Boolean(user.is_disabled),
    isPrimaryAdmin: Boolean(user.is_primary_admin),
    createdAt: user.created_at,
  };
}

module.exports = { attachUser, requireAuth, requireAdmin, serializeUser };
