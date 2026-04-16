/**
 * Migration: Add privacy_accepted column to users table
 * Purpose: Track when users accept the data privacy notice
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require(path.join(__dirname, '..', 'db.js'));

async function migrate() {
  try {
    console.log('Adding privacy_accepted column to users table...');
    
    await db.run(
      'ALTER TABLE users ADD COLUMN privacy_accepted DATETIME DEFAULT NULL'
    );
    
    console.log('✅ Column added successfully!');
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists, skipping...');
      process.exit(0);
    }
    console.error('Error:', err.message);
    process.exit(1);
  }
}

migrate();
