// Generates a bcrypt hash for an admin password.
// Usage: node scripts/hash-password.js "your-chosen-password"
// Copy the printed hash into the `password_hash` column of the `admins`
// table in Supabase (see README.md).

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.js <your-password>');
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  console.log('\nPassword hash (copy this into the admins.password_hash column):\n');
  console.log(hash);
  console.log('');
});
