// backend/scripts/seedAdmin.js
// Run: node backend/scripts/seedAdmin.js
// Seeds default superadmin + branch admins with hashed passwords

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const db     = require('../config/db');

const SEED_PASSWORD = 'Admin@1234';

const users = [
  { fname:'Super',  lname:'Admin',  username:'superadmin', email:'admin@eternalrest.com',  role:'superadmin', branch_id: null },
  { fname:'Maria',  lname:'Santos', username:'msantos',    email:'msantos@eternalrest.ph', role:'admin',      branch_id: 1   },
  { fname:'Jose',   lname:'Reyes',  username:'jreyes',     email:'jreyes@eternalrest.ph',  role:'admin',      branch_id: 2   },
  { fname:'Ana',    lname:'Cruz',   username:'acruz',      email:'acruz@eternalrest.ph',   role:'admin',      branch_id: 3   },
  { fname:'Pedro',  lname:'Lim',    username:'plim',       email:'plim@eternalrest.ph',    role:'staff',      branch_id: 1   },
];

(async () => {
  try {
    console.log('🔑  Seeding users with password:', SEED_PASSWORD);
    const hash = await bcrypt.hash(SEED_PASSWORD, 10);

    for (const u of users) {
      await db.query(
        `INSERT INTO users (fname, lname, username, email, password, role, branch_id, status)
         VALUES (?,?,?,?,?,?,?,'active')
         ON DUPLICATE KEY UPDATE password = VALUES(password), role = VALUES(role), branch_id = VALUES(branch_id)`,
        [u.fname, u.lname, u.username, u.email, hash, u.role, u.branch_id]
      );
      console.log(`  ✅  ${u.role.padEnd(12)} @${u.username}`);
    }

    console.log('\n🎉  Done! All users seeded.');
    console.log('   Login at superadmin.html → username: superadmin  password:', SEED_PASSWORD);
    console.log('   Login at admin.html      → username: msantos     password:', SEED_PASSWORD);
    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  }
})();
