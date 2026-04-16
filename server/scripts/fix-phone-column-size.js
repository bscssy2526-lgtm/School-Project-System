const { run } = require('../db');
require('dotenv').config();

async function fixPhoneColumnSize() {
  try {
    console.log('📝 Enlarging phone_num column to accommodate encrypted data...\n');

    // Alter the column to VARCHAR(500) to store encrypted phone numbers
    await run(
      `ALTER TABLE users MODIFY phone_num VARCHAR(500) DEFAULT NULL`
    );

    console.log('✅ Successfully enlarged phone_num column to VARCHAR(500)\n');
    console.log('⚠️  Now run: npm run encrypt-existing-data\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error altering column:', error.message);
    process.exit(1);
  }
}

fixPhoneColumnSize();
