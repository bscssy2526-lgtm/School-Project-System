const express = require('express');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// List classes (Admin: all; Instructor: mine; Student: enrolled)
router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'Admin') {
      const rows = await db.query(`
        SELECT c.class_id, UPPER(c.class_name) AS class_name, UPPER(c.section) AS section, c.description, c.created_at,
               COALESCE(CONCAT(up.f_name, ' ', up.l_name), '(missing instructor)') AS instructor_name, c.instructor_id AS instructor_id,
               (SELECT COUNT(*) FROM class_enrollments WHERE class_id = c.class_id) AS student_count,
               (SELECT COUNT(*) FROM announcements WHERE class_id = c.class_id AND is_deleted = 0) AS announcement_count
        FROM classes c
        LEFT JOIN users u ON c.instructor_id = u.user_id
        LEFT JOIN user_profiles up ON u.user_id = up.user_id
        ORDER BY c.class_name, c.section
      `);
      return res.json(rows);
    }
    if (req.user.role === 'Instructor') {
      const rows = await db.query(
        `SELECT c.class_id, UPPER(c.class_name) AS class_name, UPPER(c.section) AS section, c.description, c.created_at,
                (SELECT COUNT(*) FROM class_enrollments WHERE class_id = c.class_id) AS student_count,
                (SELECT COUNT(*) FROM announcements WHERE class_id = c.class_id AND is_deleted = 0) AS announcement_count
         FROM classes c
         WHERE c.instructor_id = ?
         ORDER BY c.class_name, c.section`,
        [req.user.user_id]
      );
      return res.json(rows);
    }
    // student view with announcement count
    const studentRows = await db.query(
      `SELECT c.class_id, UPPER(c.class_name) AS class_name, UPPER(c.section) AS section, c.description, CONCAT(up.f_name, ' ', up.l_name) AS instructor_name,
              (SELECT COUNT(*) FROM announcements WHERE class_id = c.class_id AND is_deleted = 0) AS announcement_count,
              (SELECT COUNT(*) FROM class_enrollments WHERE class_id = c.class_id) AS student_count
       FROM class_enrollments e
       JOIN classes c ON e.class_id = c.class_id
       JOIN users u ON c.instructor_id = u.user_id
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE e.student_id = ?
       ORDER BY c.class_name, c.section`,
      [req.user.user_id]
    );
    return res.json(studentRows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get one class with enrollments (Admin/Instructor)
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cls = await db.get(
      `SELECT c.class_id, UPPER(c.class_name) AS class_name, UPPER(c.section) AS section, c.description, c.instructor_id, c.created_at,
              CONCAT(COALESCE(up.f_name, ''), ' ', COALESCE(up.l_name, '')) AS instructor_name
       FROM classes c
       LEFT JOIN users u ON c.instructor_id = u.user_id
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE c.class_id = ?`,
      [id]
    );
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (req.user.role === 'Instructor' && cls.instructor_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const enrollments = await db.query(
      `SELECT e.enrollment_id, e.enrollment_date, u.user_id, CONCAT(up.f_name, ' ', up.l_name) AS name, up.student_id, up.department, up.year_level
       FROM class_enrollments e
       JOIN users u ON e.student_id = u.user_id
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE e.class_id = ?
       ORDER BY up.l_name, up.f_name`,
      [id]
    );
    res.json({ ...cls, enrollments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create class (Admin: any instructor; Instructor: self only)
router.post('/', requireRole('Admin', 'Instructor'), async (req, res) => {
  try {
    let { class_name, section, instructor_id, description } = req.body;
    if (!class_name) {
      return res.status(400).json({ error: 'Class code required' });
    }

    // If instructor, they can only create for themselves
    if (req.user.role === 'Instructor') {
      instructor_id = req.user.user_id;
    } else if (!instructor_id) {
      return res.status(400).json({ error: 'Instructor ID required for admin' });
    }

    // normalize to uppercase and trim
    class_name = class_name.toString().trim().toUpperCase();
    section = (section || 'A').toString().trim().toUpperCase();

    // Prevent duplicates at application level (also rely on unique index if present)
    const existing = await db.get(
      `SELECT class_id FROM classes WHERE class_name = ? AND section = ?`,
      [class_name, section]
    );
    if (existing) {
      return res.status(400).json({ error: 'Class code and section combination already exists' });
    }

    try {
      await db.run(
        `INSERT INTO classes (class_name, section, instructor_id, description)
         VALUES (?, ?, ?, ?)`,
        [class_name, section, instructor_id, description || null]
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Class code and section combination already exists' });
      }
      throw e;
    }
    let row = await db.get('SELECT * FROM classes ORDER BY class_id DESC LIMIT 1');
    if (row) {
      row.class_name = row.class_name && row.class_name.toString().toUpperCase();
      row.section = row.section && row.section.toString().toUpperCase();
    }
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update class (Admin: any; Instructor: own classes only)
router.patch('/:id', requireRole('Admin', 'Instructor'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    // Check ownership for instructors
    if (req.user.role === 'Instructor') {
      const cls = await db.get('SELECT instructor_id FROM classes WHERE class_id = ?', [id]);
      if (!cls) return res.status(404).json({ error: 'Class not found' });
      if (cls.instructor_id !== req.user.user_id) {
        return res.status(403).json({ error: 'Forbidden: You can only update your own classes' });
      }
    }
    
    let { class_name, section, instructor_id, description } = req.body;
    const updates = [];
    const params = [];

    // normalize incoming values if provided
    if (class_name !== undefined) {
      class_name = class_name.toString().trim().toUpperCase();
      updates.push('class_name = ?'); params.push(class_name);
    }
    if (section !== undefined) {
      section = section.toString().trim().toUpperCase() || 'A';
      updates.push('section = ?'); params.push(section);
    }
    if (instructor_id !== undefined) { updates.push('instructor_id = ?'); params.push(instructor_id); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (updates.length === 0) return res.json({ message: 'No changes' });

    // check duplicate before running update
    if (class_name !== undefined || section !== undefined) {
      // need current values for missing fields
      const cls = await db.get('SELECT class_name, section FROM classes WHERE class_id = ?', [id]);
      if (!cls) return res.status(404).json({ error: 'Class not found' });
      const newName = class_name !== undefined ? class_name : cls.class_name.toString().toUpperCase();
      const newSec = section !== undefined ? section : (cls.section || 'A').toString().toUpperCase();
      const dup = await db.get(
        `SELECT class_id FROM classes WHERE class_name = ? AND section = ? AND class_id <> ?`,
        [newName, newSec, id]
      );
      if (dup) {
        return res.status(400).json({ error: 'Class code and section combination already exists' });
      }
    }

    params.push(id);
    try {
      const result = await db.run(`UPDATE classes SET ${updates.join(', ')} WHERE class_id = ?`, params);
      if (result.changes === 0) return res.status(404).json({ error: 'Class not found' });
      res.json({ message: 'Updated' });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Class code and section combination already exists' });
      }
      throw e;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete class (Admin: any; Instructor: own classes only)
router.delete('/:id', requireRole('Admin', 'Instructor'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    // Check ownership for instructors
    if (req.user.role === 'Instructor') {
      const cls = await db.get('SELECT instructor_id FROM classes WHERE class_id = ?', [id]);
      if (!cls) return res.status(404).json({ error: 'Class not found' });
      if (cls.instructor_id !== req.user.user_id) {
        return res.status(403).json({ error: 'Forbidden: You can only delete your own classes' });
      }
    }
    
    await db.run('DELETE FROM class_enrollments WHERE class_id = ?', [id]);
    const result = await db.run('DELETE FROM classes WHERE class_id = ?', [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Class not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Enroll students in class (Admin: any class; Instructor: own classes only)
router.post('/:id/enrollments', requireRole('Admin', 'Instructor'), async (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    const { student_ids } = req.body;
    if (!Array.isArray(student_ids)) return res.status(400).json({ error: 'student_ids array required' });
    
    // Check ownership for instructors
    if (req.user.role === 'Instructor') {
      const cls = await db.get('SELECT instructor_id FROM classes WHERE class_id = ?', [classId]);
      if (!cls) return res.status(404).json({ error: 'Class not found' });
      if (cls.instructor_id !== req.user.user_id) {
        return res.status(403).json({ error: 'Forbidden: You can only enroll students in your own classes' });
      }
    }
    
    for (const sid of student_ids) {
      await db.run('INSERT IGNORE INTO class_enrollments (class_id, student_id) VALUES (?, ?)', [classId, sid]);
    }
    res.json({ message: 'Enrollments updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove enrollment (Admin: any class; Instructor: own classes only)
router.delete('/:id/enrollments/:studentId', requireRole('Admin', 'Instructor'), async (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    const studentId = parseInt(req.params.studentId, 10);
    
    // Check ownership for instructors
    if (req.user.role === 'Instructor') {
      const cls = await db.get('SELECT instructor_id FROM classes WHERE class_id = ?', [classId]);
      if (!cls) return res.status(404).json({ error: 'Class not found' });
      if (cls.instructor_id !== req.user.user_id) {
        return res.status(403).json({ error: 'Forbidden: You can only remove enrollments from your own classes' });
      }
    }
    
    const result = await db.run('DELETE FROM class_enrollments WHERE class_id = ? AND student_id = ?', [classId, studentId]);
    if (result.changes === 0) return res.status(404).json({ error: 'Enrollment not found' });
    res.json({ message: 'Removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
