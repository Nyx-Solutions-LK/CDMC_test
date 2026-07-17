const { generateRandomPassword, hashPassword } = require('../../auth/passwords');
const usersRepo = require('../../repositories/users.repo');
const config = require('../../config/env');
const { pool } = require('../pool');

async function main() {
  const existing = await usersRepo.findByUsername(config.seedAdminUsername);
  if (existing) {
    console.log(`Admin "${config.seedAdminUsername}" already exists — nothing to do.`);
    return;
  }
  const generatedPassword = generateRandomPassword();
  const passwordHash = await hashPassword(generatedPassword);
  const user = await usersRepo.createUser({
    username: config.seedAdminUsername,
    email: config.seedAdminEmail,
    companyName: config.companyName,
    role: 'admin',
    passwordHash,
  });
  console.log('Created initial admin account:');
  console.log(`  username: ${user.username}`);
  console.log(`  password: ${generatedPassword}`);
  console.log('  They will be required to change it on first login.');
}

main()
  .catch((err) => {
    console.error('seed_admin failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
