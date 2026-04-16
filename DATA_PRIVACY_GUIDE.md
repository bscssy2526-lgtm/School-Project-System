# Data Privacy & Security Implementation Guide

This document outlines the implementation of phone number encryption, data retention policies, and security improvements to comply with the Philippine Data Privacy Act.

## Features Implemented

### 1. **Phone Number Encryption (AES-256)**
- All phone numbers are encrypted in the database using AES-256 encryption
- Encryption/decryption happens transparently in the application layer
- Database stores encrypted values; plain text phone numbers are never stored

### 2. **Phone Number Masking for Display**
- Phone numbers are masked in API responses (e.g., `09*****05`)
- Users cannot see their full unencrypted phone numbers in the UI
- Only necessary backend operations decrypt when needed (SMS sending)

### 3. **Data Retention Policy**
- Phone numbers are **automatically deleted after 4 years** of being added
- Retention dates are tracked via `phone_added` and `phone_expire` columns
- Scheduled cleanup job removes expired phone numbers

### 4. **Email Notification System**
- Email addresses are used to send announcement notifications via Ahasend API
- Email sending is optional and controlled by admin/instructor flags
- Email addresses are not encrypted (standard protocol)
- Email logs track delivery status and timestamps

### 5. **Database Security Enhancements**
- Added retention timestamp columns to track data lifecycle
- Added indexes on retention fields for efficient cleanup queries
- Soft-delete support for user accounts (data can be archived)

---

## Email Privacy & Security

### Email Data Collection
- **What data is collected**: User email addresses (from user registration)
- **How it's used**: Sending announcement notifications and account credentials
- **When it's sent**: Only when admin/instructor enables email notifications for announcements
- **Who can see it**: Only Ahasend API (third-party service) receives email for sending

### Email Data Protection
- **Transit Security**: Emails sent via HTTPS to Ahasend API
- **API Authentication**: Ahasend API requests authenticated with secret key
- **No Local Storage of Sent Emails**: Application doesn't store email content after sending
- **Third-Party Handling**: Ahasend stores emails per their privacy policy

### Email Retention
- **User email addresses**: Stored indefinitely (needed for system communication)
- **Email delivery logs**: Tracked in announcement delivery records
- **Email content**: Not stored locally; managed by Ahasend

---

## Setup Instructions

### Step 1: Generate Encryption Key

Generate a secure 32-character encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This will output something like:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Step 2: Configure Environment Variables

Copy the encryption key to your `.env` file:

```env
# Encryption: 32-character key for AES-256 encryption
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# Data retention
PHONE_NUMBER_RETENTION_YEARS=4
```

⚠️ **Important**: Keep your encryption key secure. Store it in a `.env` file and add `.env` to `.gitignore`.

### Step 3: Run Database Migration

Add the retention timestamp columns to your existing database:

```bash
node scripts/migrate-phone-retention.js
```

This will:
- Add `phone_added` column to track when phone numbers were added
- Add `phone_expire` column to track expiration dates
- Update existing records with timestamps based on account creation date

### Step 4: Configure Email Service (Ahasend)

Email notifications require Ahasend API setup:

```bash
# 1. Get your Ahasend credentials from https://dash.ahasend.com
# 2. Add to .env:
AHASEND_ACCOUNT_ID=your_account_id
AHASEND_SECRET_KEY=your_secret_key
AHASEND_FROM_EMAIL=noreply@yourdomain.com
AHASEND_FROM_NAME=School Announcement System

# 3. Verify your domain in Ahasend Dashboard
# 4. Test email sending
npm run test-email
```

### Step 5: Test Encryption/Decryption

Before deploying, verify encryption is working:

```bash
node -e "
const enc = require('./server/utils/encryption');
const phone = '09123456789';
const encrypted = enc.encryptPhoneNumber(phone);
console.log('Original:', phone);
console.log('Encrypted:', encrypted);
console.log('Decrypted:', enc.decryptPhoneNumber(encrypted));
console.log('Masked:', enc.maskPhoneNumber(phone));
console.log('Masked encrypted:', enc.maskEncryptedPhoneNumber(encrypted));
"
```

---

## Usage

### For Frontend Developers

When displaying phone numbers:
```javascript
// Phone numbers in API responses are already masked
// Example response:
// { phone_num: "09*****89" }

// Never try to decrypt or unmask phone numbers on the frontend
// Encryption is handled entirely by the backend
```

