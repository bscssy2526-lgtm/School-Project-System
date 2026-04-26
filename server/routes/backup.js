const express = require('express');
const router = express.Router();
const bcryptjs = require('bcryptjs');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { createBackup, listBackups, restoreBackup, deleteBackup } = require('../utils/backup');

/**
 * POST /api/backup/create - Create a new database backup
 */
router.post('/create', auth, requireRole('Admin'), async (req, res) => {
  const result = await createBackup();
  const statusCode = result.success ? 200 : 500;
  res.status(statusCode).json(result);
});

/**
 * GET /api/backup/list - List all available backups
 */
router.get('/list', auth, requireRole('Admin'), async (req, res) => {
  try {
    const backups = await listBackups();
    res.status(200).json({
      success: true,
      backups: backups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to list backups',
      error: error.message
    });
  }
});

/**
 * POST /api/backup/restore - Restore database from a backup
 * Requires password confirmation and creates auto-backup first
 */
router.post('/restore', auth, requireRole('Admin'), async (req, res) => {
  const { filename, password } = req.body;

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Backup filename is required'
    });
  }

  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password confirmation is required'
    });
  }

  try {
    // Verify admin password
    const adminUser = await db.get('SELECT password FROM users WHERE user_id = ?', [req.user.user_id]);
    
    if (!adminUser) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const passwordMatch = await bcryptjs.compare(password, adminUser.password);
    if (!passwordMatch) {
      return res.status(403).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Create auto-backup before restore
    const autoBackupResult = await createBackup();
    if (!autoBackupResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create safety backup. Restore cancelled.',
        error: autoBackupResult.error
      });
    }

    // Now restore from the selected backup
    const result = await restoreBackup(filename);
    const statusCode = result.success ? 200 : 500;
    
    // Include auto-backup info in response
    result.autoBackup = {
      filename: autoBackupResult.filename,
      message: 'Current database was backed up before restore'
    };
    
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Restore failed',
      error: error.message
    });
  }
});

/**
 * DELETE /api/backup/:filename - Delete a backup file
 */
router.delete('/:filename', auth, requireRole('Admin'), async (req, res) => {
  const { filename } = req.params;

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Backup filename is required'
    });
  }

  const result = await deleteBackup(filename);
  const statusCode = result.success ? 200 : 500;
  res.status(statusCode).json(result);
});

module.exports = router;
