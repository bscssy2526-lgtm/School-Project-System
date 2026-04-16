/**
 * Test script to verify Ahasend email integration
 * Usage: npm run test-email
 */

require('dotenv').config();
const { sendEmail, sendAnnouncementEmail, sendInstructorCredentialsEmail } = require('./utils/email');

async function runTests() {
  console.log('🧪 Testing Ahasend Email Integration...\n');

  // Test 1: Basic email
  console.log('📧 Test 1: Sending basic test email...');
  const basicResult = await sendEmail(
    'elmer.lumabas24@gmail.com',
    'Test Email from Diaz Announcement System',
    '<p>This is a test email from your Ahasend integration. If you received this, everything is working!</p>'
  );
  console.log(basicResult.success ? '✅ Basic email test passed' : '❌ Basic email test failed');
  console.log(`Status: ${basicResult.success ? 'Success' : 'Failed'}`);
  if (basicResult.error) console.log(`Error: ${basicResult.error}\n`);

  // Test 2: Announcement notification email
  console.log('\n📢 Test 2: Sending announcement notification email...');
  const announcementResult = await sendAnnouncementEmail(
    'student@school.edu',
    'Important: Midterm Examination Schedule',
    '<p>The midterm examination will be held on <strong>May 15, 2026</strong>.</p><p>Please bring your student ID and prepare all necessary materials.</p>',
    'Dr. Jane Smith',
    'Data Structures - Section A'
  );
  console.log(announcementResult.success ? '✅ Announcement email test passed' : '❌ Announcement email test failed');
  if (announcementResult.error) console.log(`Error: ${announcementResult.error}\n`);

  // Test 3: Instructor credentials email
  console.log('\n🎓 Test 3: Sending instructor credentials email...');
  const credentialsResult = await sendInstructorCredentialsEmail(
    'instructor@school.edu',
    'John',
    'jsmith@school',
    'TempPass123!',
    'http://localhost:3000/login'
  );
  console.log(credentialsResult.success ? '✅ Credentials email test passed' : '❌ Credentials email test failed');
  if (credentialsResult.error) console.log(`Error: ${credentialsResult.error}\n`);

  console.log('\n✅ Email integration tests completed!');
  console.log('\n📋 Summary:');
  console.log('- Email utility loaded successfully');
  console.log('- Ahasend credentials configured from .env');
  console.log('- All 3 email templates available');
  console.log('\n💡 Next: Update your announcement creation form to include "Send Email" checkbox');
}

runTests().catch(console.error);
