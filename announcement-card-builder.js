/**
 * announcement-card-builder.js
 * Reusable helper functions for building announcement cards and related UI elements
 */

import { escapeHtml } from './dashboard-utils.js';

/**
 * Get target audience text for announcement (for admin visibility)
 * @param {Object} announcement - Announcement object
 * @returns {Object} { text: string, badge: string }
 */
export function getTargetAudience(announcement) {
  if (announcement.class_id && announcement.class_name) {
    return {
      text: `Class: ${escapeHtml(announcement.class_name)}`,
      badge: '🎓'
    };
  }
  
  const dept = announcement.target_department;
  const year = announcement.target_year_level;
  
  if (dept && year) {
    return {
      text: `${dept} - ${year} Year`,
      badge: '👥'
    };
  }
  
  if (dept) {
    return {
      text: `Department: ${dept}`,
      badge: '🏢'
    };
  }
  
  if (year) {
    return {
      text: `${year} Year Students`,
      badge: '📚'
    };
  }
  
  return {
    text: 'School-wide',
    badge: '📢'
  };
}

/**
 * Format a date string into readable format
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date like "Mar 25, 3:45 PM"
 */
export function formatDateShort(dateString) {
  if (!dateString) return '';
  const dt = new Date(dateString);
  return dt.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit' 
  });
}

/**
 * Get icon emoji for a file type based on filename
 * @param {string} filename - The filename to get icon for
 * @returns {string} Emoji icon
 */
export function getFileIcon(filename) {
  if (!filename) return '📄';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap = {
    'pdf': '📕',
    'doc': '📘', 'docx': '📘',
    'xls': '📊', 'xlsx': '📊',
    'ppt': '🎥', 'pptx': '🎥',
    'txt': '📝',
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️',
    'zip': '📦', 'rar': '📦', '7z': '📦',
    'mp4': '🎬', 'avi': '🎬', 'mov': '🎬',
    'mp3': '🎵', 'wav': '🎵',
  };
  return iconMap[ext] || '📄';
}

/**
 * Check if a file is an image based on extension
 * @param {string} filename - The filename to check
 * @returns {boolean} True if image file
 */
export function isImageFile(filename) {
  if (!filename) return false;
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
}

/**
 * Build author section HTML
 * @param {Object} author - Author object with name, role, profile_path, date_posted
 * @returns {string} HTML for author section
 */
export function buildAuthorSection(author) {
  const name = escapeHtml(author.author_name || 'Unknown');
  const role = escapeHtml(author.author_role || '');
  const date = formatDateShort(author.date_posted);
  const avatar = author.author_profile_path || '/uploads/default-profile.svg';

  return `
    <div class="author">
      <div class="author-avatar" style="background-image: url('${avatar}');"></div>
      <div>
        <span class="author-name">${name}</span>
        <span class="author-meta">${role}${role ? ' – ' : ''}${date}</span>
      </div>
    </div>`;
}

/**
 * Build attachment indicator (shows count)
 * @param {number} count - Number of attachments
 * @returns {string} HTML for attachment indicator or empty string
 */
export function buildAttachmentIndicator(count) {
  if (count <= 0) return '';
  return `<div class="card-meta">📎 <strong>${count} attachment${count === 1 ? '' : 's'}</strong></div>`;
}

/**
 * Build attachment preview row with file icons
 * @param {Array} attachments - Array of attachment objects with filename
 * @returns {string} HTML for attachment row or empty string
 */
export function buildAttachmentRow(attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return '';
  }

  const attachmentHTML = attachments.map(att => {
    const icon = getFileIcon(att.filename);
    const filename = escapeHtml((att.filename || '').split('.')[0].slice(0, 8));
    return `<div class="attachment-preview">
      <span class="attachment-icon">${icon}</span>
      <span class="attachment-name">${filename}</span>
    </div>`;
  }).join('');

  return `<div class="attachment-row">${attachmentHTML}</div>`;
}

