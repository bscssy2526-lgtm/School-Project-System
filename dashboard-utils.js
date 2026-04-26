// Utilities used by dashboard pages

export function route() {
  const h = window.location.hash || '#dashboard';
  // strip leading '#'
  const v = h.slice(1);
  // if there is a query string, only return the path portion
  const idx = v.indexOf('?');
  return idx === -1 ? v : v.slice(0, idx);
}

// re-export the global api helper defined in app.js so other modules can import it
export const api = window.api;

export function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export function sidebarNav(role) {
  const base = [
    { path: 'dashboard', label: 'Dashboard', iconSvg: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    { path: 'announcements', label: 'Announcements', iconSvg: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
    { path: 'profile', label: 'Profile', iconSvg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
  ];
  if (role === 'Admin') {
    base.splice(2, 0, { path: 'users', label: 'Users', iconSvg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75" />' });
    base.splice(3, 0, { path: 'classes', label: 'Classes', iconSvg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>' });
    base.splice(4, 0, { path: 'sms-reports', label: 'Delivery Reports', iconSvg: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>' });
  } else if (role === 'Instructor') {
    base.splice(2, 0, { path: 'myclasses', label: 'My Classes', iconSvg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>' });
    base.splice(3, 0, { path: 'classes', label: 'Manage Classes', iconSvg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>' });
  } else if (role === 'Student') {
    base.splice(2, 0, { path: 'myclasses', label: 'My Classes', iconSvg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>' });
  }
  return base;
}

export function renderSidebar(role, user, classesList) {
  const r = route();
  const profilePicUrl = user.profile_path || '/uploads/default-profile.svg';
  const nav = sidebarNav(role).map(n => `
      <a href="#${n.path}" class="nav-link ${r === n.path ? 'active' : ''}" data-route="${n.path}">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${n.iconSvg}</svg>
        ${escapeHtml(n.label)}
      </a>
    `).join('');
  return `
    <aside class="sidebar">
      <div style="padding: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-align: center; margin-bottom: 1rem;">
        <h2 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: #fff; line-height: 1.3;">Integrated Announcement Management System</h2>
      </div>
      <div class="user-profile">
        <div class="avatar" style="background-image: url('${profilePicUrl}'); background-size: cover; background-position: center;" aria-hidden="true"></div>
        <span class="user-name">${escapeHtml(user.name)}</span>
      </div>
      <nav class="main-nav">${nav}</nav>
      <a href="#" id="logoutBtn" class="nav-link">Logout</a>
    </aside>`;
}

export function layoutClass(role, r) {
  if ((r === 'announcements') && (role === 'Admin' || role === 'Instructor')) return 'app app-admin';
  if ((r === 'announcements') && role === 'Student') return 'app';
  if (r === 'myclasses') return 'app app-two-col';
  return 'app app-two-col';
}

/**
 * Client-side password strength validation
 * @param {string} password - Password to validate
 * @returns {object} { isValid: boolean, errors: string[] }
 */
export function validatePasswordStrength(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)')
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
