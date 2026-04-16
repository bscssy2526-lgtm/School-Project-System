const { query, run, get } = require('../db');
const { encryptPhoneNumber } = require('../utils/encryption');
require('dotenv').config();

async function encryptExistingPhoneNumbers() {
  try {
    console.log('🔐 Starting encryption of existing phone numbers...\n');

    // Get all users with phone numbers
    const users = await query(
      `SELECT user_id, phone_num FROM users WHERE phone_num IS NOT NULL AND phone_num != ''`
    );

    if (users.length === 0) {
      console.log('✅ No phone numbers to encrypt.');
      return;
    }

    console.log(`Found ${users.length} users with phone numbers to encrypt.\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        const encrypted = encryptPhoneNumber(user.phone_num);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 4 * 365.25 * 24 * 60 * 60 * 1000); // 4 years

        await run(
          `UPDATE users SET 
            phone_num = ?, 
            phone_num_added_at = NOW(),
            phone_num_retention_expires = ?
           WHERE user_id = ?`,
          [encrypted, expiresAt, user.user_id]
        );

        console.log(`✅ Encrypted phone for user_id ${user.user_id}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error encrypting phone for user_id ${user.user_id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Encryption Results:');
    console.log(`   ✅ Successfully encrypted: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log('\n🎉 Encryption migration complete!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error during encryption:', error);
    process.exit(1);
  }
}

// Prevent running if encryption key is not set
if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ERROR: ENCRYPTION_KEY is not set in .env file');
  console.log('   Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

encryptExistingPhoneNumbers();
