const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'announcement_management_db',
  charset: 'utf8mb4',
});

async function migrate() {
  const conn = await pool.getConnection();
  console.log('🔧 Adding privacy_accepted column to users table...\n');

  try {
    // Check if column already exists
    const [columns] = await conn.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'privacy_accepted'`
    );

    if (columns.length > 0) {
      console.log('✅ privacy_accepted column already exists in users table');
    } else {
      console.log('Adding privacy_accepted column...');
      await conn.execute(
        `ALTER TABLE users ADD COLUMN privacy_accepted DATETIME DEFAULT NULL AFTER change_pass`
      );
      console.log('✅ privacy_accepted column added successfully');
    }

    console.log('\n✨ Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.release();
    await pool.end();
  }
}

migrate();

