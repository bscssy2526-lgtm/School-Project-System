const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { sendSms } = require('../sms-gateway');
const { sendEmail } = require('../utils/email');
const { encryptPhoneNumber, decryptPhoneNumber, maskEncryptedPhoneNumber } = require('../utils/encryption');
const { validatePassword } = require('../utils/passwordValidator');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(auth);

// Capitalize name: first letter uppercase, rest lowercase
function capitalizeName(name) {
  if (!name) return '';
  return name.trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

// Parse birthday from various formats (Excel serial, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.)
function parseBirthday(value) {
  if (!value) return null;

  const val = value.toString().trim();
  if (!val) return null;

  // Handle Excel serial numbers (numeric)
  if (!isNaN(val) && val !== '') {
    const serial = parseInt(val, 10);
    // Excel serial date: days since 1900-01-01, but with a leap year bug (1900 is not a leap year but Excel thinks it is)
    if (serial > 0 && serial < 60000) { // Reasonable range for birthdates
      const excelEpoch = new Date('1899-12-30'); // Excel's epoch adjusted for the leap year bug
      const date = new Date(excelEpoch.getTime() + serial * 86400000);
      if (!isNaN(date.getTime())) {
        return formatDateISO(date);
      }
    }
  }

  // Try parsing as string with common formats
  // Try DD/MM/YYYY or D/M/YYYY
  let match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (isValidDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try MM/DD/YYYY (American format) - only if day > 12 to disambiguate from DD/MM/YYYY
  match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (month <= 12 && day <= 31 && isValidDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try YYYY-MM-DD
  match = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (isValidDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try DDMMMYYYY or similar with month names
  match = val.match(/^(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*(\d{4})$/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthName = match[2].toLowerCase();
    const year = parseInt(match[3], 10);
    const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const month = months[monthName];
    if (isValidDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

// Helper: format date to YYYY-MM-DD
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: validate if a date is valid
function isValidDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

// Generate a username using a six-digit sequence + initials, e.g. 000001JS
async function generateUniqueUsername(f_name, l_name) {
  const first = (f_name || '').toString().trim();
  const last = (l_name || '').toString().trim();
  const clean = (s) => (s || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  const f = clean(first);
  const l = clean(last);

  let initials = '';
  if (f && l) initials = (f[0] + l[0]);
  else if (f.length >= 2) initials = f.slice(0, 2);
  else if (l.length >= 2) initials = l.slice(0, 2);
  else initials = (f + l + 'XX').slice(0, 2);

  const base = initials; // e.g. 'JS'

  // Find existing usernames that end with the base and extract numeric prefixes
  const rows = await db.query('SELECT username FROM users WHERE username LIKE ?', ['%' + base]);
  let maxNum = 0;
  const re = new RegExp('^(\\d{6})' + base + '$');
  for (const r of rows) {
    const uname = (r.username || '').toString();
    const m = uname.match(re);
    if (m) {
      const num = parseInt(m[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }

  let next = maxNum + 1;
  while (true) {
    const prefix = String(next).padStart(6, '0');
    const candidate = prefix + base; // number before initials
    const exists = await db.get('SELECT user_id FROM users WHERE username = ?', [candidate]);
    if (!exists) return candidate;
    next += 1;
  }
}

// List users with filtering (Admin only)
router.get('/', async (req, res) => {
  try {
    // Instructors can only fetch students for enrollment
    if (req.user.role === 'Instructor' && req.query.role && req.query.role !== 'Student') {
      return res.status(403).json({ error: 'Instructors can only fetch students' });
    }
    // Only Admin can see all roles; Instructors can only see Students
    if (req.user.role !== 'Admin' && !req.query.role) {
      req.query.role = 'Student';
    }
    if (req.user.role !== 'Admin' && req.query.role !== 'Student') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const { search, role, department, year_level } = req.query;
    // pagination parameters (optional)
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = null; // null means no pagination

    // build base WHERE clause and params
    let where = `WHERE u.deleted_at IS NULL`;
    const params = [];

    // Search by name or username/student_id
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      where += ` AND (up.f_name LIKE ? OR up.l_name LIKE ? OR u.username LIKE ? OR up.student_id LIKE ?)`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Filter by role
    if (role && ['Student', 'Instructor', 'Admin'].includes(role)) {
      where += ` AND u.role = ?`;
      params.push(role);
    }

    // Filter by department (only for students)
    if (department && ['BSBA', 'BSCS', 'BSED', 'BEED'].includes(department)) {
      where += ` AND up.department = ? AND u.role = 'Student'`;
      params.push(department);
    }

    // Filter by year level (only for students)
    if (year_level && ['1st', '2nd', '3rd', '4th'].includes(year_level)) {
      where += ` AND up.year_level = ? AND u.role = 'Student'`;
      params.push(year_level);
    }

    const order = ` ORDER BY up.l_name, up.f_name`;

    // if pagination requested, return metadata
    if (limit) {
      // count total matching rows
      const countRow = await db.get(`SELECT COUNT(DISTINCT u.user_id) AS cnt FROM users u LEFT JOIN user_profiles up ON u.user_id = up.user_id ${where}`, params);
      const total = countRow ? countRow.cnt : 0;
      const offset = (page - 1) * limit;
      const dataQuery = `SELECT u.user_id, up.f_name, up.l_name, u.username, u.role, up.student_id, GROUP_CONCAT(CASE WHEN c.contact_type='phone' THEN c.contact_value ELSE NULL END) as phone_num, up.department, up.year_level, up.profile_path, u.created_at
                         FROM users u LEFT JOIN user_profiles up ON u.user_id = up.user_id LEFT JOIN contacts c ON u.user_id = c.user_id ${where} GROUP BY u.user_id ${order} LIMIT ? OFFSET ?`;
      const dataParams = params.concat([limit, offset]);
      const users = await db.query(dataQuery, dataParams);
      users.forEach(u => { 
        u.name = [u.f_name, u.l_name].filter(Boolean).join(' '); 
        // Mask phone number for security
        if (u.phone_num) {
          u.phone_num = maskEncryptedPhoneNumber(u.phone_num);
        }
      });
      return res.json({ data: users, total, page, limit });
    }

    // otherwise return full list
    const qry = `SELECT u.user_id, up.f_name, up.l_name, u.username, u.role, up.student_id, GROUP_CONCAT(CASE WHEN c.contact_type='phone' THEN c.contact_value ELSE NULL END) as phone_num, up.department, up.year_level, up.profile_path, u.created_at
                 FROM users u LEFT JOIN user_profiles up ON u.user_id = up.user_id LEFT JOIN contacts c ON u.user_id = c.user_id ${where} GROUP BY u.user_id ${order}`;
    const users = await db.query(qry, params);
    users.forEach(u => { 
      u.name = [u.f_name, u.l_name].filter(Boolean).join(' '); 
      // Mask phone number for security
      if (u.phone_num) {
        u.phone_num = maskEncryptedPhoneNumber(u.phone_num);
      }
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const user = await db.get(
      `SELECT u.user_id, up.f_name, up.m_name, up.l_name, up.birthday, u.username, u.role, up.student_id, 
              GROUP_CONCAT(CASE WHEN c.contact_type='phone' THEN c.contact_value ELSE NULL END) as phone_num,
              GROUP_CONCAT(CASE WHEN c.contact_type='email' THEN c.contact_value ELSE NULL END) as email,
              MAX(CASE WHEN c.contact_type='email' THEN 1 ELSE 0 END) as has_email,
              up.department, up.year_level, up.profile_path, u.change_pass, u.created_at, u.privacy_accepted
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       LEFT JOIN contacts c ON u.user_id = c.user_id
       WHERE u.user_id = ? AND u.deleted_at IS NULL
       GROUP BY u.user_id`,
      [req.user.user_id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.name = [user.f_name, user.l_name].filter(Boolean).join(' ');
    user.change_pass = !!user.change_pass;
    user.has_email = !!user.has_email;
    user.privacy_accepted = !!user.privacy_accepted;
    // Mask phone number for security
    if (user.phone_num) {
      user.phone_num = maskEncryptedPhoneNumber(user.phone_num);
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile (f_name, l_name, phone) and change password
router.patch('/me', async (req, res) => {
  try {
    const { f_name, l_name, phone_num, currentPassword, newPassword, forcePasswordChange } = req.body;
    const user = await db.get('SELECT password FROM users WHERE user_id = ?', [req.user.user_id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Check for duplicate phone number (in contacts table)
    if (phone_num !== undefined && phone_num) {
      const encrypted = encryptPhoneNumber(phone_num);
      const existing = await db.get(
        'SELECT user_id FROM contacts WHERE contact_type = ? AND contact_value = ? AND user_id != ?',
        ['phone', encrypted, req.user.user_id]
      );
      if (existing) return res.status(400).json({ error: 'Phone number already in use' });
    }
    
    // Update users table (password, change_pass)
    const userUpdates = [];
    const userParams = [];
    let passwordChanged = false;
    
    if (newPassword) {
      // Validate password strength
      const validation = validatePassword(newPassword);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.errors[0] || 'Password does not meet requirements' });
      }
      
      // If forcePasswordChange flag is set, skip currentPassword check (for initial password setup)
      if (!forcePasswordChange) {
        if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password)) {
          return res.status(400).json({ error: 'Current password is incorrect' });
        }
      }
      userUpdates.push('password = ?');
      userParams.push(bcrypt.hashSync(newPassword, 10));
      // Always clear change_pass flag when password is changed
      userUpdates.push('change_pass = 0');
      passwordChanged = true;
    }
    
    // Update users table if there are changes
    if (userUpdates.length > 0) {
      userParams.push(req.user.user_id);
      await db.run(`UPDATE users SET ${userUpdates.join(', ')} WHERE user_id = ?`, userParams);
    }
    
    // Update user_profiles table (f_name, l_name)
    const profileUpdates = [];
    const profileParams = [];
    if (f_name !== undefined) { profileUpdates.push('f_name = ?'); profileParams.push(capitalizeName(f_name)); }
    if (l_name !== undefined) { profileUpdates.push('l_name = ?'); profileParams.push(capitalizeName(l_name)); }
    
    if (profileUpdates.length > 0) {
      profileParams.push(req.user.user_id);
      await db.run(
        `UPDATE user_profiles SET ${profileUpdates.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
        profileParams
      );
    }
    
    // Handle phone number in contacts table
    if (phone_num !== undefined) {
      if (phone_num) {
        // Encrypt phone number
        const encrypted = encryptPhoneNumber(phone_num);
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 4);
        
        // Check if phone contact already exists for this user
        const existing = await db.get(
          'SELECT contact_id FROM contacts WHERE user_id = ? AND contact_type = ?',
          [req.user.user_id, 'phone']
        );
        
        if (existing) {
          // Update existing phone entry
          await db.run(
            `UPDATE contacts SET contact_value = ?, added_at = NOW(), expires_at = ? WHERE user_id = ? AND contact_type = ?`,
            [encrypted, expiresAt, req.user.user_id, 'phone']
          );
        } else {
          // Insert new phone contact
          await db.run(
            `INSERT INTO contacts (user_id, contact_type, contact_value, added_at, expires_at) VALUES (?, ?, ?, NOW(), ?)`,
            [req.user.user_id, 'phone', encrypted, expiresAt]
          );
        }
      } else {
        // Remove phone contact if empty string is provided
        await db.run(
          'DELETE FROM contacts WHERE user_id = ? AND contact_type = ?',
          [req.user.user_id, 'phone']
        );
      }
    }
    
    // Return updated user data
    const updatedUser = await db.get(
      `SELECT u.user_id, up.f_name, up.l_name, u.username, u.role, up.student_id,
              GROUP_CONCAT(CASE WHEN c.contact_type='phone' THEN c.contact_value ELSE NULL END) as phone_num,
              MAX(CASE WHEN c.contact_type='email' THEN 1 ELSE 0 END) as has_email,
              up.department, up.year_level, up.profile_path, u.change_pass, u.created_at
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       LEFT JOIN contacts c ON u.user_id = c.user_id
       WHERE u.user_id = ? AND u.deleted_at IS NULL
       GROUP BY u.user_id`,
      [req.user.user_id]
    );
    if (updatedUser) {
      updatedUser.name = [updatedUser.f_name, updatedUser.l_name].filter(Boolean).join(' ');
      updatedUser.change_pass = !!updatedUser.change_pass;
      updatedUser.has_email = !!updatedUser.has_email;
      // Mask phone number for security
      if (updatedUser.phone_num) {
        updatedUser.phone_num = maskEncryptedPhoneNumber(updatedUser.phone_num);
      }
      res.json(updatedUser);
    } else {
      res.json({ message: 'Updated' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept privacy notice
router.post('/privacy/accept', async (req, res) => {
  try {
    await db.run(
      'UPDATE users SET privacy_accepted = NOW() WHERE user_id = ?',
      [req.user.user_id]
    );
    res.json({ message: 'Privacy notice accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create user (Admin only)
router.post('/', requireRole('Admin'), async (req, res) => {
  try {
    const { f_name, m_name, l_name, username, password, role, student_id, phone_num, department, year_level, birthday, email } = req.body;
    
    if (!f_name || !l_name || !role) {
      return res.status(400).json({ error: 'First name, last name, and role required' });
    }
    // For students, require department and year_level
    if (role === 'Student') {
      if (!department || !year_level) {
        return res.status(400).json({ error: 'Department and year level required for students' });
      }
    }
    let loginName = (username || '').toString().trim();
    const studentIdTrim = (student_id || '').toString().trim();
    let generated = false;
    if (!loginName) {
      if (role === 'Student') {
        if (!studentIdTrim) return res.status(400).json({ error: 'Student ID required.' });
        loginName = studentIdTrim;
      } else {
        // Generate a username for instructors/admins based on their name
        loginName = await generateUniqueUsername(f_name, l_name);
        generated = true;
      }
    }
    // For instructors/admins, keep usernames uppercase for consistency
    const finalLoginName = (role === 'Student') ? loginName : (loginName || '').toString().toUpperCase();
    const existing = await db.get('SELECT user_id FROM users WHERE username = ? AND deleted_at IS NULL', [finalLoginName]);
    if (existing) {
      return res.status(400).json({ error: 'Username already in use.' });
    }
    // Check for duplicate phone number (in contacts table)
    if (phone_num) {
      const encrypted = encryptPhoneNumber(phone_num);
      const phoneExists = await db.get(
        'SELECT user_id FROM contacts WHERE contact_type = ? AND contact_value = ?',
        ['phone', encrypted]
      );
      if (phoneExists) {
        return res.status(400).json({ error: 'Phone number already in use.' });
      }
    }
    
    // Check for duplicate email (in contacts table)
    if (email && (role === 'Instructor' || role === 'Admin')) {
      const emailExists = await db.get(
        'SELECT user_id FROM contacts WHERE contact_type = ? AND contact_value = ?',
        ['email', email]
      );
      if (emailExists) {
        return res.status(400).json({ error: 'Email address already in use.' });
      }
    }
    
    // For Instructor/Admin with email, generate random password
    let finalPassword = password && password.trim() ? password : 'TempPass123!';
    let changePass = (!password || !password.trim()) ? 1 : 0;
    
    if ((role === 'Instructor' || role === 'Admin') && email) {
      // Generate a random 12-character password
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
      finalPassword = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      changePass = 1; // Force password change on first login
    }
    
    const hashed = bcrypt.hashSync(finalPassword, 10);
    const studentIdValue = role === 'Student' ? (student_id || null) : null;
    
    // Insert into users table
    await db.run(
      `INSERT INTO users (username, password, role, change_pass) VALUES (?, ?, ?, ?)`,
      [finalLoginName, hashed, role, changePass]
    );
    
    // Get the newly inserted user_id
    const newUser = await db.get('SELECT user_id FROM users WHERE username = ? ORDER BY user_id DESC LIMIT 1', [finalLoginName]);
    const newUserId = newUser.user_id;
    
    // Insert into user_profiles table with capitalized names
    await db.run(
      `INSERT INTO user_profiles (user_id, f_name, m_name, l_name, birthday, student_id, department, year_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newUserId, capitalizeName(f_name), capitalizeName(m_name) || null, capitalizeName(l_name), birthday || null, studentIdValue, department || null, year_level || null]
    );
    
    // Insert phone number into contacts table if provided
    if (phone_num) {
      const encrypted = encryptPhoneNumber(phone_num);
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 4);
      await db.run(
        `INSERT INTO contacts (user_id, contact_type, contact_value, added_at, expires_at) VALUES (?, ?, ?, NOW(), ?)`,
        [newUserId, 'phone', encrypted, expiresAt]
      );
    }
    
    // Insert email into contacts table if provided (for Instructor/Admin)
    if (email && (role === 'Instructor' || role === 'Admin')) {
      console.log('📧 Instructor/Admin with email detected');
      console.log('Email value:', email);
      console.log('Email type:', typeof email);
      console.log('Email length:', email?.length);
      
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 4);
      console.log('Expires at:', expiresAt);
      
      try {
        console.log('About to insert into contacts table...');
        await db.run(
          `INSERT INTO contacts (user_id, contact_type, contact_value, added_at, expires_at) VALUES (?, ?, ?, NOW(), ?)`,
          [newUserId, 'email', email, expiresAt]
        );
        console.log('✅ Email inserted into contacts table successfully for user', newUserId);
      } catch (dbErr) {
        console.error('❌ CRITICAL: Failed to insert email into contacts table');
        console.error('Error code:', dbErr.code);
        console.error('Error message:', dbErr.message);
        console.error('SQL:', dbErr.sql);
        throw dbErr; // Don't silently fail - propagate the error
      }
      
      // Send email with the generated password
      const fullName = [capitalizeName(f_name), capitalizeName(m_name) || null, capitalizeName(l_name)].filter(Boolean).join(' ');
      const emailSubject = `Welcome to Diaz College Announcement System`;
      const emailBody = `
        <!DOCTYPE html>
        <html>
          <head><meta charset="UTF-8"></head>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>Welcome, ${fullName}!</h2>
            <p>Your account has been created in the <strong>Diaz College Integrated Announcement Management System</strong>.</p>
            <p><strong>Login Credentials:</strong></p>
            <ul>
              <li><strong>Username:</strong> ${finalLoginName}</li>
              <li><strong>Password:</strong> <code style="background: #f0f0f0; padding: 2px 4px;">${finalPassword}</code></li>
            </ul>
            <p>You will be required to change your password upon your first login for security purposes.</p>
            <p>If you did not expect this account, please contact your administrator.</p>
            <hr style="margin-top: 2rem; border: none; border-top: 1px solid #ddd;">
            <p style="font-size: 0.875rem; color: #666;">Diaz College Integrated Announcement Management System</p>
          </body>
        </html>
      `;
      
      try {
        await sendEmail(email, emailSubject, emailBody);
      } catch (err) {
        throw err;
      }
    }
    
    const row = await db.get(
      `SELECT u.user_id, up.f_name, up.l_name, u.username, u.role, up.student_id, up.department, up.year_level 
       FROM users u 
       LEFT JOIN user_profiles up ON u.user_id = up.user_id 
       WHERE u.user_id = ?`,
      [newUserId]
    );
    row.name = [row.f_name, row.l_name].filter(Boolean).join(' ');
    res.status(201).json(row);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Username or Student ID already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user (Admin only)
router.patch('/:id', requireRole('Admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { f_name, m_name, l_name, username, role, student_id, phone_num, department, year_level, birthday, password } = req.body;
    
    // Get current user to check if they are a student
    const currentUser = await db.get('SELECT role FROM users WHERE user_id = ?', [id]);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });
    
    // Determine final role (either the new role or current role)
    const finalRole = role !== undefined ? role : currentUser.role;
    
    // If the user is or will be a student, require department and year_level
    if (finalRole === 'Student') {
      const profile = await db.get('SELECT department, year_level FROM user_profiles WHERE user_id = ?', [id]);
      const finalDepartment = department !== undefined ? department : profile?.department;
      const finalYearLevel = year_level !== undefined ? year_level : profile?.year_level;
      
      if (!finalDepartment || !finalYearLevel) {
        return res.status(400).json({ error: 'Department and year level required for students' });
      }
    }
    
    // Update users table (username, role, password)
    const userUpdates = [];
    const userParams = [];
    if (username !== undefined) { userUpdates.push('username = ?'); userParams.push(username); }
    if (role !== undefined) { userUpdates.push('role = ?'); userParams.push(role); }
    
    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      userUpdates.push('password = ?');
      userParams.push(hashed);
      // Clear change_pass flag when admin sets a password
      userUpdates.push('change_pass = 0');
    }
    
    if (userUpdates.length > 0) {
      userParams.push(id);
      await db.run(`UPDATE users SET ${userUpdates.join(', ')} WHERE user_id = ?`, userParams);
    }
    
    // Update user_profiles table (f_name, m_name, l_name, student_id, department, year_level, birthday)
    const profileUpdates = [];
    const profileParams = [];
    if (f_name !== undefined) { profileUpdates.push('f_name = ?'); profileParams.push(capitalizeName(f_name)); }
    if (m_name !== undefined) { profileUpdates.push('m_name = ?'); profileParams.push(capitalizeName(m_name)); }
    if (l_name !== undefined) { profileUpdates.push('l_name = ?'); profileParams.push(capitalizeName(l_name)); }
    if (student_id !== undefined) { profileUpdates.push('student_id = ?'); profileParams.push(student_id); }
    if (department !== undefined) { profileUpdates.push('department = ?'); profileParams.push(department); }
    if (year_level !== undefined) { profileUpdates.push('year_level = ?'); profileParams.push(year_level); }
    if (birthday !== undefined) { profileUpdates.push('birthday = ?'); profileParams.push(birthday); }
    
    if (profileUpdates.length > 0) {
      profileParams.push(id);
      profileUpdates.push('updated_at = NOW()');
      await db.run(
        `UPDATE user_profiles SET ${profileUpdates.join(', ')} WHERE user_id = ?`,
        profileParams
      );
    }
    
    // Handle phone number in contacts table
    if (phone_num !== undefined) {
      if (phone_num) {
        // Check for duplicate phone number (excluding current user)
        const encrypted = encryptPhoneNumber(phone_num);
        const phoneExists = await db.get(
          'SELECT user_id FROM contacts WHERE contact_type = ? AND contact_value = ? AND user_id != ?',
          ['phone', encrypted, id]
        );
        if (phoneExists) {
          return res.status(400).json({ error: 'Phone number already in use.' });
        }
        
        // Check if phone contact already exists
        const existing = await db.get(
          'SELECT contact_id FROM contacts WHERE user_id = ? AND contact_type = ?',
          [id, 'phone']
        );
        
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 4);
        
        if (existing) {
          // Update existing phone entry
          await db.run(
            `UPDATE contacts SET contact_value = ?, added_at = NOW(), expires_at = ? WHERE user_id = ? AND contact_type = ?`,
            [encrypted, expiresAt, id, 'phone']
          );
        } else {
          // Insert new phone contact
          await db.run(
            `INSERT INTO contacts (user_id, contact_type, contact_value, added_at, expires_at) VALUES (?, ?, ?, NOW(), ?)`,
            [id, 'phone', encrypted, expiresAt]
          );
        }
      } else {
        // Remove phone contact if empty string is provided
        await db.run(
          'DELETE FROM contacts WHERE user_id = ? AND contact_type = ?',
          [id, 'phone']
        );
      }
    }
    
    res.json({ message: 'Updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user (Admin only) - soft delete + anonymize personal data + clear phone number
router.delete('/:id', requireRole('Admin'), async (req, res) => {
  try {
    console.log('🗑️ DELETE /users/:id called, id =', req.params.id);
    const id = parseInt(req.params.id, 10);
    console.log('Parsed id:', id, 'isNaN:', isNaN(id));
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
    console.log('Running soft delete query with data anonymization...');
    
    // Soft delete users table (set username to unique deleted string to avoid UNIQUE constraint violation)
    await db.run(
      'UPDATE users SET deleted_at = NOW(), username = CONCAT("Deleted_User_", ?) WHERE user_id = ? AND deleted_at IS NULL',
      [id, id]
    );
    
    // Anonymize user_profiles table
    await db.run(
      'UPDATE user_profiles SET f_name = CONCAT("Deleted_User_", ?), l_name = "", student_id = NULL WHERE user_id = ?',
      [id, id]
    );
    
    // Clear contacts (phone numbers, emails)
    await db.run('DELETE FROM contacts WHERE user_id = ?', [id]);
    
    const result = await db.get('SELECT deleted_at FROM users WHERE user_id = ?', [id]);
    if (!result || result.deleted_at === null) {
      return res.status(404).json({ error: 'User not found or already deleted' });
    }
    
    console.log('✅ Soft delete successful');
    res.json({ message: 'User deleted successfully. Personal data anonymized, access prevented, contacts cleared (DPA compliant)' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: 'Server error: ' + (err.message || String(err)) });
  }
});

// Upload profile picture
router.post('/me/profile-picture', upload.single('profile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file is an image
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Only image files are allowed (JPEG, PNG, GIF, WebP)' });
    }

    // Generate filename with timestamp
    const ext = req.file.originalname.split('.').pop();
    const filename = `profile_${req.user.user_id}_${Date.now()}.${ext}`;
    const filepath = path.join(__dirname, '../../uploads', filename);

    // Save file to disk
    fs.writeFileSync(filepath, req.file.buffer);

    // Update user profile_path in user_profiles table
    const profilePath = `/uploads/${filename}`;
    await db.run('UPDATE user_profiles SET profile_path = ?, updated_at = NOW() WHERE user_id = ?', [profilePath, req.user.user_id]);

    // Return updated user data
    const updatedUser = await db.get(
      `SELECT u.user_id, up.f_name, up.l_name, u.username, u.role, up.student_id, GROUP_CONCAT(CASE WHEN c.contact_type='phone' THEN c.contact_value ELSE NULL END) as phone_num, up.department, up.year_level, up.profile_path, u.change_pass, u.created_at
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       LEFT JOIN contacts c ON u.user_id = c.user_id
       WHERE u.user_id = ? AND u.deleted_at IS NULL
       GROUP BY u.user_id`,
      [req.user.user_id]
    );
    if (updatedUser) {
      updatedUser.name = [updatedUser.f_name, updatedUser.l_name].filter(Boolean).join(' ');
      updatedUser.change_pass = !!updatedUser.change_pass;
      // Mask phone number for security
      if (updatedUser.phone_num) {
        updatedUser.phone_num = maskEncryptedPhoneNumber(updatedUser.phone_num);
      }
    }

    res.json(updatedUser || { message: 'Profile picture updated' });
  } catch (err) {
    console.error('Profile picture upload error:', err);
    res.status(500).json({ error: 'Failed to upload profile picture: ' + err.message });
  }
});

// Batch upload students from Excel (Admin only)
router.post('/batch/upload', requireRole('Admin'), upload.single('file'), async (req, res) => {
  try {
    console.log('🔵 Batch upload started');
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📄 File received: ${req.file.originalname}, size: ${req.file.size} bytes`);

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      console.log('❌ Excel file is empty');
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    console.log(`👉 Reading sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    // Skip row 1 (title), use row 2 as headers, data starts from row 3
    const rows = XLSX.utils.sheet_to_json(sheet, { range: 1 });

    console.log(`📊 Found ${rows.length} rows in Excel`);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data found in Excel file' });
    }

    // Debug: Print first row to see column names
    if (rows.length > 0) {
      console.log('📋 Column headers:', Object.keys(rows[0]));
      console.log('📋 First row data:', rows[0]);
    }

    // Validate and prepare rows
    const results = [];
    const skipped = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row number (header is row 1)

      // Extract and trim fields (support various column name formats)
      const f_name = (row['First Name'] || row['first_name'] || row['F_Name'] || '').toString().trim();
      const m_name = (row['Middle Name'] || row['middle_name'] || row['M_Name'] || '').toString().trim() || null;
      const l_name = (row['Last Name'] || row['last_name'] || row['L_Name'] || '').toString().trim();
      const student_id = (row['Student ID'] || row['student_id'] || row['ID'] || '').toString().trim();
      const department = (row['Department'] || row['department'] || '').toString().trim();
      const year_level = (row['Year Level'] || row['year_level'] || row['Year'] || '').toString().trim();
      const birthday = parseBirthday(row['Birthday'] || row['birthday'] || row['DOB'] || null);

      console.log(`📝 Row ${rowNum}: f_name="${f_name}", l_name="${l_name}", dept="${department}", year="${year_level}", birthday="${birthday}"`);

      // Validate required fields
      if (!f_name || !l_name) {
        const msg = `Row ${rowNum}: First name and last name are required`;
        console.log(`  ❌ ${msg}`);
        errors.push(msg);
        continue;
      }
      if (!student_id) {
        const msg = `Row ${rowNum}: Student ID is required`;
        console.log(`  ❌ ${msg}`);
        errors.push(msg);
        continue;
      }
      if (!department) {
        const msg = `Row ${rowNum}: Department is required`;
        console.log(`  ❌ ${msg}`);
        errors.push(msg);
        continue;
      }
      if (!year_level) {
        const msg = `Row ${rowNum}: Year level is required`;
        console.log(`  ❌ ${msg}`);
        errors.push(msg);
        continue;
      }

      // Validate department and year_level
      const validDepts = ['BSBA', 'BSCS', 'BSED', 'BEED'];
      const validYears = ['1st', '2nd', '3rd', '4th'];
      if (!validDepts.includes(department)) {
        const msg = `Row ${rowNum}: Invalid department "${department}". Must be one of: ${validDepts.join(', ')}`;
        console.log(`  ❌ ${msg}`);
        errors.push(msg);
        continue;
      }
      if (!validYears.includes(year_level)) {
        const msg = `Row ${rowNum}: Invalid year level "${year_level}". Must be one of: ${validYears.join(', ')}`;
        console.log(`  ❌ ${msg}`);
        errors.push(msg);
        continue;
      }

      // Check for duplicates
      const existing = await db.get('SELECT user_id FROM user_profiles WHERE student_id = ? AND user_id IN (SELECT user_id FROM users WHERE deleted_at IS NULL)', [student_id]);
      if (existing) {
        const msg = `Row ${rowNum}: Student ID "${student_id}" already exists`;
        console.log(`  ❌ ${msg}`);
        errors.push(msg);
        continue;
      }

      // If birthday is unparseable, skip this row (warning)
      if (!birthday) {
        const msg = `Row ${rowNum}: Invalid or unparseable birthday format - skipping this entry`;
        console.log(`  ⚠️  ${msg}`);
        skipped.push(msg);
        continue;
      }

      // Generate temporary password (can be changed on first login)
      const tempPassword = 'TempPass123!';
      const hashed = bcrypt.hashSync(tempPassword, 10);

      try {
        console.log(`➕ Creating student: ${f_name} ${l_name} (${student_id})`);
        
        // Insert into users table
        const insertResult = await db.run(
          `INSERT INTO users (username, password, role, change_pass) VALUES (?, ?, ?, 1)`,
          [student_id, hashed, 'Student']
        );
        const newUserId = insertResult.insertId;
        
        // Insert into user_profiles table with capitalized names
        await db.run(
          `INSERT INTO user_profiles (user_id, f_name, m_name, l_name, student_id, department, year_level, birthday) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [newUserId, capitalizeName(f_name), m_name ? capitalizeName(m_name) : null, capitalizeName(l_name), student_id, department, year_level, birthday]
        );
        
        console.log(`✅ Student created with ID: ${newUserId}`);
        results.push({
          rowNum,
          f_name,
          m_name,
          l_name,
          student_id,
          status: 'created',
          message: `Student created successfully (default password: ${tempPassword})`
        });
      } catch (err) {
        console.error(`❌ Error creating student at row ${rowNum}:`, err.message);
        if (err.code === 'ER_DUP_ENTRY') {
          errors.push(`Row ${rowNum}: Student ID or username "${student_id}" already exists`);
        } else {
          errors.push(`Row ${rowNum}: Database error - ${err.message}`);
        }
      }
    }

    console.log(`✨ Batch upload completed: ${results.length} successful, ${skipped.length} skipped (warnings), ${errors.length} errors`);
    res.json({
      message: `Batch upload completed`,
      total: rows.length,
      successful: results.length,
      skipped: skipped.length,
      failed: errors.length,
      results,
      skipped,
      errors
    });
  } catch (err) {
    console.error('❌ Batch upload error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Batch preview: validate Excel data before upload
router.post('/batch/preview', requireRole('Admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    const sheet = workbook.Sheets[sheetName];
    // Skip row 1 (title), use row 2 as headers, data starts from row 3
    const rows = XLSX.utils.sheet_to_json(sheet, { range: 1 });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data found in Excel file' });
    }

    // Paginate: 5 rows per page, or get all if requested
    const PAGE_SIZE = 5;
    let page = parseInt(req.query.page || 1, 10);
    const getAll = req.query.page === 'all';
    
    if (!getAll) {
      if (isNaN(page) || page < 1) page = 1;
    }

    const totalPages = getAll ? 1 : Math.ceil(rows.length / PAGE_SIZE);
    if (!getAll && page > totalPages) page = totalPages || 1;

    const startIdx = getAll ? 0 : (page - 1) * PAGE_SIZE;
    const endIdx = getAll ? rows.length : Math.min(startIdx + PAGE_SIZE, rows.length);
    const pageRows = rows.slice(startIdx, endIdx);

    const preview = [];
    const warnings = [];

    for (let i = 0; i < pageRows.length; i++) {
      const row = pageRows[i];
      const rowNum = startIdx + i + 2; // Actual Excel row number
      const f_name = (row['First Name'] || row['first_name'] || row['F_Name'] || '').toString().trim();
      const m_name = (row['Middle Name'] || row['middle_name'] || row['M_Name'] || '').toString().trim();
      const l_name = (row['Last Name'] || row['last_name'] || row['L_Name'] || '').toString().trim();
      const student_id = (row['Student ID'] || row['student_id'] || row['ID'] || '').toString().trim();
      const department = (row['Department'] || row['department'] || '').toString().trim();
      const year_level = (row['Year Level'] || row['year_level'] || row['Year'] || '').toString().trim();
      const birthday = parseBirthday(row['Birthday'] || row['birthday'] || row['DOB'] || null);

      // Validate and determine status
      let status = 'valid';
      let statusMessage = 'Ready to import';

      // Check for required fields
      if (!f_name || !l_name) {
        status = 'error';
        statusMessage = 'Missing first or last name';
      } else if (!student_id) {
        status = 'error';
        statusMessage = 'Missing Student ID';
      } else if (!department) {
        status = 'error';
        statusMessage = 'Missing Department';
      } else if (!year_level) {
        status = 'error';
        statusMessage = 'Missing Year Level';
      } else {
        // Validate department and year_level format
        const validDepts = ['BSBA', 'BSCS', 'BSED', 'BEED'];
        const validYears = ['1st', '2nd', '3rd', '4th'];
        if (!validDepts.includes(department)) {
          status = 'error';
          statusMessage = `Invalid department "${department}"`;
        } else if (!validYears.includes(year_level)) {
          status = 'error';
          statusMessage = `Invalid year level "${year_level}"`;
        } else if (birthday && birthday === null) {
          status = 'warning';
          statusMessage = 'Invalid or unparseable birthday format';
        }
      }

      // Check for duplicates in database (only if passed basic validation)
      if (status === 'valid' || status === 'warning') {
        const existing = await db.get(
          'SELECT user_id FROM user_profiles WHERE student_id = ? AND user_id IN (SELECT user_id FROM users WHERE deleted_at IS NULL)',
          [student_id]
        );
        if (existing) {
          status = 'error';
          statusMessage = 'Student ID already exists in system';
        }
      }

      preview.push({
        f_name,
        m_name: m_name || '—',
        l_name,
        student_id,
        birthday: birthday || '—',
        department: department || '—',
        year_level: year_level || '—',
        status,
        statusMessage,
        rowNum
      });
    }

    // Count statuses
    const validCount = preview.filter(p => p.status === 'valid').length;
    const warningCount = preview.filter(p => p.status === 'warning').length;
    const errorCount = preview.filter(p => p.status === 'error').length;

    res.json({
      message: `Preview page ${page} of ${totalPages}`,
      totalRows: rows.length,
      page,
      totalPages,
      preview,
      summary: {
        valid: validCount,
        warning: warningCount,
        error: errorCount,
        canSubmit: validCount > 0 && errorCount === 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Download Excel template for batch upload (Admin only)
router.get('/batch/template', requireRole('Admin'), async (req, res) => {
  try {
    // Generate Excel template dynamically
    const workbookData = [
      ['Student Batch Upload Template'],
      ['First Name', 'Middle Name', 'Last Name', 'Student ID', 'Birthday', 'Department', 'Year Level'],
      ['John', 'Michael', 'Doe', 'STU001', '2003-05-15', 'BSCS', '1st'],
      ['Jane', 'Marie', 'Smith', 'STU002', '2003-08-22', 'BSBA', '2nd']
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(workbookData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // First Name
      { wch: 15 }, // Middle Name
      { wch: 15 }, // Last Name
      { wch: 15 }, // Student ID
      { wch: 15 }, // Birthday
      { wch: 15 }, // Department
      { wch: 15 }  // Year Level
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="batch_upload_template.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate template: ' + err.message });
  }
});

// Send OTP to phone number
router.post('/send-phone-otp', async (req, res) => {
  try {
    const { phone_num } = req.body;
    const userId = req.user.user_id;
    
    if (!phone_num || !phone_num.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Check if phone number is already in use by another user
    const phoneExists = await db.get(
      `SELECT c.user_id FROM contacts c 
       JOIN users u ON c.user_id = u.user_id 
       WHERE c.contact_value = ? AND c.contact_type = 'phone' AND c.user_id != ? AND u.deleted_at IS NULL`,
      [phone_num.trim(), userId]
    );
    if (phoneExists) {
      return res.status(400).json({ error: 'Phone number already in use by another user.' });
    }

    // Generate 6-digit OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 2 * 60 * 1000; // 2 minutes

    // Send OTP via SMS (check result before storing in session)
    const smsMessage = `Diaz College Integrated Announcement Management System: Your OTP is ${otpCode}. Valid for 2 minutes. Do not share this code.`;
    const smsResult = await sendSms([phone_num.trim()], smsMessage);

    // If SMS failed, return error (don't store in session)
    if (!smsResult.ok) {
      return res.status(500).json({ 
        error: 'Failed to send OTP. Please try again.',
        details: smsResult.error || 'SMS gateway error'
      });
    }

    // Only store OTP in session if SMS was sent successfully
    req.session.pendingOtp = {
      otp_code: otpCode,
      expiresAt: expiresAt,
      attempts: 0
    };

    res.json({ 
      message: 'OTP sent successfully',
      phone_num: phone_num.trim(),
      expiresIn: 120 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send OTP: ' + err.message });
  }
});

// Verify OTP and update phone number
router.post('/verify-phone-otp', async (req, res) => {
  try {
    const { otp_code, phone_num } = req.body;
    const userId = req.user.user_id;

    if (!otp_code || !otp_code.trim()) {
      return res.status(400).json({ error: 'OTP code is required' });
    }

    if (!phone_num || !phone_num.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Check if OTP exists in session
    if (!req.session.pendingOtp) {
      return res.status(400).json({ error: 'No pending OTP. Request a new OTP.' });
    }

    // Check if OTP has expired
    if (Date.now() > req.session.pendingOtp.expiresAt) {
      delete req.session.pendingOtp;
      return res.status(400).json({ error: 'OTP has expired. Request a new OTP.' });
    }

    // Check if max attempts exceeded
    if (req.session.pendingOtp.attempts >= 3) {
      delete req.session.pendingOtp;
      return res.status(400).json({ error: 'Too many failed attempts. Request a new OTP.' });
    }

    // Verify the OTP code
    if (req.session.pendingOtp.otp_code !== otp_code.trim()) {
      req.session.pendingOtp.attempts += 1;
      const remaining = 3 - req.session.pendingOtp.attempts;
      return res.status(400).json({ 
        error: `Invalid OTP code. ${remaining} attempts remaining.`
      });
    }

    // Check for duplicate phone number (excluding current user)
    const phoneExists = await db.get(
      'SELECT user_id FROM contacts WHERE contact_type = ? AND contact_value = ? AND user_id != ?',
      ['phone', encryptPhoneNumber(phone_num.trim()), userId]
    );
    if (phoneExists) {
      return res.status(400).json({ error: 'Phone number already in use by another user.' });
    }

    // Encrypt phone number before saving
    const encrypted = encryptPhoneNumber(phone_num.trim());
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 4);

    // Check if phone contact already exists
    const existing = await db.get(
      'SELECT contact_id FROM contacts WHERE user_id = ? AND contact_type = ?',
      [userId, 'phone']
    );

    if (existing) {
      // Update existing phone contact
      await db.run(
        `UPDATE contacts SET contact_value = ?, added_at = NOW(), expires_at = ? WHERE user_id = ? AND contact_type = ?`,
        [encrypted, expiresAt, userId, 'phone']
      );
    } else {
      // Insert new phone contact
      await db.run(
        `INSERT INTO contacts (user_id, contact_type, contact_value, added_at, expires_at) VALUES (?, ?, ?, NOW(), ?)`,
        [userId, 'phone', encrypted, expiresAt]
      );
    }

    // Clean up session OTP
    delete req.session.pendingOtp;

    res.json({ 
      message: 'Phone number verified successfully',
      phone_num: maskEncryptedPhoneNumber(encrypted)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify OTP: ' + err.message });
  }
});

// Get OTP status (session-based)
router.get('/phone-otp-status', async (req, res) => {
  try {
    // Check if OTP exists in session
    if (!req.session.pendingOtp) {
      return res.json({ has_pending: false });
    }

    // Check if OTP has expired
    if (Date.now() > req.session.pendingOtp.expiresAt) {
      delete req.session.pendingOtp;
      return res.json({ has_pending: false });
    }

    // Calculate remaining time in seconds
    const timeRemaining = Math.floor((req.session.pendingOtp.expiresAt - Date.now()) / 1000);
    const maxAttempts = 3;
    const attemptsRemaining = Math.max(0, maxAttempts - req.session.pendingOtp.attempts);

    res.json({
      has_pending: true,
      attempts: req.session.pendingOtp.attempts,
      attempts_remaining: attemptsRemaining,
      max_attempts: maxAttempts,
      time_remaining: timeRemaining,
      can_attempt: attemptsRemaining > 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send OTP to email address
router.post('/send-email-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.user_id;
    
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check if email is already in use by another user
    const emailExists = await db.get(
      `SELECT c.user_id FROM contacts c 
       JOIN users u ON c.user_id = u.user_id 
       WHERE c.contact_value = ? AND c.contact_type = 'email' AND c.user_id != ? AND u.deleted_at IS NULL`,
      [email.trim(), userId]
    );
    if (emailExists) {
      return res.status(400).json({ error: 'Email address already in use by another user.' });
    }

    // Generate 6-digit OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 2 * 60 * 1000; // 2 minutes

    // Send OTP via Email
    const emailSubject = 'Email Verification - Diaz College Announcement System';
    const emailBody = `
      <h2>Email Verification</h2>
      <p>Your OTP code is: <strong style="font-size: 1.5em; color: #3b82f6;">${otpCode}</strong></p>
      <p style="color: #666;">This code is valid for 2 minutes. Do not share this code with anyone.</p>
      <p style="margin-top: 2rem; font-size: 0.9em; color: #999;">Diaz College Announcement System</p>
    `;
    
    const emailResult = await sendEmail(email.trim(), emailSubject, emailBody);

    // If email failed, return error (don't store in session)
    if (!emailResult.success) {
      return res.status(500).json({ 
        error: 'Failed to send OTP to email. Please try again.',
        details: emailResult.error || 'Email service error'
      });
    }

    // Only store OTP in session if email was sent successfully
    req.session.pendingEmailOtp = {
      otp_code: otpCode,
      expiresAt: expiresAt,
      attempts: 0
    };

    res.json({ 
      message: 'OTP sent successfully to email',
      email: email.trim(),
      expiresIn: 120 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send OTP: ' + err.message });
  }
});

// Verify OTP and update email address
router.post('/verify-email-otp', async (req, res) => {
  try {
    const { otp_code, email } = req.body;
    const userId = req.user.user_id;

    if (!otp_code || !otp_code.trim()) {
      return res.status(400).json({ error: 'OTP code is required' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Check if OTP exists in session
    if (!req.session.pendingEmailOtp) {
      return res.status(400).json({ error: 'No pending OTP. Request a new OTP.' });
    }

    // Check if OTP has expired
    if (Date.now() > req.session.pendingEmailOtp.expiresAt) {
      delete req.session.pendingEmailOtp;
      return res.status(400).json({ error: 'OTP has expired. Request a new OTP.' });
    }

    // Check if max attempts exceeded
    if (req.session.pendingEmailOtp.attempts >= 3) {
      delete req.session.pendingEmailOtp;
      return res.status(400).json({ error: 'Too many failed attempts. Request a new OTP.' });
    }

    // Verify the OTP code
    if (req.session.pendingEmailOtp.otp_code !== otp_code.trim()) {
      req.session.pendingEmailOtp.attempts += 1;
      const remaining = 3 - req.session.pendingEmailOtp.attempts;
      return res.status(400).json({ 
        error: `Invalid OTP code. ${remaining} attempts remaining.`
      });
    }

    // Check for duplicate email (excluding current user)
    const emailDuplicate = await db.get(
      'SELECT user_id FROM contacts WHERE contact_type = ? AND contact_value = ? AND user_id != ?',
      ['email', email.trim(), userId]
    );
    if (emailDuplicate) {
      return res.status(400).json({ error: 'Email address already in use by another user.' });
    }

    // Set email expiration to 4 years from now
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 4);

    // Check if email contact already exists
    const existing = await db.get(
      'SELECT contact_id FROM contacts WHERE user_id = ? AND contact_type = ?',
      [userId, 'email']
    );

    if (existing) {
      // Update existing email contact
      await db.run(
        `UPDATE contacts SET contact_value = ?, added_at = NOW(), expires_at = ? WHERE user_id = ? AND contact_type = ?`,
        [email.trim(), expiresAt, userId, 'email']
      );
    } else {
      // Insert new email contact
      await db.run(
        `INSERT INTO contacts (user_id, contact_type, contact_value, added_at, expires_at) VALUES (?, ?, ?, NOW(), ?)`,
        [userId, 'email', email.trim(), expiresAt]
      );
    }

    // Clean up session OTP
    delete req.session.pendingEmailOtp;

    res.json({ 
      message: 'Email address verified successfully',
      email: email.trim()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify OTP: ' + err.message });
  }
});

// Get email OTP status (session-based)
router.get('/email-otp-status', async (req, res) => {
  try {
    // Check if OTP exists in session
    if (!req.session.pendingEmailOtp) {
      return res.json({ has_pending: false });
    }

    // Check if OTP has expired
    if (Date.now() > req.session.pendingEmailOtp.expiresAt) {
      delete req.session.pendingEmailOtp;
      return res.json({ has_pending: false });
    }

    // Calculate remaining time in seconds
    const timeRemaining = Math.floor((req.session.pendingEmailOtp.expiresAt - Date.now()) / 1000);
    const maxAttempts = 3;
    const attemptsRemaining = Math.max(0, maxAttempts - req.session.pendingEmailOtp.attempts);

    res.json({
      has_pending: true,
      attempts: req.session.pendingEmailOtp.attempts,
      attempts_remaining: attemptsRemaining,
      max_attempts: maxAttempts,
      time_remaining: timeRemaining,
      can_attempt: attemptsRemaining > 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