/**
 * Build announcement card HTML
 * @param {Object} announcement - Announcement object from API
 * @param {Object} options - Optional settings {truncateContent: number}
 * @returns {string} HTML for a complete announcement card
 */
export function buildAnnouncementCard(announcement, options = {}) {
  const { truncateContent = 180 } = options;

  const typeLabel = announcement.class_name 
    ? escapeHtml(announcement.class_name) 
    : 'School Announcement';
  
  const yearTerm = announcement.school_year 
    ? `${escapeHtml(announcement.school_year)}${
        announcement.term ? ' – ' + escapeHtml(announcement.term) : ''
      }` 
    : '';

  const attachmentCount = Number(
    announcement.attachment_count || 
    (Array.isArray(announcement.attachments) ? announcement.attachments.length : 0) || 0
  );

  const title = escapeHtml(announcement.title || '');
  const content = escapeHtml((announcement.content || '').slice(0, truncateContent));
  const contentTruncated = (announcement.content || '').length > truncateContent;

  const attachmentIndicator = buildAttachmentIndicator(attachmentCount);
  const attachmentRow = buildAttachmentRow(announcement.attachments);
  const authorSection = buildAuthorSection(announcement);
  
  const currentUser = typeof getUser !== 'undefined' ? getUser() : null;
  const isAdmin = currentUser && currentUser.role === 'Admin';
  const targetAudience = isAdmin ? getTargetAudience(announcement) : null;

  return `
    <article class="announcement-card" data-id="${announcement.announcement_id}">
      <div class="card-header">
        ${authorSection}
        <span class="badge">${typeLabel}</span>
      </div>
      ${targetAudience ? `<div class="card-target" style="font-size:0.75rem;color:#6b7280;margin:0.25rem 0;display:flex;align-items:center;gap:0.25rem;"><span>${targetAudience.badge}</span> <span>${targetAudience.text}</span></div>` : ''}
      <h3 class="card-title">${title}</h3>
      ${yearTerm ? `<div class="card-meta card-year-term">${yearTerm}</div>` : ''}
      ${attachmentIndicator}
      <p class="card-body">${content}${contentTruncated ? '…' : ''}</p>
      ${attachmentRow}
      <footer class="card-footer">
        <button type="button" class="comment-btn" data-id="${announcement.announcement_id}">Comment</button>
        <a href="#" class="view-link view-ann" data-id="${announcement.announcement_id}">View Announcement →</a>
      </footer>
    </article>`;
}

/**
 * Build compact "make announcement" box (for creation)
 * @param {string} userProfilePic - Path to user's profile picture
 * @param {Object} options - Optional settings {classContext, classId}
 * @returns {string} HTML for compact announcement creation box
 */
export function buildMakeAnnouncementBox(userProfilePic, options = {}) {
  const { classContext = '', classId = '' } = options;
  
  return `
    <div class="make-announcement-compact">
      ${classContext ? `<div class="class-context">${classContext}</div>` : ''}
      <div class="make-ann-compact-box">
        <div class="author-avatar-compact" style="background-image: url('${userProfilePic}');"></div>
        <input type="text" id="annInputTrigger" class="ann-input-trigger" placeholder="Create an announcement..." readonly data-class-id="${classId}">
      </div>
    </div>`;
}

/**
 * Build stats sidebar for admin (overview of counts)
 * @param {Object} stats - Stats object with announcements, students, instructors, classes counts
 * @returns {string} HTML for stats sidebar or empty string
 */
export function buildStatsSidebar(stats) {
  if (!stats) return '';

  return `
    <aside class="pinned-sidebar stats-sidebar">
      <h2 class="pinned-title">Overview</h2>
      <div class="stats-cards">
        <div class="stat-card"><span class="stat-num">${stats.announcements}</span><span class="stat-label">Announcements</span></div>
        <div class="stat-card"><span class="stat-num">${stats.students}</span><span class="stat-label">Students</span></div>
        <div class="stat-card"><span class="stat-num">${stats.instructors}</span><span class="stat-label">Instructors</span></div>
        <div class="stat-card"><span class="stat-num">${stats.classes}</span><span class="stat-label">Classes</span></div>
      </div>
    </aside>`;
}

