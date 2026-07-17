const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { buildSessionMiddleware } = require('./auth/session');
const { attachUser } = require('./auth/middleware');
const { loginLimiter, changePasswordLimiter, apiLimiter } = require('./auth/rateLimit');
const { errorHandler } = require('./utils/errors');

const authRoutes = require('./routes/auth.routes');
const clientsRoutes = require('./routes/clients.routes');
const announcementsRoutes = require('./routes/announcements.routes');
const subscriptionsRoutes = require('./routes/subscriptions.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const documentsRoutes = require('./routes/documents.routes');
const contactRoutes = require('./routes/contact.routes');

const STATIC_SITE_DIR = path.join(__dirname, '../../frontend');

function buildApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  // CSP left off: the frontend uses a couple of inline attributes for
  // simplicity. Other hardening headers (nosniff, frame-ancestors, etc.)
  // are still enabled.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(buildSessionMiddleware());
  app.use(attachUser);

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.get('/', (req, res) => res.redirect('/login.html'));

  app.use('/api/', apiLimiter);
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/change-password', changePasswordLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/admin/clients', clientsRoutes);
  app.use('/api/announcements', announcementsRoutes);
  app.use('/api/subscriptions', subscriptionsRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/invoices', invoicesRoutes);
  app.use('/api/documents', documentsRoutes);
  app.use('/api/contact', contactRoutes);

  app.use(express.static(STATIC_SITE_DIR));

  app.use((req, res) => {
    res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { buildApp };
