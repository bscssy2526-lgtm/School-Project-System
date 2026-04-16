const db = require('../db');

async function simplifySmsLogs() {
  try {
    console.log('🔧 Simplifying SMS logs table structure...\n');

    // Check if columns exist before removing
    const tableInfo = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sms_logs' 
      AND TABLE_SCHEMA = DATABASE()
    `);
    const columnsToRemove = [];

    tableInfo.forEach(col => {
      if (col.COLUMN_NAME === 'message' || col.COLUMN_NAME === 'phone_num') {
        columnsToRemove.push(col.COLUMN_NAME);
      }
    });

    if (columnsToRemove.length === 0) {
      console.log('✅ SMS logs table already simplified. No changes needed.');
      process.exit(0);
    }

    // Remove redundant columns
    for (const column of columnsToRemove) {
      console.log(`⏳ Removing column: ${column}`);
      await db.run(`ALTER TABLE sms_logs DROP COLUMN ${column}`);
      console.log(`✅ Removed: ${column}`);
    }

    console.log('\n✅ SMS logs table simplified successfully!');
    console.log('\nNew sms_logs structure:');
    console.log('  - sms_id (Primary Key)');
    console.log('  - announcement_id (FK → announcements.announcement_id)');
    console.log('  - sent_to (FK → users.user_id)');
    console.log('  - status (Enum: Sent, Failed, Pending)');
    console.log('  - date_sent (Timestamp)');
    console.log('\nData is now normalized:');
    console.log('  - Phone number: Retrieved from users table via sent_to');
    console.log('  - Message: Retrieved from announcements table via announcement_id');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

simplifySmsLogs();
