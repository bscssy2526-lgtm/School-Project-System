const express = require('express');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { sendSms, sendSmsBatch, decryptAndNormalizePhone } = require('../sms-gateway');
const { sendAnnouncementEmail } = require('../utils/email');
const encryption = require('../utils/encryption');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with announcement ID, timestamp, and random number
    const announcementId = req.params.id || 'temp';
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const uniqueName = `ann_${announcementId}_${timestamp}_${random}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${file.mimetype}. Allowed types: Images (JPEG, PNG, GIF, WebP), PDF, Word documents, Excel spreadsheets, and text files.`), false);
    }
  }
});

// helper: compute current academic year and term
// school year runs from June of one calendar year through April of the next
// term 1 = June–November, term 2 = December–April (May is break)
function determineSchoolYearAndTerm(date = new Date()) {
  const m = date.getMonth() + 1; // 1–12
  let term = null;
  let startYear;

  if (m >= 6 && m <= 11) {
    term = '1st';
    startYear = date.getFullYear();
  } else if (m === 12 || m <= 4) {
    term = '2nd';
    startYear = (m === 12) ? date.getFullYear() : date.getFullYear() - 1;
  } else {
    // May (5) lives outside the defined terms; pick previous year by default
    startYear = date.getFullYear() - 1;
  }

  return { schoolYear: `${startYear}-${startYear + 1}`, term };
}

router.use(auth);

