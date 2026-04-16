const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/auth');
const { encryptPhoneNumber, maskEncryptedPhoneNumber } = require('../utils/encryption');
const { sendEmail } = require('../utils/email');

const router = express.Router();

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return '';
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
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

// Forgot password: send OTP to user's registered email
router.post('/forgot-password/send-otp', async (req, res) => {
  try {
    const username = (req.body?.username || '').trim();
    if (!username) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const user = await db.get(
      `SELECT u.user_id, u.username, c.contact_value AS email
       FROM users u
       LEFT JOIN contacts c
         ON c.user_id = u.user_id
        AND c.contact_type = 'email'
       WHERE TRIM(u.username) = ?
         AND u.deleted_at IS NULL
       LIMIT 1`,
      [username]
    );

    if (!user) {
      return res.status(404).json({ error: 'No account found for this username.' });
    }
    if (!user.email || !String(user.email).trim()) {
      return res.status(400).json({ error: 'This account has no registered email.' });
    }

    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    const subject = 'Password Reset OTP - Diaz College Announcement System';
    const body = `
      <h2>Password Reset Request</h2>
      <p>We received a password reset request for your account <strong>${user.username}</strong>.</p>
      <p>Your OTP code is: <strong style="font-size: 1.5em; color: #3b82f6;">${otpCode}</strong></p>
      <p style="color: #666;">This code is valid for 10 minutes. If you did not request this, you can ignore this email.</p>
      <p style="margin-top: 2rem; font-size: 0.9em; color: #999;">Diaz College Announcement System</p>
    `;
    const emailResult = await sendEmail(user.email.trim(), subject, body);
    if (!emailResult.success) {
      return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }

    req.session.forgotPasswordOtp = {
      user_id: user.user_id,
      username: user.username,
      email: user.email.trim(),
      otp_code: otpCode,
      expiresAt,
      attempts: 0,
      verified: false
    };

    return res.json({
      message: 'OTP sent to your registered email.',
      email: maskEmail(user.email.trim()),
      expiresIn: 600
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Forgot password: verify OTP
router.post('/forgot-password/verify-otp', async (req, res) => {
  try {
    const username = (req.body?.username || '').trim();
    const otpCode = (req.body?.otp_code || '').trim();
    if (!username) return res.status(400).json({ error: 'Username is required.' });
    if (!otpCode) return res.status(400).json({ error: 'OTP code is required.' });

    const pending = req.session.forgotPasswordOtp;
    if (!pending) {
      return res.status(400).json({ error: 'No pending OTP. Request a new one.' });
    }
    if (pending.username !== username) {
      return res.status(400).json({ error: 'Username does not match OTP request.' });
    }
    if (Date.now() > pending.expiresAt) {
      delete req.session.forgotPasswordOtp;
      return res.status(400).json({ error: 'OTP has expired. Request a new one.' });
    }
    if (pending.attempts >= 3) {
      delete req.session.forgotPasswordOtp;
      return res.status(400).json({ error: 'Too many failed attempts. Request a new OTP.' });
    }
    if (pending.otp_code !== otpCode) {
      pending.attempts += 1;
      const remaining = Math.max(0, 3 - pending.attempts);
      return res.status(400).json({ error: `Invalid OTP code. ${remaining} attempts remaining.` });
    }

    pending.verified = true;
    return res.json({ message: 'OTP verified. You can now set a new password.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Forgot password: reset password after OTP verification
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const username = (req.body?.username || '').trim();
    const newPassword = req.body?.new_password || '';

    if (!username) return res.status(400).json({ error: 'Username is required.' });
    if (!newPassword) return res.status(400).json({ error: 'New password is required.' });
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must include at least one letter and one number.' });
    }

    const pending = req.session.forgotPasswordOtp;
    if (!pending || !pending.verified) {
      return res.status(400).json({ error: 'Verify OTP first before resetting password.' });
    }
    if (pending.username !== username) {
      return res.status(400).json({ error: 'Username does not match OTP request.' });
    }
    if (Date.now() > pending.expiresAt) {
      delete req.session.forgotPasswordOtp;
      return res.status(400).json({ error: 'OTP session expired. Request a new OTP.' });
    }

    const user = await db.get(
      `SELECT user_id FROM users WHERE TRIM(username) = ? AND deleted_at IS NULL LIMIT 1`,
      [username]
    );
    if (!user) {
      delete req.session.forgotPasswordOtp;
      return res.status(404).json({ error: 'User not found.' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await db.run(
      `UPDATE users SET password = ?, change_pass = 0 WHERE user_id = ?`,
      [hash, user.user_id]
    );

    delete req.session.forgotPasswordOtp;
    return res.json({ message: 'Password reset successful. You may now log in.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
