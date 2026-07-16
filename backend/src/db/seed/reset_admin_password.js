// One-off helper: reset the password for an existing admin (e.g. if you've
// forgotten it), and mark them as the "primary" admin so the admin panel can
// never disable or demote them.
//
// Usage:
//   node src/db/seed/reset_admin_password.js <username>
//
// Prints the new password once here in the terminal for you to save.

const { pool } = require('../pool');
const { generateRandomPassword, hashPassword, encryptPasswordForExport } = require('../../auth/passwords');
const usersRepo = require('../../repositories/users.repo');

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: node src/db/seed/reset_admin_password.js <username>');
    process.exitCode = 1;
    return;
  }

  const user = await usersRepo.findByUsername(username);
  if (!user) {
    console.error(`No user found with username "${username}"`);
    process.exitCode = 1;
    return;
  }
  if (user.role !== 'admin') {
    console.error(`User "${username}" is not an admin (role: ${user.role})`);
    process.exitCode = 1;
    return;
  }

  const generatedPassword = generateRandomPassword();
  const passwordHash = await hashPassword(generatedPassword);
  await usersRepo.setPasswordHash(user.id, passwordHash, true, encryptPasswordForExport(generatedPassword));
  await usersRepo.markAsPrimaryAdmin(user.id);

  console.log(`Password reset for admin "${username}" (also marked as primary admin):`);
  console.log(`  New password (save this now): ${generatedPassword}`);
  console.log('  They will be required to change it on next login.');
}

main()
  .catch((err) => {
    console.error('reset_admin_password failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
