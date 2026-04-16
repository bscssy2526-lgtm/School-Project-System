const db = require('../db');
const { query, get, run } = db;
require('dotenv').config();

/**
 * Add phone number retention and security fields to users table
 * This migration adds:
 * - phone_added: timestamp when phone number was added
 * - phone_expire: auto-calculated expiration date (4 years from addition)
 */
async function migrateAddPhoneRetention() {
  try {
    console.log('Starting migration: Add phone retention fields...');

    // Check if phone_added column exists
    const hasAddedAtColumn = await get(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'phone_added'`
    );

    if (!hasAddedAtColumn) {
      console.log('Adding phone_added column...');
      await run(
        `ALTER TABLE users 
         ADD COLUMN phone_added DATETIME DEFAULT NULL,
         ADD KEY idx_users_phone_added (phone_added)`
      );
      console.log('✓ phone_added column added');
    } else {
      console.log('✓ phone_added column already exists');
    }

    // Check if phone_expire column exists
    const hasExpiresColumn = await get(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'phone_expire'`
    );

    if (!hasExpiresColumn) {
      console.log('Adding phone_expire column...');
      await run(
        `ALTER TABLE users 
         ADD COLUMN phone_expire DATETIME DEFAULT NULL,
         ADD KEY idx_users_phone_expire (phone_expire)`
      );
      console.log('✓ phone_expire column added');
    } else {
      console.log('✓ phone_expire column already exists');
    }

    // Update existing records with phone numbers to set timestamps
    console.log('Updating existing records with phone numbers...');
    await run(
      `UPDATE users 
       SET phone_added = IF(phone_added IS NULL, created_at, phone_added),
           phone_expire = IF(phone_expire IS NULL, DATE_ADD(created_at, INTERVAL 4 YEAR), phone_expire)
       WHERE phone_num IS NOT NULL AND phone_added IS NULL`
    );
    console.log('✓ Existing records updated');

    console.log('\n✓ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateAddPhoneRetention()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { migrateAddPhoneRetention };
