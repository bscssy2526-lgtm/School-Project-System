/**
 * Migration script to rename phone-related columns for brevity
 * Renames:
 * - phone_num_added_at → phone_added
 * - phone_num_retention_expires → phone_expire
 */

const db = require('../db');

async function renameColumns() {
  console.log('🔄 Renaming phone columns...\n');

  try {
    // Rename phone_num_added_at to phone_added
    console.log('Renaming phone_num_added_at → phone_added...');
    await db.run(
      `ALTER TABLE users 
       CHANGE COLUMN phone_num_added_at phone_added DATETIME DEFAULT NULL`
    );
    console.log('✓ Renamed phone_num_added_at to phone_added\n');

    // Rename phone_num_retention_expires to phone_expire
    console.log('Renaming phone_num_retention_expires → phone_expire...');
    await db.run(
      `ALTER TABLE users 
       CHANGE COLUMN phone_num_retention_expires phone_expire DATETIME DEFAULT NULL`
    );
    console.log('✓ Renamed phone_num_retention_expires to phone_expire\n');

    console.log('✅ Column rename migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

renameColumns();
