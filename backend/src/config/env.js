require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  sqlitePath: process.env.SQLITE_PATH || './data/nyx.sqlite',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME || 'admin',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@nyxsolutions.com',
  companyName: process.env.COMPANY_NAME || 'Nyx Solutions',
};
