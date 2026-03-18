#!/usr/bin/env node
/**
 * Create Admin User Script
 *
 * Generates a bcrypt hash and outputs the SQL command to create an admin user.
 *
 * Usage:
 *   node scripts/create-admin-user.js <password>
 *
 * Example:
 *   node scripts/create-admin-user.js mySecurePassword123
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const password = process.argv[2];

if (!password) {
  console.error('❌ Error: Password required');
  console.error('');
  console.error('Usage: node scripts/create-admin-user.js <password>');
  console.error('Example: node scripts/create-admin-user.js mySecurePassword123');
  process.exit(1);
}

if (password.length < 8) {
  console.error('❌ Error: Password must be at least 8 characters');
  process.exit(1);
}

console.log('🔐 Generating bcrypt hash...');

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('❌ Error generating hash:', err);
    process.exit(1);
  }

  const userId = crypto.randomUUID();
  const email = 'admin@example.com';
  const role = 'admin';

  console.log('✅ Hash generated successfully!');
  console.log('');
  console.log('📋 User Details:');
  console.log(`   ID: ${userId}`);
  console.log(`   Email: ${email}`);
  console.log(`   Role: ${role}`);
  console.log(`   Password: ${password}`);
  console.log('');
  console.log('🔑 Bcrypt Hash:');
  console.log(`   ${hash}`);
  console.log('');
  console.log('📝 Run this command to create the user:');
  console.log('');
  console.log(`wrangler d1 execute crisis2-db --remote --command="INSERT INTO users (id, email, password_hash, role, active, created_at) VALUES ('${userId}', '${email}', '${hash}', '${role}', 1, datetime('now'));"`);
  console.log('');
  console.log('✅ After running the command above, you can login with:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);

  process.exit(0);
});