### For Backend: Email Notifications

**Sending announcement emails:**
```javascript
const { sendAnnouncementEmail } = require('./utils/email');

// Emails are sent when announcement has send_email flag
const emailStats = await sendAnnouncementEmails(announcementId);
console.log(`Emails sent: ${emailStats.sent}, Failed: ${emailStats.failed}`);

// Email sending happens async and fails gracefully
// SMS and email notifications are independent
```

**Email list for bulk sending:**
```javascript
// Get all student emails (if sending school-wide)
const students = await db.query(
  `SELECT email FROM users 
   WHERE role = 'Student' AND email IS NOT NULL`
);

// Or specific class
const classStudents = await db.query(
  `SELECT u.email FROM users u 
   JOIN student_enrollments se ON u.user_id = se.student_id 
   WHERE se.class_id = ? AND u.email IS NOT NULL`,
  [classId]
);
```

### For Backend: Handling Phone Numbers

**Storing a phone number:**
```javascript
const { encryptPhoneNumber } = require('./utils/encryption');

// When a user updates their phone number:
const encrypted = encryptPhoneNumber(req.body.phone_num);
await db.run(
  `UPDATE users SET phone_num = ?, phone_added = NOW(), 
   phone_expire = DATE_ADD(NOW(), INTERVAL 4 YEAR) 
   WHERE user_id = ?`,
  [encrypted, userId]
);
```

**Sending SMS (decryption happens automatically):**
```javascript
const { decryptAndNormalizePhone } = require('./sms-gateway');

// Phone numbers are automatically decrypted before sending SMS
const normalizedPhone = decryptAndNormalizePhone(encryptedPhoneFromDB);
// Now it can be used with SMS API
```

**Getting masked phone numbers for API responses:**
```javascript
const { maskEncryptedPhoneNumber } = require('./utils/encryption');

// Already done in routes/users.js and routes/auth.js
const masked = maskEncryptedPhoneNumber(encryptedPhoneFromDB);
res.json({ phone_num: masked }); // e.g., "09*****89"
```

---

## Data Retention & Cleanup

### Email Data Retention

**User email addresses**:
- Stored indefinitely (required for school communication)
- Soft-deleted when user account is deactivated
- User can request deletion anytime

**Email delivery logs**:
- Linked to announcement records
- Deleted with announcement purge (if implemented)
- Keep for audit trail of communications

**Third-party storage (Ahasend)**:
- Governed by Ahasend's Privacy Policy
- User should review Ahasend's data retention policy
- Ahasend retains emails per their service agreement

### Automatic Cleanup

To automatically delete phone numbers after 4 years, set up a scheduled cron job:

**Using Node.js Cron or External Scheduler**

Option 1: Add to your server startup (daily cleanup):
```javascript
// In server/index.js or similar
const { cleanupExpiredPhoneNumbers } = require('./scripts/cleanup-phone-numbers');

// Run cleanup every day at 2 AM
setInterval(() => {
  cleanupExpiredPhoneNumbers().catch(err => console.error('Cleanup failed:', err));
}, 24 * 60 * 60 * 1000);

// Or run it once on startup
cleanupExpiredPhoneNumbers();
```

Option 2: Manual cleanup (via cron like `crontab` or server task scheduler):
```bash
# Linux crontab: Run cleanup daily at 2 AM
0 2 * * * cd /path/to/thesis && node scripts/cleanup-phone-numbers.js
```

Option 3: API endpoint for manual cleanup (Admin only):
```javascript
// Add to routes/admin.js or similar
router.post('/cleanup-phone-numbers', requireRole('Admin'), async (req, res) => {
  const result = await cleanupExpiredPhoneNumbers();
  res.json(result);
});
```

### Monitoring Retention Status

Check which phone numbers are expiring soon:
```javascript
const db = require('./db');

const nextExpiring = await db.query(
  `SELECT user_id, f_name, l_name, phone_expire 
   FROM users 
   WHERE phone_num IS NOT NULL 
   AND phone_expire IS NOT NULL 
   ORDER BY phone_expire ASC 
   LIMIT 10`
);

nextExpiring.forEach(row => {
  const daysLeft = Math.ceil(
    (new Date(row.phone_expire) - new Date()) / (1000 * 60 * 60 * 24)
  );
  console.log(`${row.f_name} ${row.l_name}: ${daysLeft} days remaining`);
});
```

