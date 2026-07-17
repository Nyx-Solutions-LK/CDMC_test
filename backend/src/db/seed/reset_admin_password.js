// Usage: node src/db/seed/reset_admin_password.js <username>
const { generateRandomPassword, hashPassword } = require('../../auth/passwords');
const usersRepo = require('../../repositories/users.repo');
const { pool } = require('../pool');

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: node src/db/seed/reset_admin_password.js <username>');
    process.exitCode = 1;
    return;
  }
  const user = await usersRepo.findByUsername(username);
  if (!user || user.role !== 'admin') {
    console.error(`No admin found with username "${username}"`);
    process.exitCode = 1;
    return;
  }
  const generatedPassword = generateRandomPassword();
  const passwordHash = await hashPassword(generatedPassword);
  await usersRepo.setPasswordHash(user.id, passwordHash, true);
  console.log(`Password reset for admin "${username}":`);
  console.log(`  New password (save this now): ${generatedPassword}`);
}

main()
  .catch((err) => {
    console.error('reset_admin_password failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
