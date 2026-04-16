const db = require('../db');

const RETENTION_PERIOD_YEARS = 4;
const RETENTION_PERIOD_DAYS = RETENTION_PERIOD_YEARS * 365;

/**
 * Clean up expired phone numbers based on retention policy
 * Phone numbers older than 4 years are deleted
 * Optionally can be called via cron job or scheduled task
 */
async function cleanupExpiredPhoneNumbers() {
  try {
    console.log('Starting phone number retention cleanup...');
    console.log(`Retention period: ${RETENTION_PERIOD_YEARS} years (${RETENTION_PERIOD_DAYS} days)`);
    console.log(`Current date/time: ${new Date()}\n`);

    // First, show all users with phone numbers
    console.log('All users with phone numbers:');
    const allUsers = await db.query(
      `SELECT user_id, f_name, l_name, phone_num, phone_added, phone_expire,
              DATE_ADD(phone_added, INTERVAL 4 YEAR) as calculated_expire,
              CASE WHEN DATE_ADD(phone_added, INTERVAL 4 YEAR) < NOW() THEN 'EXPIRED' ELSE 'ACTIVE' END as status
       FROM users 
       WHERE phone_num IS NOT NULL`
    );
    
    if (allUsers.length === 0) {
      console.log('  (No users with phone numbers found)\n');
    } else {
      allUsers.forEach(row => {
        console.log(`  User ${row.user_id}: ${row.f_name} ${row.l_name}`);
        console.log(`    phone_added: ${row.phone_added}`);
        console.log(`    phone_expire: ${row.phone_expire}`);
        console.log(`    calculated_expire: ${row.calculated_expire}`);
        console.log(`    status: ${row.status}\n`);
      });
    }

    // Get count of expired phone numbers
    const expiredCount = await db.get(
      `SELECT COUNT(*) as count FROM users 
       WHERE phone_num IS NOT NULL 
       AND phone_added IS NOT NULL 
       AND DATE_ADD(phone_added, INTERVAL 4 YEAR) < NOW()`
    );

    console.log(`Expired phone numbers found: ${expiredCount?.count || 0}\n`);

    if (expiredCount && expiredCount.count > 0) {
      console.log(`Found ${expiredCount.count} expired phone number(s)`);

      // Delete expired phone numbers and clear the retention fields
      const result = await db.run(
        `UPDATE users 
         SET phone_num = NULL, 
             phone_added = NULL, 
             phone_expire = NULL 
         WHERE phone_num IS NOT NULL 
         AND phone_added IS NOT NULL 
         AND DATE_ADD(phone_added, INTERVAL 4 YEAR) < NOW()`
      );

      console.log(`✓ Cleared ${result.affectedRows} expired phone number(s)`);
    } else {
      console.log('No expired phone numbers found');
    }

    // Log the next expiration dates
    const nextExpiring = await db.query(
      `SELECT user_id, f_name, l_name, phone_expire 
       FROM users 
       WHERE phone_num IS NOT NULL 
       AND phone_expire IS NOT NULL 
       ORDER BY phone_expire ASC 
       LIMIT 5`
    );

    if (nextExpiring.length > 0) {
      console.log('\nNext phone numbers to expire:');
      nextExpiring.forEach((row) => {
        const daysLeft = Math.ceil(
          (new Date(row.phone_expire) - new Date()) / (1000 * 60 * 60 * 24)
        );
        console.log(
          `  - ${row.f_name} ${row.l_name} (user_id=${row.user_id}): expires in ${daysLeft} days`
        );
      });
    }

    console.log('\n✓ Cleanup completed!');
    return { success: true, cleanedUpCount: expiredCount?.count || 0 };
  } catch (error) {
    console.error('Cleanup failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the function if this script is called directly
if (require.main === module) {
  cleanupExpiredPhoneNumbers().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { cleanupExpiredPhoneNumbers };
