const { pool } = require('../pool');
const config = require('../../config/env');
const { generateRandomPassword, hashPassword, encryptPasswordForExport } = require('../../auth/passwords');
const usersRepo = require('../../repositories/users.repo');

async function seedAdmin() {
  const existingAdmins = await usersRepo.countAdmins();
  if (existingAdmins > 0) {
    console.log('Admin already exists, skipping.');
    return;
  }

  const generatedPassword = generateRandomPassword();
  const passwordHash = await hashPassword(generatedPassword);

  let user = await usersRepo.createUser({
    username: config.seedAdminUsername,
    email: config.seedAdminEmail,
    courseId: null,
    phoneNumber: null,
    role: 'admin',
    passwordHash,
    passwordEncrypted: encryptPasswordForExport(generatedPassword),
  });

  // The first admin ever created is the "primary" admin — protected from
  // here on out against being disabled or demoted/deleted via the admin panel.
  user = await usersRepo.markAsPrimaryAdmin(user.id);

  console.log('Created initial admin account (primary — cannot be disabled or demoted):');
  console.log(`  username: ${user.username}`);
  console.log(`  email: ${user.email}`);
  console.log(`  Initial admin password (save this now): ${generatedPassword}`);
}

seedAdmin()
  .catch((err) => {
    console.error('seed:admin failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
