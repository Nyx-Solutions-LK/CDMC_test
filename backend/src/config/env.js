require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

module.exports = {
  sqlitePath: process.env.SQLITE_PATH || './data/cdmc.sqlite',
  sessionSecret: required('SESSION_SECRET'),
  port: parseInt(process.env.PORT || '4000', 10),
  maxAudioUploadBytes: parseInt(process.env.MAX_AUDIO_UPLOAD_BYTES || '15728640', 10),
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME || 'admin',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
  // Defaults to requiring HTTPS for the session cookie in production. Override
  // with COOKIE_SECURE=false only if you've confirmed TLS is terminated
  // somewhere else in front of this process (e.g. a load balancer) AND the
  // connection from that point to this process is also trusted/internal.
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production',
};
