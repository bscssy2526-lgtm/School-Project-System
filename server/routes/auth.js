const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/auth');
const { encryptPhoneNumber, maskEncryptedPhoneNumber } = require('../utils/encryption');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// Store OTP codes temporarily (in-memory, expires after 2 minutes)
const forgotPasswordOtps = new Map();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeOtp(username, otp) {
  forgotPasswordOtps.set(username, {
    otp,
    timestamp: Date.now(),
    expiresAt: Date.now() + 2 * 60 * 1000 // 2 minutes
  });
}

function verifyOtp(username, otp) {
  const stored = forgotPasswordOtps.get(username);
  if (!stored || Date.now() > stored.expiresAt) {
    return false;
  }
  return stored.otp === otp;
}

function clearOtp(username) {
  forgotPasswordOtps.delete(username);
}

// Dev only: sign in as first Admin with no password (disabled in production)
router.get('/dev-admin', async (req, res) => {
  const devAllowed = process.env.ALLOW_DEV_ADMIN === '1' || process.env.NODE_ENV !== 'production';
  if (!devAllowed) {
    return res.status(404).json({ error: 'Not available' });
  }
  console.log('Dev admin login requested');
  try {
    const user = await db.get(
      `SELECT u.user_id, up.f_name, up.l_name, u.username, u.password, u.role, up.student_id, 
              GROUP_CONCAT(CASE WHEN c.contact_type='phone' THEN c.contact_value ELSE NULL END) as phone_num,
              MAX(CASE WHEN c.contact_type='email' THEN 1 ELSE 0 END) as has_email,
              up.department, up.year_level, up.profile_path, u.change_pass, u.privacy_accepted
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       LEFT JOIN contacts c ON u.user_id = c.user_id
       WHERE u.role = 'Admin'
       GROUP BY u.user_id
       LIMIT 1`
    );
    if (!user) {
      return res.status(503).json({ error: 'No Admin user in database. Run npm run init-db first.' });
    }
    const token = jwt.sign(
      { user_id: user.user_id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    const { password: _, ...userWithoutPassword } = user;
    userWithoutPassword.name = [user.f_name, user.l_name].filter(Boolean).join(' ');
    userWithoutPassword.change_pass = !!user.change_pass;
    userWithoutPassword.has_email = !!user.has_email;
    userWithoutPassword.privacy_accepted = !!user.privacy_accepted;
    // Mask phone number for response
    if (userWithoutPassword.phone_num) {
      userWithoutPassword.phone_num = maskEncryptedPhoneNumber(userWithoutPassword.phone_num);
    }
    console.log('Dev admin OK: user_id=%s', user.user_id);
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login: all roles use username (students: username = student_id)
router.post('/login', async (req, res) => {
  console.log('POST /login received');
  try {
    const body = req.body || {};
    let { loginAs, username, studentId, password } = body;
    if (!username && (body.loginKey || '').trim()) username = body.loginKey;
    if (!studentId && (body.loginKeyStudent || '').trim()) studentId = body.loginKeyStudent;
    const uname = (username || studentId || '').trim();
    if (!password) {
      console.log('Login: missing password. Body keys received:', Object.keys(body));
      return res.status(400).json({ error: 'Password is required.' });
    }
    if (!uname) {
      console.log('Login: missing username. Body keys received:', Object.keys(body));
      return res.status(400).json({ error: 'Username is required (Student ID for students).' });
    }
    const user = await db.get(
      `SELECT u.user_id, up.f_name, up.l_name, u.username, u.password, u.role, up.student_id,
              GROUP_CONCAT(CASE WHEN c.contact_type='phone' THEN c.contact_value ELSE NULL END) as phone_num,
              MAX(CASE WHEN c.contact_type='email' THEN 1 ELSE 0 END) as has_email,
              up.department, up.year_level, up.profile_path, u.change_pass, u.privacy_accepted
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       LEFT JOIN contacts c ON u.user_id = c.user_id
       WHERE TRIM(u.username) = ?
       GROUP BY u.user_id
       LIMIT 1`,
      [uname]
    );

    if (!user) {
      console.log('Login: no user found for username', '(' + uname + ')');
      return res.status(401).json({
        error: 'No account with this username. Try admin1 / password123 or run npm run init-db.'
      });
    }
    if (!user.password || typeof user.password !== 'string') {
      console.error('Login: user has no password hash (user_id=%s)', user.user_id);
      return res.status(500).json({ error: 'Account error. Contact admin.' });
    }
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      console.log('Login: wrong password for user_id=%s', user.user_id);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log('Login OK: user_id=%s role=%s', user.user_id, user.role);

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    const { password: _, ...userWithoutPassword } = user;
    userWithoutPassword.name = [user.f_name, user.l_name].filter(Boolean).join(' ');
    userWithoutPassword.change_pass = !!user.change_pass;
    userWithoutPassword.has_email = !!user.has_email;
    userWithoutPassword.privacy_accepted = !!user.privacy_accepted;
    // Mask phone number for response
    if (userWithoutPassword.phone_num) {
      userWithoutPassword.phone_num = maskEncryptedPhoneNumber(userWithoutPassword.phone_num);
    }
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password: Send OTP
router.post('/forgot-password', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  try {
    const user = await db.get(
      `SELECT u.user_id, up.f_name, up.l_name, u.username, u.role
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE TRIM(u.username) = ? AND u.deleted_at IS NULL
       LIMIT 1`,
      [username.trim()]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Get user's email from contacts table
    const emailContact = await db.get(
      `SELECT contact_value FROM contacts WHERE user_id = ? AND contact_type = 'email' LIMIT 1`,
      [user.user_id]
    );

    if (!emailContact || !emailContact.contact_value) {
      return res.status(400).json({ error: 'No email registered for this account.' });
    }

    // Generate and store OTP
    const otp = generateOtp();
    storeOtp(username.trim(), otp);

    // Send OTP via email
    const fullName = [user.f_name, user.l_name].filter(Boolean).join(' ') || user.username;
    const emailSubject = 'Password Reset Code - Diaz College Announcement System';
    const emailBody = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Password Reset Request</h2>
          <p>Hi ${fullName},</p>
          <p>We received a request to reset your password. Use the following code to proceed:</p>
          <p style="font-size: 1.5rem; font-weight: bold; letter-spacing: 5px; margin: 1.5rem 0;">
            <code style="background: #f0f0f0; padding: 10px 15px; border-radius: 5px;">${otp}</code>
          </p>
          <p style="color: #666; font-size: 0.875rem;">This code is valid for 2 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <hr style="margin-top: 2rem; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 0.875rem; color: #666;">Diaz College Integrated Announcement Management System</p>
        </body>
      </html>
    `;

    try {
      await sendEmail(emailContact.contact_value, emailSubject, emailBody);
      console.log(`✓ OTP sent to ${emailContact.contact_value} for user ${user.user_id}`);
      res.json({ message: 'Verification code sent to your registered email.' });
    } catch (emailErr) {
      console.error('Failed to send OTP email:', emailErr);
      clearOtp(username.trim());
      res.status(500).json({ error: 'Failed to send code. Please try again.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password: Verify OTP and Reset Password
router.post('/verify-forgot-password', async (req, res) => {
  const { username, otp, newPassword } = req.body;

  if (!username || !otp || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const usernameTrim = username.trim();

    // Verify OTP
    if (!verifyOtp(usernameTrim, otp.trim())) {
      return res.status(400).json({ error: 'Invalid or expired code.' });
    }

    // Find user
    const user = await db.get(
      `SELECT u.user_id, u.username FROM users u WHERE TRIM(u.username) = ? AND u.deleted_at IS NULL`,
      [usernameTrim]
    );

    if (!user) {
      clearOtp(usernameTrim);
      return res.status(404).json({ error: 'User not found.' });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])(?=.{8,})/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with lowercase letter, number, and special character.'
      });
    }

    // Update password
    const hashed = bcrypt.hashSync(newPassword, 10);
    await db.run(
      'UPDATE users SET password = ?, change_pass = 0 WHERE user_id = ?',
      [hashed, user.user_id]
    );

    // Clear OTP
    clearOtp(usernameTrim);

    console.log(`✓ Password reset for user ${user.user_id}`);
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