/**
 * Build students sidebar (for class announcements)
 * @param {Array} enrollments - Array of enrolled student objects with name, student_id
 * @returns {string} HTML for students sidebar or empty string
 */
export function buildStudentsSidebar(enrollments) {
  if (!enrollments || enrollments.length === 0) return '';

  // Sort alphabetically by last name, then first name
  const sorted = [...enrollments].sort((a, b) => {
    const aName = (a.name || '').trim().split(' ');
    const bName = (b.name || '').trim().split(' ');
    const aLast = aName[aName.length - 1] || '';
    const bLast = bName[bName.length - 1] || '';
    const aFirst = aName.slice(0, -1).join(' ') || '';
    const bFirst = bName.slice(0, -1).join(' ') || '';
    
    const lastCompare = aLast.localeCompare(bLast);
    return lastCompare !== 0 ? lastCompare : aFirst.localeCompare(bFirst);
  });

  const studentList = sorted.map(e => {
    const nameParts = (e.name || '').trim().split(' ');
    const lastName = nameParts[nameParts.length - 1] || '';
    const firstName = nameParts.slice(0, -1).join(' ') || '';
    const formattedName = firstName && lastName ? `${lastName}, ${firstName}` : e.name;
    
    return `
      <div class="student-item">
        <div class="student-name">${escapeHtml(formattedName)}</div>
        <div class="student-meta">${escapeHtml(e.student_id || '')}</div>
      </div>`;
  }).join('');

  return `
    <aside class="class-students-sidebar">
      <h3 class="sidebar-title">👥 Enrolled Students (${enrollments.length})</h3>
      <div class="students-list">
        ${studentList}
      </div>
    </aside>`;
}

/**
 * Build search UI for announcements
 * @param {Object} options - Settings {searchTerm}
 * @returns {string} HTML for search bar
 */
export function buildSearchFilterUI(options = {}) {
  const { searchTerm = '', filters = {} } = options;
  const { year_level = '', department = '' } = filters;

  return `
    <div class="announcement-search-filter">
      <div class="search-box">
        <input type="search" id="ann-search" class="ann-search-input" placeholder="Search announcements by title or content..." value="${escapeHtml(searchTerm)}">
        <span class="search-icon">🔍</span>
      </div>
      <div class="filter-section">
        <div class="filter-row">
          <div class="filter-group">
            <label for="dept-filter" class="filter-label">Department:</label>
            <select id="dept-filter" class="filter-select" data-filter="department">
              <option value="">All Departments</option>
              <option value="BSBA" ${department === 'BSBA' ? 'selected' : ''}>BSBA</option>
              <option value="BSCS" ${department === 'BSCS' ? 'selected' : ''}>BSCS</option>
              <option value="BSED" ${department === 'BSED' ? 'selected' : ''}>BSED</option>
              <option value="BEED" ${department === 'BEED' ? 'selected' : ''}>BEED</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="year-filter" class="filter-label">Year Level:</label>
            <select id="year-filter" class="filter-select" data-filter="year_level">
              <option value="">All Years</option>
              <option value="1st" ${year_level === '1st' ? 'selected' : ''}>1st Year</option>
              <option value="2nd" ${year_level === '2nd' ? 'selected' : ''}>2nd Year</option>
              <option value="3rd" ${year_level === '3rd' ? 'selected' : ''}>3rd Year</option>
              <option value="4th" ${year_level === '4th' ? 'selected' : ''}>4th Year</option>
            </select>
          </div>
        </div>
      </div>
    </div>`;
  }
