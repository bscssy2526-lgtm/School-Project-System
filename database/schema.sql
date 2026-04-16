-- Announcement Management and SMS Broadcasting System
-- MySQL schema (XAMPP)
-- Refactored: users (auth only), user_profiles (personal info), contacts (phone/email)

CREATE TABLE IF NOT EXISTS users (
  user_id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('Student', 'Instructor', 'Admin') NOT NULL,
  change_pass TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY idx_users_username (username),
  KEY idx_users_role (role),
  KEY idx_users_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User profiles (personal info, student details)
CREATE TABLE IF NOT EXISTS user_profiles (
  profile_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  f_name VARCHAR(50) NOT NULL,
  m_name VARCHAR(50) DEFAULT NULL,
  l_name VARCHAR(50) NOT NULL,
  birthday DATE DEFAULT NULL,
  profile_path VARCHAR(255) DEFAULT NULL,
  student_id VARCHAR(15) DEFAULT NULL,
  department ENUM('BSBA', 'BSCS', 'BSED', 'BEED') DEFAULT NULL,
  year_level ENUM('1st', '2nd', '3rd', '4th') DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id),
  UNIQUE KEY idx_profiles_user (user_id),
  UNIQUE KEY idx_profiles_student_id (student_id),
  KEY idx_profiles_department (department),
  KEY idx_profiles_year_level (year_level),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User contacts (unified phone/email, supports multiple per user)
CREATE TABLE IF NOT EXISTS contacts (
  contact_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  contact_type ENUM('phone', 'email') NOT NULL,
  contact_value VARCHAR(500) NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT NULL,
  PRIMARY KEY (contact_id),
  KEY idx_contacts_user (user_id),
  KEY idx_contacts_type (contact_type),
  KEY idx_contacts_expires (expires_at),
  UNIQUE KEY idx_contacts_unique (user_id, contact_type, contact_value(100)),
  CONSTRAINT fk_contacts_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Classes (instructor_id references users.user_id)
CREATE TABLE IF NOT EXISTS classes (
  class_id INT NOT NULL AUTO_INCREMENT,
  class_name VARCHAR(50) NOT NULL,
  section VARCHAR(10) NOT NULL DEFAULT 'A',
  instructor_id INT NOT NULL,
  description VARCHAR(100) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (class_id),
  UNIQUE KEY unique_class_section (class_name, section),
  KEY fk_classes_instructor (instructor_id),
  CONSTRAINT fk_classes_instructor FOREIGN KEY (instructor_id) REFERENCES users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Class enrollments (student_id references users.user_id)
CREATE TABLE IF NOT EXISTS class_enrollments (
  enrollment_id INT NOT NULL AUTO_INCREMENT,
  class_id INT NOT NULL,
  student_id INT NOT NULL,
  enrollment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (enrollment_id),
  UNIQUE KEY unique_enrollment (class_id, student_id),
  KEY fk_enroll_class (class_id),
  KEY fk_enroll_student (student_id),
  CONSTRAINT fk_enroll_class FOREIGN KEY (class_id) REFERENCES classes (class_id),
  CONSTRAINT fk_enroll_student FOREIGN KEY (student_id) REFERENCES users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Announcements (class_id NULL = school-wide)
CREATE TABLE IF NOT EXISTS announcements (
  announcement_id INT NOT NULL AUTO_INCREMENT,
  author_id INT NOT NULL,
  class_id INT DEFAULT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  target_department ENUM('BSBA', 'BSCS', 'BSED', 'BEED') DEFAULT NULL,
  target_year_level ENUM('1st', '2nd', '3rd', '4th') DEFAULT NULL,
  school_year VARCHAR(50) DEFAULT NULL,
  term VARCHAR(10) DEFAULT NULL,
  date_posted DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (announcement_id),
  KEY idx_announcements_author (author_id),
  KEY idx_announcements_class (class_id),
  KEY idx_announcements_target_dept (target_department),
  KEY idx_announcements_target_year (target_year_level),
  KEY idx_announcements_date (date_posted),
  KEY idx_announcements_deleted (is_deleted),
  CONSTRAINT fk_announcements_author FOREIGN KEY (author_id) REFERENCES users (user_id),
  CONSTRAINT fk_announcements_class FOREIGN KEY (class_id) REFERENCES classes (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Comments on announcements
CREATE TABLE IF NOT EXISTS comments (
  comment_id INT NOT NULL AUTO_INCREMENT,
  announcement_id INT NOT NULL,
  user_id INT NOT NULL,
  comment_text VARCHAR(255) NOT NULL,
  comment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id),
  KEY idx_comments_announcement (announcement_id),
  CONSTRAINT fk_comments_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (announcement_id),
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Attachments for announcements
CREATE TABLE IF NOT EXISTS announcement_attachments (
  attachment_id INT NOT NULL AUTO_INCREMENT,
  announcement_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  size VARCHAR(50) NOT NULL,
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attachment_id),
  KEY fk_attachments_announcement (announcement_id),
  CONSTRAINT fk_attachments_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (announcement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SMS send log (simplified - phone_num and message stored elsewhere)
CREATE TABLE IF NOT EXISTS sms_logs (
  sms_id INT NOT NULL AUTO_INCREMENT,
  announcement_id INT NOT NULL,
  sent_to INT NOT NULL,
  status ENUM('Sent', 'Failed', 'Pending', 'PartiallyFailed') NOT NULL DEFAULT 'Pending',
  date_sent DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (sms_id),
  KEY fk_sms_announcement (announcement_id),
  KEY fk_sms_sent_to (sent_to),
  CONSTRAINT fk_sms_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (announcement_id),
  CONSTRAINT fk_sms_sent_to FOREIGN KEY (sent_to) REFERENCES users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Email send log
CREATE TABLE IF NOT EXISTS email_logs (
  email_id INT NOT NULL AUTO_INCREMENT,
  announcement_id INT NOT NULL,
  sent_to INT NOT NULL,
  status ENUM('Sent', 'Failed', 'Pending') NOT NULL DEFAULT 'Pending',
  date_sent DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email_id),
  KEY fk_email_announcement (announcement_id),
  KEY fk_email_sent_to (sent_to),
  CONSTRAINT fk_email_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (announcement_id),
  CONSTRAINT fk_email_sent_to FOREIGN KEY (sent_to) REFERENCES users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
