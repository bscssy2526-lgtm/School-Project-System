/**
 * Initialize MySQL database for XAMPP.
 * 1. Creates database if not exists.
 * 2. Runs schema.sql (tables).
 * 3. Seeds users, classes, enrollments, announcements, comments.
 *
 * Run from project root: node server/scripts/init-db.js
 * Or from server: node scripts/init-db.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'announcement_management_db';

async function main() {
  // 1. Drop and recreate database for a clean slate (avoids FK / leftover data issues)
  let conn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });
  await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await conn.query(`CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();

  // 2. Run schema
  conn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  });
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  // Run each statement separately so tables are created in order (users before classes, etc.)
  const statements = schema
    .split(';')
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await conn.query(stmt + ';');
  }
  await conn.end();

  // 3. Seed (using pool with database)
  const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });

  // Allow inserts in any order (avoids FK errors if schema/order is inconsistent)
  await pool.execute('SET FOREIGN_KEY_CHECKS = 0');

  const passwordHash = bcrypt.hashSync('password123', 10);

  // User data: [user_id, f_name, l_name, username, role, student_id, department, year_level]
  const users = [
    [1, 'Alberto', 'Pablo', 'admin1', 'Admin', null, null, null],
    [2, 'Juan', 'Dela Cruz', 'instructor1', 'Instructor', null, null, null],
    [3, 'Maria Leonora', 'Teresa', 'admin2', 'Admin', null, null, null],
    [4, 'Jose', 'Manalo', 'instructor2', 'Instructor', null, null, null],
    [5, 'Juan', 'Dela Cruz', 'GLP012103', 'Student', 'GLP012103', 'BSBA', '1st'],
    [6, 'Gabriel', 'Padua', 'GLP012104', 'Student', 'GLP012104', 'BSBA', '1st'],
    [7, 'Bong', 'Revilla', 'BNR042899', 'Student', 'BNR042899', 'BSCS', '3rd'],
    [8, 'Joana', 'Saycon', 'JMS122101', 'Student', 'JMS122101', 'BSCS', '4th'],
    [9, 'April', 'Lavigne', 'instructor3', 'Instructor', null, null, null],
    [10, 'Peter', 'Parker', 'instructor4', 'Instructor', null, null, null],
    [11, 'Maria', 'Dela Cruz', 'instructor5', 'Instructor', null, null, null],
    [12, 'Josie', 'De Guzman', 'instructor6', 'Instructor', null, null, null],
  ];

  // Insert into users and user_profiles
  for (const u of users) {
    const [user_id, f_name, l_name, username, role, student_id, department, year_level] = u;
    
    // Insert into users table
    await pool.execute(
      `INSERT INTO users (user_id, username, password, role, change_pass)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE username = VALUES(username), password = VALUES(password)`,
      [user_id, username, passwordHash, role]
    );

    // Insert into user_profiles table
    await pool.execute(
      `INSERT INTO user_profiles (user_id, f_name, m_name, l_name, student_id, department, year_level)
       VALUES (?, ?, NULL, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE f_name = VALUES(f_name), l_name = VALUES(l_name), student_id = VALUES(student_id), department = VALUES(department), year_level = VALUES(year_level)`,
      [user_id, f_name, l_name, student_id, department, year_level]
    );
  }

  const classes = [
    [1, 'ENG11', 'A', 2, 'Basic Communication Skills'],
    [2, 'ENG11', 'B', 2, 'Basic Communication Skills'],
    [3, 'MATH12', 'A', 11, 'College Algebra'],
    [4, 'CS100', 'A', 12, 'Computer Keyboarding'],
    [5, 'CS100', 'B', 12, 'Computer Keyboarding'],
    [6, 'CS100', 'C', 12, 'Computer Keyboarding'],
    [7, 'CS101', 'A', 10, 'Introduction to Computing'],
    [8, 'CS101', 'B', 4, 'Introduction to Computing'],
    [9, 'CS102', 'A', 4, 'Data Structures'],
    [10, 'CWTS1', 'A', 4, 'Civic Welfare Training Service'],
    [11, 'SOCSCI1', 'A', 4, 'Society and Culture'],
    [12, 'MATH11', 'A', 4, 'College Mathematics'],
  ];
  for (const c of classes) {
    await pool.execute(
      `INSERT INTO classes (class_id, class_name, section, instructor_id, description)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE class_name = VALUES(class_name), section = VALUES(section), instructor_id = VALUES(instructor_id), description = VALUES(description)`,
      c
    );
  }

  const enrollments = [
    [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5],
    [7, 6], [8, 6], [9, 6],
    [7, 7], [3, 7], [4, 7],
    [7, 8], [3, 8], [4, 8],
  ];
  for (const e of enrollments) {
    await pool.execute('INSERT IGNORE INTO class_enrollments (class_id, student_id) VALUES (?, ?)', e);
  }

  const announcements = [
    [1, 3, null, 'Lorem Ipsum', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.', '2024-2025', '1st', 1],
    [2, 4, 7, 'Lorem Ipsum', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.', '2024-2025', '1st', 0],
    [3, 3, null, 'Lorem Ipsum', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', '2024-2025', '1st', 1],
  ];
  for (const a of announcements) {
    await pool.execute(
      `INSERT INTO announcements (announcement_id, author_id, class_id, title, content, school_year, term, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content)`,
      a
    );
  }

  await pool.execute("INSERT IGNORE INTO comments (announcement_id, user_id, comment_text) VALUES (1, 5, 'Thank you for the update.')");
  await pool.execute("INSERT IGNORE INTO comments (announcement_id, user_id, comment_text) VALUES (2, 6, 'When is the deadline?')");

  await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
  await pool.end();

  console.log('MySQL database initialized:', DB_NAME);
  console.log('Login: admin1 / password123 (Admin), instructor1 / password123 (Instructor), GLP012103 / password123 (Student)');
}

main().catch((err) => {
  console.error('Init failed:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.error('Make sure XAMPP MySQL is running (Apache + MySQL started in XAMPP Control Panel).');
  }
  process.exit(1);
});

