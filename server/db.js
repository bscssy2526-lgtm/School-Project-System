const mysql = require('mysql2/promise');

// XAMPP MySQL: default user root, no password; set DB_* in .env
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'announcement_management_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return Array.isArray(rows) ? rows : [];
}

async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

async function run(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return {
    insertId: result.insertId,
    affectedRows: result.affectedRows,
    changes: result.affectedRows,
  };
}

module.exports = { pool, query, get, run };

