const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const pool = require('../db');

const execAsync = promisify(exec);

// Backup directory
const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Create a database backup
 * @returns {Promise<{success: boolean, message: string, filename?: string, error?: string}>}
 */
async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `backup_${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'announcement_management_db';

    // Try common XAMPP/MySQL installation paths
    const possiblePaths = [
      'C:\\xampp\\mysql\\bin\\mysqldump.exe',
      'C:\\mysql\\bin\\mysqldump.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysqldump.exe',
      'mysqldump' // fallback to PATH
    ];

    let mysqldumpPath = null;
    for (const path of possiblePaths) {
      try {
        if (path === 'mysqldump' || fs.existsSync(path)) {
          mysqldumpPath = path;
          break;
        }
      } catch (e) {
        // continue to next path
      }
    }

    if (!mysqldumpPath) {
      throw new Error('mysqldump not found. Please ensure MySQL/MariaDB is installed and accessible.');
    }

    // Build mysqldump command
    let command = `"${mysqldumpPath}" -h ${dbHost} -u ${dbUser}`;
    if (dbPassword) {
      command += ` -p${dbPassword}`;
    }
    command += ` --single-transaction --quick --lock-tables=false ${dbName} > "${filepath}"`;

    // Execute backup
    await execAsync(command);

    // Verify backup was created
    if (!fs.existsSync(filepath)) {
      throw new Error('Backup file was not created');
    }

    const stats = fs.statSync(filepath);
    console.log(`✓ Database backup created: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);

    return {
      success: true,
      message: `Backup created successfully: ${filename}`,
      filename: filename,
      size: stats.size,
      timestamp: new Date(timestamp.replace(/-/g, ':').slice(0, 19))
    };
  } catch (error) {
    console.error('Backup error:', error.message);
    return {
      success: false,
      message: 'Backup failed',
      error: error.message
    };
  }
}

/**
 * List all available backups
 * @returns {Promise<Array>} Array of backup files with metadata
 */
async function listBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return [];
    }

    const files = fs.readdirSync(BACKUP_DIR);
    const backups = files
      .filter(f => f.endsWith('.sql'))
      .map(filename => {
        const filepath = path.join(BACKUP_DIR, filename);
        const stats = fs.statSync(filepath);
        return {
          filename,
          size: stats.size,
          sizeFormatted: (stats.size / 1024).toFixed(2) + ' KB',
          created: stats.mtime,
          createdFormatted: stats.mtime.toLocaleString()
        };
      })
      .sort((a, b) => b.created - a.created); // Newest first

    return backups;
  } catch (error) {
    console.error('Error listing backups:', error.message);
    return [];
  }
}

/**
 * Restore database from a backup
 * @param {string} filename - Backup filename to restore
 * @returns {Promise<{success: boolean, message: string, error?: string}>}
 */
async function restoreBackup(filename) {
  try {
    // Validate filename (prevent directory traversal)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error('Invalid filename');
    }

    const filepath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error(`Backup file not found: ${filename}`);
    }

    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'announcement_management_db';

    // Try common XAMPP/MySQL installation paths
    const possiblePaths = [
      'C:\\xampp\\mysql\\bin\\mysql.exe',
      'C:\\mysql\\bin\\mysql.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysql.exe',
      'mysql' // fallback to PATH
    ];

    let mysqlPath = null;
    for (const p of possiblePaths) {
      try {
        if (p === 'mysql' || fs.existsSync(p)) {
          mysqlPath = p;
          break;
        }
      } catch (e) {
        // continue to next path
      }
    }

    if (!mysqlPath) {
      throw new Error('mysql client not found. Please ensure MySQL/MariaDB is installed and accessible.');
    }

    // Build mysql command to restore
    let command = `"${mysqlPath}" -h ${dbHost} -u ${dbUser}`;
    if (dbPassword) {
      command += ` -p${dbPassword}`;
    }
    command += ` ${dbName} < "${filepath}"`;

    console.log(`Restoring from backup: ${filename}...`);
    await execAsync(command);

    console.log(`✓ Database restored from ${filename}`);
    return {
      success: true,
      message: `Database restored successfully from ${filename}`
    };
  } catch (error) {
    console.error('Restore error:', error.message);
    return {
      success: false,
      message: 'Restore failed',
      error: error.message
    };
  }
}

/**
 * Delete a backup file
 * @param {string} filename - Backup filename to delete
 * @returns {Promise<{success: boolean, message: string, error?: string}>}
 */
async function deleteBackup(filename) {
  try {
    // Validate filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error('Invalid filename');
    }

    const filepath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error(`Backup file not found: ${filename}`);
    }

    fs.unlinkSync(filepath);
    console.log(`✓ Backup deleted: ${filename}`);

    return {
      success: true,
      message: `Backup deleted: ${filename}`
    };
  } catch (error) {
    console.error('Delete error:', error.message);
    return {
      success: false,
      message: 'Delete failed',
      error: error.message
    };
  }
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  BACKUP_DIR
};