// Get announcements (filtered by role)
router.get('/', async (req, res) => {
  try {
    // pagination parameters (optional)
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = null; // null means no pagination
    
    // interpret ?class_id param only if it is a valid integer
    let classId = null;
    if (typeof req.query.class_id !== 'undefined') {
      const parsed = parseInt(req.query.class_id, 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'Invalid class_id' });
      }
      classId = parsed;
    }
    let rows;
    let total = 0;
    
    if (classId !== null) {
      // Class-specific view: ONLY show announcements for this specific class
      if (req.user.role === 'Admin') {
        const countRes = await db.get(`
          SELECT COUNT(*) AS cnt FROM announcements a
          WHERE a.class_id = ? AND a.is_deleted = 0
        `, [classId]);
        total = countRes ? countRes.cnt : 0;
        
        let query = `
          SELECT a.*, CONCAT(up.f_name, ' ', up.l_name) AS author_name, u.role AS author_role, up.profile_path AS author_profile_path, c.class_name,
                 (SELECT COUNT(*) FROM announcement_attachments aa WHERE aa.announcement_id = a.announcement_id) AS attachment_count
          FROM announcements a
          JOIN users u ON a.author_id = u.user_id
          LEFT JOIN user_profiles up ON u.user_id = up.user_id
          LEFT JOIN classes c ON a.class_id = c.class_id
          WHERE a.class_id = ? AND a.is_deleted = 0
          ORDER BY a.date_posted DESC`;
        
        if (limit) {
          const offset = (page - 1) * limit;
          query += ` LIMIT ? OFFSET ?`;
          rows = await db.query(query, [classId, limit, offset]);
        } else {
          rows = await db.query(query, [classId]);
        }
      } else if (req.user.role === 'Instructor') {
        const countRes = await db.get(`
          SELECT COUNT(*) AS cnt FROM announcements a
          JOIN classes c ON a.class_id = c.class_id
          WHERE a.class_id = ? AND c.instructor_id = ? AND a.is_deleted = 0
        `, [classId, req.user.user_id]);
        total = countRes ? countRes.cnt : 0;
        
        let query = `
          SELECT a.*, CONCAT(up.f_name, ' ', up.l_name) AS author_name, u.role AS author_role, up.profile_path AS author_profile_path, c.class_name,
                  (SELECT COUNT(*) FROM announcement_attachments aa WHERE aa.announcement_id = a.announcement_id) AS attachment_count
           FROM announcements a
           JOIN users u ON a.author_id = u.user_id
           LEFT JOIN user_profiles up ON u.user_id = up.user_id
           LEFT JOIN classes c ON a.class_id = c.class_id
           WHERE a.class_id = ? AND c.instructor_id = ? AND a.is_deleted = 0
           ORDER BY a.date_posted DESC`;
        
        if (limit) {
          const offset = (page - 1) * limit;
          query += ` LIMIT ? OFFSET ?`;
          rows = await db.query(query, [classId, req.user.user_id, limit, offset]);
        } else {
          rows = await db.query(query, [classId, req.user.user_id]);
        }
      } else {
        const countRes = await db.get(`
          SELECT COUNT(DISTINCT a.announcement_id) AS cnt FROM announcements a
          LEFT JOIN class_enrollments e ON e.class_id = a.class_id AND e.student_id = ?
          WHERE a.class_id = ? AND e.enrollment_id IS NOT NULL AND a.is_deleted = 0
        `, [req.user.user_id, classId]);
        total = countRes ? countRes.cnt : 0;
        
        let query = `
          SELECT DISTINCT a.*, CONCAT(up.f_name, ' ', up.l_name) AS author_name, u.role AS author_role, up.profile_path AS author_profile_path, c.class_name,
                           (SELECT COUNT(*) FROM announcement_attachments aa WHERE aa.announcement_id = a.announcement_id) AS attachment_count
           FROM announcements a
           JOIN users u ON a.author_id = u.user_id
           LEFT JOIN user_profiles up ON u.user_id = up.user_id
           LEFT JOIN classes c ON a.class_id = c.class_id
           LEFT JOIN class_enrollments e ON e.class_id = a.class_id AND e.student_id = ?
           WHERE a.class_id = ? AND e.enrollment_id IS NOT NULL AND a.is_deleted = 0
           ORDER BY a.date_posted DESC`;
        
        if (limit) {
          const offset = (page - 1) * limit;
          query += ` LIMIT ? OFFSET ?`;
          rows = await db.query(query, [req.user.user_id, classId, limit, offset]);
        } else {
          rows = await db.query(query, [req.user.user_id, classId]);
        }
      }
    } else {
      // Main announcements view: school-wide announcements (class_id IS NULL)
      if (req.user.role === 'Admin') {
        // Admin sees all school-wide announcements (including targeted ones)
        const countRes = await db.get(`
          SELECT COUNT(*) AS cnt FROM announcements a
          WHERE a.class_id IS NULL AND a.is_deleted = 0
        `);
        total = countRes ? countRes.cnt : 0;
        
        let query = `
          SELECT a.*, CONCAT(up.f_name, ' ', up.l_name) AS author_name, u.role AS author_role, up.profile_path AS author_profile_path, c.class_name,
                 (SELECT COUNT(*) FROM announcement_attachments aa WHERE aa.announcement_id = a.announcement_id) AS attachment_count
          FROM announcements a
          JOIN users u ON a.author_id = u.user_id
          LEFT JOIN user_profiles up ON u.user_id = up.user_id
          LEFT JOIN classes c ON a.class_id = c.class_id
          WHERE a.class_id IS NULL AND a.is_deleted = 0
          ORDER BY a.date_posted DESC`;
        
        if (limit) {
          const offset = (page - 1) * limit;
          query += ` LIMIT ? OFFSET ?`;
          rows = await db.query(query, [limit, offset]);
        } else {
          rows = await db.query(query);
        }
      } else {
        // Instructors and Students: show school-wide announcements that are either global
        // or targeted to the user's department/year_level
        // use null for blank/undefined values so SQL condition works as expected
      let dept = req.user.department;
      if (dept === '' || typeof dept === 'undefined') dept = null;
      let yrlvl = req.user.year_level;
      if (yrlvl === '' || typeof yrlvl === 'undefined') yrlvl = null;
      console.debug('GET /announcements main filter', { userId: req.user.user_id, dept, yrlvl });
      // build dynamic where clauses to correctly handle null/unset values
      const params = [];
      let filterSQL = `
        WHERE a.class_id IS NULL AND a.is_deleted = 0`;
      if (dept !== null) {
        filterSQL += `
          AND (a.target_department IS NULL OR a.target_department = ?)`;
        params.push(dept);
      } // if dept is null we do not filter on department at all (wildcard)
      if (yrlvl !== null) {
        filterSQL += `
          AND (a.target_year_level IS NULL OR a.target_year_level = ?)`;
        params.push(yrlvl);
      } // if year level is null we do not filter on year at all
      
      // Count total matching announcements
      const countQuery = `SELECT COUNT(*) AS cnt FROM announcements a ${filterSQL}`;
      const countRes = await db.get(countQuery, params);
      total = countRes ? countRes.cnt : 0;
      
      let dataQuery = `
        SELECT DISTINCT a.*, CONCAT(up.f_name, ' ', up.l_name) AS author_name, u.role AS author_role, up.profile_path AS author_profile_path, c.class_name,
               (SELECT COUNT(*) FROM announcement_attachments aa WHERE aa.announcement_id = a.announcement_id) AS attachment_count
        FROM announcements a
        JOIN users u ON a.author_id = u.user_id
        LEFT JOIN user_profiles up ON u.user_id = up.user_id
        LEFT JOIN classes c ON a.class_id = c.class_id
        ${filterSQL}
        ORDER BY a.date_posted DESC`;
      
      if (limit) {
        const offset = (page - 1) * limit;
        dataQuery += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);
      }
      
      rows = await db.query(dataQuery, params);
      console.debug('SQL for main announcements', dataQuery, params);
      }
    }
    
    // Fetch attachments for each announcement
    for (const row of rows) {
      const attachments = await db.query('SELECT * FROM announcement_attachments WHERE announcement_id = ?', [row.announcement_id]);
      row.attachments = attachments;
    }
    
    // Return paginated response if limit was specified
    if (limit) {
      return res.json({ data: rows, total, page, limit });
    }
    
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Dashboard stats (Admin only) - must be before /:id
router.get('/stats/counts', requireRole('Admin'), async (req, res) => {
  try {
    // count only announcements created by Admin users
    const ann = await db.get(`
      SELECT COUNT(*) AS c
      FROM announcements a
      JOIN users u ON a.author_id = u.user_id
      WHERE u.role = 'Admin' AND a.is_deleted = 0
    `);
    const students = await db.get('SELECT COUNT(*) AS c FROM users WHERE role = ?', ['Student']);
    const instructors = await db.get('SELECT COUNT(*) AS c FROM users WHERE role = ?', ['Instructor']);
    const classes = await db.get('SELECT COUNT(*) AS c FROM classes');
    res.json({
      announcements: ann?.c ?? 0,
      students: students?.c ?? 0,
      instructors: instructors?.c ?? 0,
      classes: classes?.c ?? 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Pinned announcements (for right sidebar)
router.get('/pinned', async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'Admin') {
      rows = await db.query(`
        SELECT a.*, CONCAT(up.f_name, ' ', up.l_name) AS author_name, u.profile_path AS author_profile_path, c.class_name
        FROM announcements a
        JOIN users u ON a.author_id = u.user_id
        LEFT JOIN user_profiles up ON u.user_id = up.user_id
        LEFT JOIN classes c ON a.class_id = c.class_id
        WHERE a.is_pinned = 1 AND a.is_deleted = 0
        ORDER BY a.date_posted DESC
      `);
    } else if (req.user.role === 'Instructor') {
      rows = await db.query(
        `SELECT a.*, CONCAT(up.f_name, ' ', up.l_name) AS author_name, u.profile_path AS author_profile_path, c.class_name
         FROM announcements a
         JOIN users u ON a.author_id = u.user_id
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         LEFT JOIN classes c ON a.class_id = c.class_id
         WHERE a.is_pinned = 1 AND (a.class_id IS NULL OR c.instructor_id = ?) AND a.is_deleted = 0
         ORDER BY a.date_posted DESC`,
        [req.user.user_id]
      );
    } else {
      rows = await db.query(
        `SELECT DISTINCT a.*, CONCAT(up.f_name, ' ', up.l_name) AS author_name, u.profile_path AS author_profile_path, c.class_name
         FROM announcements a
         JOIN users u ON a.author_id = u.user_id
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         LEFT JOIN classes c ON a.class_id = c.class_id
         LEFT JOIN class_enrollments e ON e.class_id = a.class_id AND e.student_id = ?
         WHERE a.is_pinned = 1 AND (a.class_id IS NULL OR e.enrollment_id IS NOT NULL) AND a.is_deleted = 0
         ORDER BY a.date_posted DESC`,
        [req.user.user_id]
      );
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// SMS Reports (Admin only) - must be before /:id route
router.get('/sms-reports', requireRole('Admin'), async (req, res) => {
  try {
    // Get SMS logs with announcement and user details
    const logs = await db.query(`
      SELECT 
        sl.sms_id,
        sl.announcement_id,
        sl.sent_to,
        sl.status,
        sl.date_sent,
        a.title AS announcement_title,
        a.content AS message,
        CONCAT(up.f_name, ' ', up.l_name) AS recipient_name,
        u.role AS recipient_role,
        up.department,
        up.year_level,
        c.contact_value AS phone_num_encrypted
      FROM sms_logs sl
      JOIN announcements a ON sl.announcement_id = a.announcement_id
      JOIN users u ON sl.sent_to = u.user_id
      LEFT JOIN user_profiles up ON u.user_id = up.user_id
      LEFT JOIN contacts c ON u.user_id = c.user_id AND c.contact_type = 'phone'
      ORDER BY sl.date_sent DESC
    `);

    // Decrypt and mask phone numbers for privacy
    const maskedLogs = logs.map(log => {
      let phone_num_masked = '***-****-***';
      try {
        phone_num_masked = encryption.maskEncryptedPhoneNumber(log.phone_num_encrypted);
      } catch (err) {
        console.error('Error decrypting phone for sms_id', log.sms_id, ':', err.message);
      }
      return {
        sms_id: log.sms_id,
        announcement_id: log.announcement_id,
        sent_to: log.sent_to,
        recipient_name: log.recipient_name,
        message: log.message,
        phone_num_masked: phone_num_masked,
        status: log.status,
        date_sent: log.date_sent,
        announcement_title: log.announcement_title,
        recipient_role: log.recipient_role,
        department: log.department,
        year_level: log.year_level
      };
    });

    // Get statistics
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'Sent' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending
      FROM sms_logs
    `);

    res.json({
      logs: maskedLogs || [],
      stats: stats || { total_sent: 0, successful: 0, failed: 0, pending: 0 }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Email Reports (Admin only)
router.get('/email-reports', requireRole('Admin'), async (req, res) => {
  try {
    // Get email logs with announcement and user details
    const logs = await db.query(`
      SELECT 
        el.email_id,
        el.announcement_id,
        el.sent_to,
        el.status,
        el.date_sent,
        a.title AS announcement_title,
        a.content AS message,
        CONCAT(up.f_name, ' ', up.l_name) AS recipient_name,
        u.role AS recipient_role,
        up.department,
        up.year_level,
        c.contact_value AS email_address
      FROM email_logs el
      JOIN announcements a ON el.announcement_id = a.announcement_id
      JOIN users u ON el.sent_to = u.user_id
      LEFT JOIN user_profiles up ON u.user_id = up.user_id
      LEFT JOIN contacts c ON u.user_id = c.user_id AND c.contact_type = 'email'
      ORDER BY el.date_sent DESC
    `);

    // Mask email addresses for privacy
    const maskedLogs = logs.map(log => {
      let email_masked = '***@***.***';
      if (log.email_address) {
        const parts = log.email_address.split('@');
        if (parts.length === 2) {
          const localPart = parts[0].length > 2 ? parts[0][0] + '***' : parts[0];
          const domain = parts[1];
          email_masked = localPart + '@' + domain;
        }
      }
      return {
        email_id: log.email_id,
        announcement_id: log.announcement_id,
        sent_to: log.sent_to,
        recipient_name: log.recipient_name,
        message: log.message,
        email_masked: email_masked,
        status: log.status,
        date_sent: log.date_sent,
        announcement_title: log.announcement_title,
        recipient_role: log.recipient_role,
        department: log.department,
        year_level: log.year_level
      };
    });

    // Get statistics
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'Sent' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending
      FROM email_logs
    `);

    res.json({
      logs: maskedLogs || [],
      stats: stats || { total_sent: 0, successful: 0, failed: 0, pending: 0 }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get one announcement with comments
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ann = await db.get(
      `SELECT a.*, CONCAT(up.f_name, ' ', up.l_name) AS author_name, u.role AS author_role, up.profile_path AS author_profile_path, c.class_name
       FROM announcements a
       JOIN users u ON a.author_id = u.user_id
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       LEFT JOIN classes c ON a.class_id = c.class_id
       WHERE a.announcement_id = ? AND a.is_deleted = 0`,
      [id]
    );
    if (!ann) return res.status(404).json({ error: 'Announcement not found' });
    const comments = await db.query(
      `SELECT co.*, CONCAT(up.f_name, ' ', up.l_name) AS user_name, up.profile_path AS user_profile_path
       FROM comments co
       JOIN users u ON co.user_id = u.user_id
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE co.announcement_id = ?
       ORDER BY co.comment_date`,
      [id]
    );
    const attachments = await db.query('SELECT * FROM announcement_attachments WHERE announcement_id = ?', [id]);
    res.json({ ...ann, comments, attachments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create announcement (Admin: school-wide; Instructor: class or school)
router.post('/', requireRole('Admin', 'Instructor'), async (req, res) => {
  try {
    const { title, content, class_id, target_department, target_year_level } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    const author_id = req.user.user_id;
    let classId = class_id ? parseInt(class_id, 10) : null;

    // Validation for instructors
    if (req.user.role === 'Instructor') {
      if (classId) {
        const cls = await db.get('SELECT * FROM classes WHERE class_id = ? AND instructor_id = ?', [classId, author_id]);
        if (!cls) return res.status(403).json({ error: 'You do not have permission to post to this class' });
      } else {
        // Instructors cannot post school-wide announcements
        classId = null;
      }
    } else if (req.user.role === 'Admin') {
      if (req.body.is_school_announcement) {
        classId = null;
      }
    }

    // Validate targeting values (only admins may set them)
    const validDepts = ['BSBA', 'BSCS', 'BSED', 'BEED'];
    const validYears = ['1st', '2nd', '3rd', '4th'];
    let dept = null;
    let yrlvl = null;
    if (req.user.role === 'Admin') {
      if (typeof target_department !== 'undefined' && target_department !== null && target_department !== '') {
        if (!validDepts.includes(target_department)) return res.status(400).json({ error: 'Invalid target_department' });
        dept = target_department;
      }
      if (typeof target_year_level !== 'undefined' && target_year_level !== null && target_year_level !== '') {
        if (!validYears.includes(target_year_level)) return res.status(400).json({ error: 'Invalid target_year_level' });
        yrlvl = target_year_level;
      }
    }

    // compute school year/term automatically regardless of client input
    const { schoolYear, term } = determineSchoolYearAndTerm();

    // Send SMS to students when Admin posts a school-wide announcement; honor targeting filters
    // Only send if admin explicitly requested SMS via `send_sms` flag
    const sendSmsFlag = req.body && (req.body.send_sms === true || req.body.send_sms === 'true');
    const sendEmailFlag = req.body && (req.body.send_email === true || req.body.send_email === 'true');
    console.log('📢 Announcement posting - sendSmsFlag:', sendSmsFlag, 'sendEmailFlag:', sendEmailFlag);
    
    let smsStats = { sent: 0, failed: 0, total: 0 };
    let emailStats = { sent: 0, failed: 0, total: 0 };
    let smsStatus = 'Sent';

    // **BEFORE POSTING**: Try to send SMS/Email if requested
    if (!classId && req.user.role === 'Admin' && (sendSmsFlag || sendEmailFlag)) {
      const recipients = await db.query(
        `SELECT u.user_id, c.contact_value as phone_num, c2.contact_value as email, up.f_name, up.l_name FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         LEFT JOIN contacts c ON u.user_id = c.user_id AND c.contact_type = 'phone'
         LEFT JOIN contacts c2 ON u.user_id = c2.user_id AND c2.contact_type = 'email'
         WHERE u.role = 'Student'
           AND ( ? IS NULL OR up.department = ? )
           AND ( ? IS NULL OR up.year_level = ? )`,
        [dept, dept, yrlvl, yrlvl]
      );
      console.log('📊 Recipients found:', recipients.length);

      // Send SMS if requested
      if (sendSmsFlag && recipients.filter(r => r.phone_num).length > 0) {
        let smsMessage = `Diaz College Integrated Announcement Management System: ${title}\n\n${content}`;
        smsMessage += `\n\n📎 Check the portal for attachments and more updates.`;

        const phoneNumbers = recipients
          .map((r) => decryptAndNormalizePhone(r.phone_num))
          .filter(Boolean);
        
        smsStats.total = recipients.filter(r => r.phone_num).length;
        
        if (phoneNumbers.length > 0) {
          const result = await sendSmsBatch(phoneNumbers, smsMessage, 150, 500);
          smsStats.sent = result.succeeded;
          smsStats.failed = result.failed;
          smsStatus = result.failed > 0 ? 'PartiallyFailed' : 'Sent';
          
          if (result.errors.length > 0) {
            console.error('SMS batch errors:', result.errors);
          }
          
          // If SMS failed completely, don't post the announcement
          if (smsStats.sent === 0 && smsStats.total > 0) {
            return res.status(400).json({ 
              error: `Failed to send SMS to ${smsStats.total} recipient(s). Announcement not posted. Please try again.`,
              smsStats 
            });
          }
        }
      }

      // Send Email if requested
      if (sendEmailFlag) {
        const author = await db.get(
          `SELECT up.f_name, up.l_name FROM users u 
           LEFT JOIN user_profiles up ON u.user_id = up.user_id 
           WHERE u.user_id = ?`,
          [author_id]
        );
        const authorName = author ? `${author.f_name || ''} ${author.l_name || ''}`.trim() : 'Administrator';
        
        emailStats.total = recipients.filter(r => r.email).length;
        
        // Build email log entries as we send
        const emailLogEntries = [];
        
        for (const recipient of recipients) {
          if (recipient.email) {
            const result = await sendAnnouncementEmail(
              recipient.email,
              title,
              content,
              authorName,
              'School-wide Announcement'
            );
            if (result.success) {
              emailStats.sent++;
              emailLogEntries.push({ user_id: recipient.user_id, status: 'Sent' });
            } else {
              emailStats.failed++;
              emailLogEntries.push({ user_id: recipient.user_id, status: 'Failed' });
              console.error(`Failed to send email to ${recipient.email}:`, result.error);
            }
          }
        }
        
        // If email failed completely, don't post the announcement
        if (emailStats.sent === 0 && emailStats.total > 0) {
          return res.status(400).json({ 
            error: `Failed to send email to ${emailStats.total} recipient(s). Announcement not posted. Please try again.`,
            emailStats 
          });
        }
        
        // Store email logs for later insertion after announcement is posted
        if (emailLogEntries.length > 0) {
          req.emailLogEntries = emailLogEntries;
        }
      }
    }

    // **NOW POST THE ANNOUNCEMENT** (only if sending succeeded or wasn't requested)
    await db.run(
      `INSERT INTO announcements (author_id, class_id, title, content, target_department, target_year_level, school_year, term)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [author_id, classId, title, content, dept, yrlvl, schoolYear, term]
    );
    const row = await db.get('SELECT * FROM announcements ORDER BY announcement_id DESC LIMIT 1');

    // Log school-wide emails if any
    if (!classId && req.user.role === 'Admin' && sendEmailFlag && req.emailLogEntries) {
      const placeholders = req.emailLogEntries.map(() => '(?, ?, ?)').join(',');
      const values = [];
      
      for (const entry of req.emailLogEntries) {
        values.push(row.announcement_id, entry.user_id, entry.status);
      }
      
      await db.run(
        `INSERT INTO email_logs (announcement_id, sent_to, status) 
         VALUES ${placeholders}`,
        values
      );
    }

    // For school-wide announcements, log SMS stats if we sent SMS
    if (!classId && req.user.role === 'Admin' && sendSmsFlag) {
      const recipients = await db.query(
        `SELECT u.user_id FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         LEFT JOIN contacts c ON u.user_id = c.user_id AND c.contact_type = 'phone'
         WHERE u.role = 'Student' AND c.contact_value IS NOT NULL AND TRIM(c.contact_value) != ''
           AND ( ? IS NULL OR up.department = ? )
           AND ( ? IS NULL OR up.year_level = ? )`,
        [dept, dept, yrlvl, yrlvl]
      );
      
      const studentIds = recipients.map((r) => r.user_id);
      if (studentIds.length > 0) {
        const placeholders = studentIds.map(() => '(?, ?, ?)').join(',');
        const values = [];
        
        for (let i = 0; i < studentIds.length; i++) {
          values.push(row.announcement_id, studentIds[i], smsStatus);
        }
        
        await db.run(
          `INSERT INTO sms_logs (announcement_id, sent_to, status) 
           VALUES ${placeholders}`,
          values
        );
      }
    }
    
    // For class announcements, send SMS if requested
    if (classId && sendSmsFlag) {
      const enrollments = await db.query(
        `SELECT u.user_id, c.contact_value as phone_num FROM users u
         LEFT JOIN contacts c ON u.user_id = c.user_id AND c.contact_type = 'phone'
         LEFT JOIN class_enrollments ce ON u.user_id = ce.student_id
         WHERE ce.class_id = ? AND c.contact_value IS NOT NULL AND TRIM(c.contact_value) != ''`,
        [classId]
      );

      smsStats.total = enrollments.length;

      if (enrollments.length > 0) {
        const phoneNumbers = enrollments
          .map((r) => decryptAndNormalizePhone(r.phone_num))
          .filter(Boolean);

        if (phoneNumbers.length > 0) {
          let smsMessage = `${title}\n\nOpen the system to read full details`;
          const result = await sendSmsBatch(phoneNumbers, smsMessage, 150, 500);
          smsStats.sent = result.succeeded;
          smsStats.failed = result.failed;
          smsStatus = result.failed > 0 ? 'PartiallyFailed' : 'Sent';

          if (result.errors.length > 0) {
            console.error('SMS batch errors:', result.errors);
          }

          // If SMS failed completely, don't post the announcement
          if (smsStats.sent === 0 && smsStats.total > 0) {
            return res.status(400).json({
              error: `Failed to send SMS to ${smsStats.total} student(s). Announcement not posted. Please try again.`,
              smsStats
            });
          }
        }
      }
    }

    // For class announcements, send emails if requested
    if (classId && sendEmailFlag) {
      const enrollments = await db.query(
        `SELECT u.user_id, c.contact_value as email, up.f_name, up.l_name FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         LEFT JOIN contacts c ON u.user_id = c.user_id AND c.contact_type = 'email'
         LEFT JOIN class_enrollments ce ON u.user_id = ce.student_id
         WHERE ce.class_id = ? AND c.contact_value IS NOT NULL AND TRIM(c.contact_value) != ''`,
        [classId]
      );
      
      const author = await db.get(
        `SELECT up.f_name, up.l_name FROM users u 
         LEFT JOIN user_profiles up ON u.user_id = up.user_id 
         WHERE u.user_id = ?`,
        [author_id]
      );
      const authorName = author ? `${author.f_name || ''} ${author.l_name || ''}`.trim() : 'Instructor';
      
      const getClassName = await db.get('SELECT class_name FROM classes WHERE class_id = ?', [classId]);
      const className = getClassName ? getClassName.class_name : 'Class Announcement';
      
      emailStats = { sent: 0, failed: 0, total: enrollments.length };
      
      // Build email log entries as we send
      const emailLogEntries = [];
      
      for (const enrollment of enrollments) {
        const result = await sendAnnouncementEmail(
          enrollment.email,
          title,
          content,
          authorName,
          className
        );
        if (result.success) {
          emailStats.sent++;
          emailLogEntries.push({ user_id: enrollment.user_id, status: 'Sent' });
        } else {
          emailStats.failed++;
          emailLogEntries.push({ user_id: enrollment.user_id, status: 'Failed' });
          console.error(`Failed to send email to ${enrollment.email}:`, result.error);
        }
      }
      
      // If email failed completely, don't post the announcement
      if (emailStats.sent === 0 && emailStats.total > 0) {
        return res.status(400).json({ 
          error: `Failed to send email to ${emailStats.total} recipient(s). Announcement not posted. Please try again.`,
          emailStats 
        });
      }
      
      // Store email logs for later insertion after announcement is posted
      if (emailLogEntries.length > 0) {
        req.emailLogEntries = emailLogEntries;
      }
    }

    // Return announcement with stats
    const responseData = { 
      ...row, 
      smsStats: sendSmsFlag ? smsStats : undefined,
      emailStats: sendEmailFlag ? emailStats : undefined
    };
    
    // Log class announcement emails if any
    if (classId && sendEmailFlag && req.emailLogEntries) {
      const placeholders = req.emailLogEntries.map(() => '(?, ?, ?)').join(',');
      const values = [];
      
      for (const entry of req.emailLogEntries) {
        values.push(row.announcement_id, entry.user_id, entry.status);
      }
      
      await db.run(
        `INSERT INTO email_logs (announcement_id, sent_to, status) 
         VALUES ${placeholders}`,
        values
      );
    }

    // Log class announcement SMS if sent
    if (classId && sendSmsFlag) {
      const enrollments = await db.query(
        `SELECT u.user_id FROM users u
         LEFT JOIN contacts c ON u.user_id = c.user_id AND c.contact_type = 'phone'
         LEFT JOIN class_enrollments ce ON u.user_id = ce.student_id
         WHERE ce.class_id = ? AND c.contact_value IS NOT NULL AND TRIM(c.contact_value) != ''`,
        [classId]
      );
      
      const studentIds = enrollments.map((r) => r.user_id);
      if (studentIds.length > 0) {
        const placeholders = studentIds.map(() => '(?, ?, ?)').join(',');
        const values = [];
        
        for (let i = 0; i < studentIds.length; i++) {
          values.push(row.announcement_id, studentIds[i], smsStatus);
        }
        
        await db.run(
          `INSERT INTO sms_logs (announcement_id, sent_to, status) 
           VALUES ${placeholders}`,
          values
        );
      }
    }
    
    res.status(201).json(responseData);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload attachment to announcement
router.post('/:id/attachments', auth, requireRole('Admin', 'Instructor'), (req, res, next) => {
  // Handle multer errors
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Check if announcement exists and user has permission
    const ann = await db.get('SELECT * FROM announcements WHERE announcement_id = ?', [id]);
    if (!ann) return res.status(404).json({ error: 'Announcement not found' });

    console.log('Attachment upload - User:', req.user?.user_id, 'Role:', req.user?.role, 'Announcement ID:', id, 'Class ID:', ann.class_id);

    // Permission check
    if (req.user.role === 'Instructor') {
      if (ann.class_id) {
        const cls = await db.get('SELECT * FROM classes WHERE class_id = ? AND instructor_id = ?', [ann.class_id, req.user.user_id]);
        if (!cls) {
          console.log('Instructor permission denied - not owner of class', ann.class_id);
          return res.status(403).json({ error: 'You do not have permission to modify this announcement' });
        }
      } else {
        console.log('Instructor cannot modify school-wide announcements');
        return res.status(403).json({ error: 'Instructors cannot modify school-wide announcements' });
      }
    }

    // Insert attachment record
    const filePath = `uploads/${req.file.filename}`;
    await db.run(
      'INSERT INTO announcement_attachments (announcement_id, filename, file_path, size) VALUES (?, ?, ?, ?)',
      [id, req.file.originalname, filePath, req.file.size]
    );

    const attachment = await db.get('SELECT * FROM announcement_attachments ORDER BY attachment_id DESC LIMIT 1');
    res.status(201).json(attachment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit announcement (author or admin) with file management
router.patch('/:id', (req, res) => {
  // Handle multer errors
  upload.array('files', 10)(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    }

    try {
      const id = parseInt(req.params.id, 10);
      const { title, content, remove_attachments } = req.body;
      
      if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
      
      const ann = await db.get('SELECT author_id FROM announcements WHERE announcement_id = ?', [id]);
      if (!ann) return res.status(404).json({ error: 'Announcement not found' });
      
      // Only author or admin can edit
      if (req.user.role !== 'Admin' && req.user.user_id !== ann.author_id) {
        return res.status(403).json({ error: 'You do not have permission to edit this announcement' });
      }
      
      // Parse and handle removed attachments
      let attachmentsToRemove = [];
      if (remove_attachments) {
        try {
          attachmentsToRemove = JSON.parse(remove_attachments);
        } catch (e) {
          console.error('Failed to parse remove_attachments:', e);
        }
      }
      
      // Delete removed attachments from database and disk
      for (const attachmentId of attachmentsToRemove) {
        const attachment = await db.get('SELECT file_path FROM announcement_attachments WHERE attachment_id = ?', [attachmentId]);
        if (attachment) {
          const filePath = path.join(__dirname, '../../', attachment.file_path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          await db.run('DELETE FROM announcement_attachments WHERE attachment_id = ?', [attachmentId]);
        }
      }
      
      // Add new uploaded files
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const filePath = `uploads/${file.filename}`;
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          await db.run(
            'INSERT INTO announcement_attachments (announcement_id, filename, file_path, size) VALUES (?, ?, ?, ?)',
            [id, file.originalname, filePath, `${sizeMB} MB`]
          );
        }
      }
      
      // Update announcement text
      const result = await db.run(
        'UPDATE announcements SET title = ?, content = ?, date_posted = NOW() WHERE announcement_id = ?',
        [title.trim(), content.trim(), id]
      );
      
      if (result.changes === 0) return res.status(404).json({ error: 'Announcement not found' });
      
      res.json({ message: 'Announcement updated successfully' });
    } catch (err) {
      console.error('PATCH /announcements/:id error:', err);
      res.status(500).json({ error: 'Server error: ' + err.message });
    }
  });
});

// Toggle pinned (Admin only)
router.patch('/:id/pin', requireRole('Admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.run('UPDATE announcements SET is_pinned = 1 - is_pinned WHERE announcement_id = ?', [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Announcement not found' });
    const row = await db.get('SELECT announcement_id, is_pinned FROM announcements WHERE announcement_id = ?', [id]);
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add comment
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { comment_text } = req.body;
    if (!comment_text || !comment_text.trim()) return res.status(400).json({ error: 'Comment text required' });
    const ann = await db.get('SELECT announcement_id FROM announcements WHERE announcement_id = ?', [id]);
    if (!ann) return res.status(404).json({ error: 'Announcement not found' });
    await db.run('INSERT INTO comments (announcement_id, user_id, comment_text) VALUES (?, ?, ?)', [id, req.user.user_id, comment_text.trim()]);
    const row = await db.get(
      `SELECT co.*, CONCAT(up.f_name, ' ', up.l_name) AS user_name, u.profile_path AS user_profile_path
       FROM comments co
       JOIN users u ON co.user_id = u.user_id
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE co.comment_id = (SELECT LAST_INSERT_ID())`,
      []
    );
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete comment (author or admin only)
router.delete('/:id/comments/:comment_id', auth, async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id, 10);
    const commentId = parseInt(req.params.comment_id, 10);
    
    const comment = await db.get('SELECT user_id FROM comments WHERE comment_id = ? AND announcement_id = ?', [commentId, announcementId]);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    
    // Only comment author or admin can delete
    if (req.user.role !== 'Admin' && req.user.user_id !== comment.user_id) {
      return res.status(403).json({ error: 'You do not have permission to delete this comment' });
    }
    
    await db.run('DELETE FROM comments WHERE comment_id = ?', [commentId]);
    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete announcement (soft delete - author or admin)
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const ann = await db.get('SELECT author_id FROM announcements WHERE announcement_id = ?', [id]);
    if (!ann) return res.status(404).json({ error: 'Announcement not found' });
    
    // Only author or admin can delete
    if (req.user.role !== 'Admin' && req.user.user_id !== ann.author_id) {
      return res.status(403).json({ error: 'You do not have permission to delete this announcement' });
    }
    
    // Soft delete: set is_deleted = 1
    const result = await db.run(
      'UPDATE announcements SET is_deleted = 1 WHERE announcement_id = ?',
      [id]
    );
    
    if (result.changes === 0) return res.status(404).json({ error: 'Announcement not found' });
    
    res.json({ message: 'Announcement deleted successfully' });
  } catch (err) {
    console.error('DELETE /announcements/:id error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
