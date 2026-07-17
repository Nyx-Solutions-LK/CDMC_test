const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { buildSessionMiddleware } = require('./auth/session');
const { attachUser } = require('./auth/middleware');
const { loginLimiter, changePasswordLimiter, apiLimiter } = require('./auth/rateLimit');
const { errorHandler } = require('./utils/errors');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const noticesRoutes = require('./routes/notices.routes');
const messagesRoutes = require('./routes/messages.routes');

const STATIC_SITE_DIR = path.join(__dirname, '../../cdmc-web-final');

function buildApp() {
  const app = express();

  app.disable('x-powered-by');
  // Production traffic reaches Express through Cloudflare/Caddy over the
  // internal Docker network. Trust that proxy hop so secure session cookies
  // can be set when X-Forwarded-Proto is https.
  app.set('trust proxy', 1);
  // CSP is left off deliberately: the legacy static site (cdmc-web-final/)
  // relies on inline <script>/<style> attributes throughout and external
  // Google Fonts — a real CSP would need a rewrite of that markup, which is
  // explicitly out of scope (client wants the existing design untouched).
  // The other headers (frame-ancestors, nosniff, etc.) don't require that and
  // are enabled.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(buildSessionMiddleware());
  app.use(attachUser);

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.use('/api/', apiLimiter);
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/change-password', changePasswordLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/admin/users', usersRoutes);
  app.use('/api/notices', noticesRoutes.publicRouter);
  app.use('/api/admin/notices', noticesRoutes.adminRouter);
  app.use('/api/messages', messagesRoutes.publicRouter);
  app.use('/api/admin/messages', messagesRoutes.adminRouter);

  // Legacy links (nav, bookmarks) still point at the old .php filenames from
  // the previous PHP front end — the pages are now plain static .html files,
  // so redirect the old extension to the new one instead of 404ing.
  app.get(/^\/([a-zA-Z_]+)\.php$/, (req, res, next) => {
    const base = req.params[0];
    const htmlPath = path.join(STATIC_SITE_DIR, `${base}.html`);
    if (require('fs').existsSync(htmlPath)) {
      return res.redirect(301, `/${base}.html`);
    }
    next();
  });

  // Serves the static site (index.html, notices.html, messages.html,
  // admin.html, login.html, change_password.html, assets/**). express.static
  // serves index.html for '/' automatically.
  app.use(express.static(STATIC_SITE_DIR));

  app.use((req, res) => {
    res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { buildApp };
