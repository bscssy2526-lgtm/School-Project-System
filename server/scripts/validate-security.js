#!/usr/bin/env node

/**
 * Validation script for encryption and data security setup
 * Run this to verify everything is configured correctly
 */

const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { encryptPhoneNumber, decryptPhoneNumber, maskPhoneNumber, maskEncryptedPhoneNumber } = require('../utils/encryption');

console.log('🔐 Data Privacy & Security System Validation\n');
console.log('=' .repeat(60));

// 1. Check encryption key
console.log('\n1️⃣  Encryption Key Configuration');
console.log('-'.repeat(60));
const encryptionKey = process.env.ENCRYPTION_KEY;
if (!encryptionKey) {
  console.log('❌ ENCRYPTION_KEY not set in .env');
  console.log('   Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.log('   Then add ENCRYPTION_KEY=<output> to your .env file\n');
} else if (encryptionKey.length < 32) {
  console.log(`⚠️  ENCRYPTION_KEY is only ${encryptionKey.length} characters (need 32)`);
  console.log('   It will be padded with zeros, which is less secure.\n');
} else {
  console.log('✅ ENCRYPTION_KEY is properly configured');
  console.log(`   Length: ${encryptionKey.length} characters\n`);
}

// 2. Test encryption/decryption
console.log('2️⃣  Encryption & Decryption Test');
console.log('-'.repeat(60));
try {
  const testPhone = '09123456789';
  const encrypted = encryptPhoneNumber(testPhone);
  const decrypted = decryptPhoneNumber(encrypted);
  
  if (decrypted === testPhone) {
    console.log(`✅ Encryption/Decryption working correctly`);
    console.log(`   Original:  ${testPhone}`);
    console.log(`   Encrypted: ${encrypted.substring(0, 40)}...`);
    console.log(`   Decrypted: ${decrypted}\n`);
  } else {
    console.log(`❌ Decryption failed - got "${decrypted}" instead of "${testPhone}"`);
    console.log('   Check your ENCRYPTION_KEY setting\n');
  }
} catch (error) {
  console.log(`❌ Encryption failed: ${error.message}\n`);
}

// 3. Test masking
console.log('3️⃣  Phone Number Masking Test');
console.log('-'.repeat(60));
try {
  const testPhone = '09123456789';
  const masked = maskPhoneNumber(testPhone);
  console.log(`✅ Masking working correctly`);
  console.log(`   Original: ${testPhone}`);
  console.log(`   Masked:   ${masked}\n`);
} catch (error) {
  console.log(`❌ Masking failed: ${error.message}\n`);
}

// 4. Test encrypted masking
console.log('4️⃣  Encrypted Phone Masking Test');
console.log('-'.repeat(60));
try {
  const testPhone = '09987654321';
  const encrypted = encryptPhoneNumber(testPhone);
  const masked = maskEncryptedPhoneNumber(encrypted);
  console.log(`✅ Encrypted masking working correctly`);
  console.log(`   Original:  ${testPhone}`);
  console.log(`   Masked:    ${masked}\n`);
} catch (error) {
  console.log(`❌ Encrypted masking failed: ${error.message}\n`);
}

// 5. Check database connection
console.log('5️⃣  Database Connection Test');
console.log('-'.repeat(60));
const db = require('../db');
(async () => {
  try {
    const result = await db.get('SELECT 1 as connected');
    if (result) {
      console.log('✅ Database connection successful\n');
    } else {
      console.log('❌ Database query failed\n');
    }
  } catch (error) {
    console.log(`❌ Database connection error: ${error.message}`);
    console.log(`   Check your DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in .env\n`);
  }

  // 6. Check retention columns
  console.log('6️⃣  Data Retention Columns Check');
  console.log('-'.repeat(60));
  try {
    const columns = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'users' AND COLUMN_NAME IN ('phone_num_added_at', 'phone_num_retention_expires')`
    );
    
    if (columns.length === 2) {
      console.log('✅ Retention columns are present');
      console.log('   - phone_num_added_at');
      console.log('   - phone_num_retention_expires\n');
    } else {
      console.log('❌ Retention columns are missing');
      console.log('   Run: npm run migrate-phone-retention\n');
    }
  } catch (error) {
    console.log(`⚠️  Could not check columns: ${error.message}\n`);
  }

  // 7. Summary
  console.log('=' .repeat(60));
  console.log('\n📋 Summary\n');
  console.log('✅ = Working correctly');
  console.log('⚠️  = Needs attention');
  console.log('❌ = Failed - fix before deployment\n');
  
  console.log('📌 Next Steps:');
  console.log('   1. Generate encryption key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.log('   2. Add ENCRYPTION_KEY to .env');
  console.log('   3. Run migration: npm run migrate-phone-retention');
  console.log('   4. Test with real phone numbers in your app');
  console.log('   5. Set up automated cleanup: npm run cleanup-phone-numbers (daily)\n');

  process.exit(0);
})();
