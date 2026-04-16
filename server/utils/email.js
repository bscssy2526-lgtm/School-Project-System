const https = require('https');

// Ahasend API v2 configuration
const AHASEND_ACCOUNT_ID = process.env.AHASEND_ACCOUNT_ID;
const AHASEND_SECRET_KEY = process.env.AHASEND_SECRET_KEY;
const AHASEND_FROM_EMAIL = process.env.AHASEND_FROM_EMAIL || 'noreply@announcement-system.edu';
const AHASEND_FROM_NAME = process.env.AHASEND_FROM_NAME || 'School Announcement System';

/**
 * Send email using Ahasend v2 API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body (HTML)
 * @returns {Promise<Object>} Response from Ahasend API
 */
async function sendEmail(to, subject, body) {
  if (!AHASEND_ACCOUNT_ID || !AHASEND_SECRET_KEY) {
    console.error('❌ Ahasend credentials not configured');
    return { success: false, error: 'Email service not configured' };
  }

  const emailData = {
    from: {
      email: AHASEND_FROM_EMAIL,
      name: AHASEND_FROM_NAME
    },
    recipients: [
      {
        email: to,
        name: to.split('@')[0] // Use part before @ as name if not provided
      }
    ],
    subject: subject,
    html_content: body
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(emailData);

    const options = {
      hostname: 'api.ahasend.com',
      port: 443,
      path: `/v2/accounts/${AHASEND_ACCOUNT_ID}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${AHASEND_SECRET_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 202) {
            console.log(`✅ Email sent to ${to}`);
            resolve({ success: true, data: response });
          } else {
            console.error(`❌ Email send failed: ${res.statusCode}`, response);
            resolve({ success: false, error: response.message || response.status || 'Email send failed' });
          }
        } catch (err) {
          console.error('❌ Error parsing response:', err);
          console.error('Raw response:', data);
          resolve({ success: false, error: 'Failed to parse response' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Email request error:', err);
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Send announcement notification email
 * @param {string} to - Recipient email
 * @param {string} announcementTitle - Title of announcement
 * @param {string} announcementContent - Content of announcement
 * @param {string} authorName - Name of announcement author
 * @param {string} className - Name of class (if applicable)
 */
async function sendAnnouncementEmail(to, announcementTitle, announcementContent, authorName, className = 'School-wide') {
  const subject = `New Announcement: ${announcementTitle}`;
  
  const body = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .footer { font-size: 0.85em; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
          .announcement-title { color: #4CAF50; margin: 15px 0 10px 0; }
          .class-badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 5px 10px; border-radius: 3px; font-size: 0.9em; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📢 New Announcement</h1>
            <p style="margin: 5px 0 0 0;">From ${AHASEND_FROM_NAME}</p>
          </div>
          
          <div class="content">
            <p>Hello,</p>
            
            <div class="class-badge">${className}</div>
            
            <h2 class="announcement-title">${announcementTitle}</h2>
            
            <div style="background: white; padding: 15px; border-left: 4px solid #4CAF50;">
              ${announcementContent}
            </div>
            
            <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
              <strong>Posted by:</strong> ${authorName}
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from the School Announcement System.</p>
            <p>Please do not reply to this email. For inquiries, contact your administrator.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail(to, subject, body);
}

/**
 * Send account credentials email
 * @param {string} to - Instructor email
 * @param {string} firstName - First name
 * @param {string} username - Login username
 * @param {string} tempPassword - Temporary password
 * @param {string} loginUrl - Login page URL
 */
async function sendInstructorCredentialsEmail(to, firstName, username, tempPassword, loginUrl = 'http://localhost:3000/login') {
  const subject = 'Your Instructor Account Credentials';
  
  const body = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1976d2; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .footer { font-size: 0.85em; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
          .credentials-box { background: white; padding: 15px; border: 2px solid #ff9800; border-radius: 5px; margin: 15px 0; font-family: monospace; }
          .credentials-item { margin: 10px 0; }
          .label { color: #666; font-size: 0.9em; }
          .value { color: #000; font-weight: bold; word-break: break-all; }
          .warning { background: #fff3cd; border-left: 4px solid #ff9800; padding: 10px; margin: 15px 0; border-radius: 3px; }
          .button { display: inline-block; background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">👋 Welcome to ${AHASEND_FROM_NAME}</h1>
          </div>
          
          <div class="content">
            <p>Hello ${firstName},</p>
            
            <p>Your instructor account has been created successfully. Here are your login credentials:</p>
            
            <div class="credentials-box">
              <div class="credentials-item">
                <div class="label">📧 Username:</div>
                <div class="value">${username}</div>
              </div>
              <div class="credentials-item">
                <div class="label">🔑 Temporary Password:</div>
                <div class="value">${tempPassword}</div>
              </div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> This is a temporary password. You will be required to change it upon your first login.
            </div>
            
            <h3>🚀 How to Login:</h3>
            <ol>
              <li>Visit: <a href="${loginUrl}" class="button">${loginUrl}</a></li>
              <li>Enter your username and temporary password</li>
              <li>Create a new secure password</li>
              <li>You're all set!</li>
            </ol>
            
            <p style="margin-top: 20px; color: #666;">
              <strong>Need help?</strong> Contact your school administrator for support.
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail(to, subject, body);
}

module.exports = {
  sendEmail,
  sendAnnouncementEmail,
  sendInstructorCredentialsEmail
};