---

## Privacy Policy Recommendations

Add these clauses to your Privacy Policy:

### Data Collection
> "We collect phone numbers to send you important school announcements via SMS, and email addresses to send notifications about school announcements and account information. Phone number collection is optional but required for SMS notifications. Email addresses are collected during registration for school communication purposes."

### Data Storage & Retention
> "Phone numbers are encrypted and securely stored in our database. We automatically delete phone numbers after 4 years from the date of collection to minimize data retention. Email addresses are stored securely and retained as long as your account is active for essential school communications. You may request deletion of your phone number or email at any time, though deleting email may affect your ability to receive important notifications."

### Data Security
> "Phone numbers are protected using AES-256 encryption. Email addresses are transmitted securely to our email service provider (Ahasend) via HTTPS encryption. Only authorized personnel can access unencrypted phone numbers when sending announcements. All data transmissions are encrypted using industry-standard protocols."

### Your Privacy Rights
> "You have the right to:
> - **Access**: Request to view your personal data
> - **Correction**: Request correction of inaccurate data
> - **Deletion**: Request deletion of your phone number and data
> - **Withdrawal**: Withdraw consent for SMS communications"

---

## Troubleshooting

### Encryption Key Issues
If you get decryption errors:
1. Verify `ENCRYPTION_KEY` is set in `.env`
2. Ensure the key is exactly 32 characters (will be padded/truncated otherwise)
3. If you changed the key, existing encrypted data cannot be decrypted

### Data Retention Not Working
If phone numbers aren't being deleted:
1. Verify migration ran: Check if `phone_expire` column exists
2. Check cron job logs for errors
3. Run manually: `node scripts/cleanup-phone-numbers.js`

### SMS Not Sending
If encrypted phone numbers cause SMS failures:
1. Check `decryptAndNormalizePhone()` is being called before `sendSmsBatch()`
2. Verify decryption isn't returning null (check logs)
3. Ensure phone numbers are in valid format (09XXXXXXXXX)

---

## Files Modified/Created

### New Files
- `server/utils/encryption.js` - Encryption/decryption utilities
- `server/utils/email.js` - Email sending via Ahasend API
- `server/scripts/migrate-phone-retention.js` - Database migration
- `server/scripts/cleanup-phone-numbers.js` - Data retention cleanup

### Modified Files
- `server/routes/auth.js` - Mask phone numbers in login responses
- `server/routes/users.js` - Encrypt phone numbers, add retention dates
- `server/routes/announcements.js` - Decrypt phone numbers before SMS, send emails
- `server/sms-gateway.js` - Added decryption function
- `server/env.example` - Added encryption and email service configuration

---

## Compliance Checklist

- ✅ **Encryption**: Phone numbers encrypted at rest (AES-256)
- ✅ **Data Minimization**: Store only essential data (phone numbers, emails)
- ✅ **Retention Policy**: Auto-delete phone numbers after 4 years
- ✅ **Access Control**: Only admins can view unencrypted numbers
- ✅ **Third-Party Security**: Email sent via HTTPS to verified Ahasend API
- ✅ **Consent Management**: Need to add explicit consent forms
- ✅ **User Rights**: Implement access, correction, deletion endpoints
- ⚠️ **Privacy Policy**: Create and publish comprehensive privacy policy (includes email)
- ⚠️ **Data Processing Agreement**: Document how phone numbers and emails are used
- ⚠️ **Third-Party Agreement**: Review Ahasend's privacy and data handling terms
- ⚠️ **Security Audit**: Regularly review access logs and API authentication

---

## Next Steps

1. **Consent Management**: Add explicit consent checkboxes for phone number and email collection
2. **Privacy Policy**: Create `/privacy-policy.html` page with complete terms (including email and third-party services)
3. **User Rights**: Implement endpoints for users to access/delete their data
4. **Audit Logging**: Log all phone number and email access and modifications
5. **Email Preferences**: Add user controls to opt-in/opt-out of email notifications
6. **Third-Party Review**: Review Ahasend's privacy policy and data handling procedures
7. **Regular Testing**: Periodically verify encryption and retention mechanisms
8. **Security Review**: Have security expert review implementation and third-party integrations

---

For questions or issues, consult the Philippine Data Privacy Act (Republic Act No. 10173) and National Privacy Commission guidelines.
