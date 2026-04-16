# Email System Setup Guide - Ahasend Integration

Your email system is now configured and ready to use! Here's what's been set up:

## ✅ What Was Installed

1. **Email Utility Module** (`server/utils/email.js`)
   - Ahasend API v2 integration
   - 3 email template functions:
     - `sendEmail()` - Generic emails
     - `sendAnnouncementEmail()` - Formatted announcements
     - `sendInstructorCredentialsEmail()` - Account setup emails

2. **Routes Updated** (`server/routes/announcements.js`)
   - Announcements can now send email notifications
   - Supports both class and school-wide emails
   - Optional `send_email` flag in POST request

3. **NPM Scripts**
   - `npm run test-email` - Test email sending

## 🔧 Configuration Required

### Step 1: Verify Your Sending Domain with Ahasend

Email sent through Ahasend must come from a verified domain.

1. Log in to **Ahasend Dashboard**: https://dash.ahasend.com
2. Go to **Settings** → **Domains**
3. Click **Add Domain**
4. Enter your domain (e.g., `school.edu`, `announcements.yourschool.edu`)
5. Follow Ahasend's instructions to verify DNS records

### Step 2: Update .env with Your Domain

After verifying your domain, update `server/.env`:

```env
AHASEND_FROM_EMAIL=noreply@yourdomain.com
AHASEND_FROM_NAME=School Announcement System
```

Replace `yourdomain.com` with your verified domain.

### Step 3: Test Email Sending

```bash
npm run test-email
```

Once your domain is verified, all tests should return ✅ Success.

## 📧 Using the Email System

### Send Emails with Class Announcements

When creating an announcement in the dashboard, check the **"Send Email"** checkbox to notify students.

### API Endpoint

```bash
POST /api/announcements
Content-Type: application/json

{
  "title": "Important Announcement",
  "content": "This is the announcement content",
  "class_id": 1,              // optional, for class announcement
  "send_email": true,         // set to true to send emails
  "send_sms": false           // optionally send SMS too
}
```

### Response Includes Email Stats

```json
{
  "announcement_id": 5,
  "title": "Important Announcement",
  "emailStats": {
    "sent": 45,
    "failed": 2,
    "total": 47
  }
}
```

## 📋 Email Templates

### 1. Announcement Notification Email
- **Triggered when**: Admin/Instructor posts announcement with `send_email` flag
- **Sent to**: All enrolled students (class) or all students (school-wide)
- **Contains**: Title, content, author name, class name
- **Default styling**: Professional HTML with school branding

### 2. Instructor Credentials Email
- **Used for**: New instructor account creation
- **Sent to**: Instructor's email address
- **Contains**: Username, temporary password, login URL
- **Features**: Warns about change password requirement on first login

### 3. Generic Email
- **Function**: `sendEmail(to, subject, htmlBody)`
- **Use case**: Any custom email needs

## 🔐 Security Notes

- API credentials are stored in `.env` (never commit this file!)
- Each email is sent individually (secure, no CC'd recipients)
- Email log is accessible via Ahasend dashboard
- Supports email tracking and webhooks (optional)

## 📊 Monitoring Emails

Visit your Ahasend Dashboard to:
- View delivery status
- Track open rates and clicks
- Check bounce and complaint reports
- Review detailed logs

## 🚀 Next Steps

1. **Verify your domain** with Ahasend
2. **Update AHASEND_FROM_EMAIL** in `.env`
3. **Run `npm run test-email`** to confirm it works
4. **Update UI** to add "Send Email" checkbox to announcement forms
5. **Enable email notifications** when posting announcements

## ⚠️ Troubleshooting

### "domain not found" error
- Your domain hasn't been verified with Ahasend yet
- Go to dashboard and add/verify your domain

### Emails not being sent
- Check that AHASEND_FROM_EMAIL uses a verified domain
- Verify API credentials in `.env`
- Check Ahasend dashboard for error logs

### Need Support?
- Ahasend Support: support@ahasend.com
- Ahasend Docs: https://www.ahasend.com/docs
- API Reference: https://www.ahasend.com/docs/api-reference

---

**Email system is ready!** Once you verify your domain, emails will be sent automatically when you check "Send Email" on announcements.
