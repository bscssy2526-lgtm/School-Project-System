import { api, escapeHtml, validatePasswordStrength } from './dashboard-utils.js';

// returns HTML for the Users management page (Admin only)
export async function renderUsers() {
  // fetch first page to avoid rendering huge list initially
  const res = await api('/users?limit=15&page=1');
  let users = [];
  if (res.data) {
    if (Array.isArray(res.data)) users = res.data;
    else if (Array.isArray(res.data.data)) users = res.data.data;
  }
  const displayId = (u) => u.username || u.student_id || '—';
  return `
    <main class="main-content single-col">
      <div class="page-header">
        <h1 class="page-title">Users Management</h1>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" id="newUserBtn" class="btn-primary">+ New User</button>
          <button type="button" id="batchUploadBtn" class="btn-primary">↑ Batch Upload</button>
          <a href="#" id="downloadTemplateBtn" class="btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;">📥</a>
        </div>
      </div>

      <!-- Filter Bar -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 0.75rem; margin-bottom: 1.5rem; padding: 1rem; background: #f9f9f9; border-radius: 0.5rem;">
        <div class="form-field" style="margin: 0;">
          <label class="login-label" style="font-size: 0.85rem;">Search</label>
          <input type="text" id="filterSearch" class="login-input" placeholder="Name, ID, username..." style="font-size: 0.9rem;">
        </div>
        <div class="form-field" style="margin: 0;">
          <label class="login-label" style="font-size: 0.85rem;">Role</label>
          <select id="filterRole" class="login-input" style="font-size: 0.9rem;">
            <option value="">All Roles</option>
            <option value="Student">Student</option>
            <option value="Instructor">Instructor</option>
            <option value="Admin">Admin</option>
          </select>
        </div>
        <div class="form-field" style="margin: 0;">
          <label class="login-label" style="font-size: 0.85rem;">Department</label>
          <select id="filterDepartment" class="login-input" style="font-size: 0.9rem;">
            <option value="">All Departments</option>
            <option value="BSBA">BSBA</option>
            <option value="BSCS">BSCS</option>
            <option value="BSED">BSED</option>
            <option value="BEED">BEED</option>
          </select>
        </div>
        <div class="form-field" style="margin: 0;">
          <label class="login-label" style="font-size: 0.85rem;">Year Level</label>
          <select id="filterYear" class="login-input" style="font-size: 0.9rem;">
            <option value="">All Years</option>
            <option value="1st">1st</option>
            <option value="2nd">2nd</option>
            <option value="3rd">3rd</option>
            <option value="4th">4th</option>
          </select>
        </div>
        <button type="button" id="filterResetBtn" class="btn-primary" style="height:50%; margin-top:30%;">Reset</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>ID/Username</th><th>Year</th><th>Dept</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody id="usersTableBody">
            ${users.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:2rem;">No users found</td></tr>' : users.map(u => {
              const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString() : '—';
              const isAdmin = u.role === 'Admin';
              const editBtn = isAdmin 
                ? ''
                : `<button type="button" class="btn-sm btn-secondary edit-user" data-id="${u.user_id}" data-name="${escapeHtml(u.name)}" title="Edit">Edit</button>`;
              const editPassBtn = isAdmin
                ? ''
                : `<button type="button" class="btn-sm btn-secondary edit-password" data-id="${u.user_id}" data-name="${escapeHtml(u.name)}" title="Change password">Password</button>`;
              const deleteBtn = isAdmin
                ? `<button type="button" class="btn-sm" disabled title="Admin accounts cannot be deleted" style="opacity: 0.5; cursor: not-allowed;">Delete</button>`
                : `<button type="button" class="btn-sm btn-danger delete-user" data-id="${u.user_id}" data-name="${escapeHtml(u.name)}" title="Delete">Delete</button>`;
              return `<tr ${isAdmin ? 'style="background-color: #f0f0f0;"' : ''}>
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(displayId(u))}</td>
              <td>${escapeHtml(u.year_level || '—')}</td>
              <td>${escapeHtml(u.department || '—')}</td>
              <td><span class="role-badge">${escapeHtml(u.role)}</span></td>
              <td>${escapeHtml(createdDate)}</td>
              <td>${editBtn}${editPassBtn}${deleteBtn}</td>
            </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div id="usersPagination" style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem;">
        <button type="button" id="usersPrevBtn" class="btn-secondary" disabled>← Back</button>
        <span id="usersPageInfo">Page 1</span>
        <button type="button" id="usersNextBtn" class="btn-secondary" disabled>Next →</button>
      </div>

      <!-- NEW USER MODAL -->
      <div class="modal-overlay" id="userModal" hidden>
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Add New User</h2>
            <button type="button" class="modal-close" id="closeUserModal">×</button>
          </div>
          <div class="modal-body">
            <form id="newUserForm">
              <div class="modal-form-grid">
                <div>
                  <label class="login-label">First Name</label>
                  <input type="text" id="nu_f_name" class="login-input" required>
                </div>
                <div>
                  <label class="login-label">Middle Name</label>
                  <input type="text" id="nu_m_name" class="login-input">
                </div>
                <div>
                  <label class="login-label">Last Name</label>
                  <input type="text" id="nu_l_name" class="login-input" required>
                </div>
                <div class="modal-form-full">
                  <label class="login-label">Role</label>
                  <select id="nu_role" class="login-input" required>
                    <option value="">— Select Role —</option>
                    <option value="Student">Student</option>
                    <option value="Instructor">Instructor</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div id="nu_studentid_wrap" style="display:none;">
                  <label class="login-label">Student ID</label>
                  <input type="text" id="nu_student_id" class="login-input">
                </div>
                <div id="nu_department_wrap" style="display:none;">
                  <label class="login-label">Department</label>
                  <select id="nu_department" class="login-input">
                    <option value="">— Select —</option>
                    <option value="BSBA">BSBA</option>
                    <option value="BSCS">BSCS</option>
                    <option value="BSED">BSED</option>
                    <option value="BEED">BEED</option>
                  </select>
                </div>
                <div id="nu_year_wrap" style="display:none;">
                  <label class="login-label">Year Level</label>
                  <select id="nu_year_level" class="login-input">
                    <option value="">— Select —</option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="3rd">3rd</option>
                    <option value="4th">4th</option>
                  </select>
                </div>
                <div id="nu_birthday_wrap" style="display:none;">
                  <label class="login-label">Birthday</label>
                  <input type="date" id="nu_birthday" class="login-input">
                </div>
                <div id="nu_username_wrap" style="display:none;">
                  <label class="login-label">Username</label>
                  <input type="text" id="nu_username" class="login-input">
                </div>
                <div id="nu_email_wrap" style="display:none;">
                  <label class="login-label">Email Address</label>
                  <input type="email" id="nu_email" name="email" class="login-input">
                </div>
              </div>
              <p id="newUserError" class="login-error" hidden></p>
              <div style="margin-top:1rem;display:flex;gap:0.5rem;">
                <button type="submit" class="btn-primary">Create User</button>
                <button type="button" id="cancelUserModal" class="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- EMAIL CONFIRMATION MODAL -->
      <div class="modal-overlay" id="emailConfirmModal" hidden>
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Confirm Email Address</h2>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 1rem;">Please verify that this email address is correct. A randomly generated password will be sent to this email.</p>
            <div style="background: #f5f5f5; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem; word-break: break-all;">
              <strong id="confirmEmailDisplay"></strong>
            </div>
            <p id="emailConfirmError" class="login-error" hidden></p>
            <div style="display:flex;gap:0.5rem;">
              <button type="button" id="confirmEmailBtn" class="btn-primary">Yes, Send Password</button>
              <button type="button" id="cancelEmailBtn" class="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <!-- EDIT USER MODAL -->
      <div class="modal-overlay" id="editUserModal" hidden>
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Edit User</h2>
            <button type="button" class="modal-close" id="closeEditUserModal">×</button>
          </div>
          <div class="modal-body">
            <form id="editUserForm">
              <div class="modal-form-grid">
                <div>
                  <label class="login-label">First Name</label>
                  <input type="text" id="eu_f_name" class="login-input" required>
                </div>
                <div>
                  <label class="login-label">Middle Name</label>
                  <input type="text" id="eu_m_name" class="login-input">
                </div>
                <div>
                  <label class="login-label">Last Name</label>
                  <input type="text" id="eu_l_name" class="login-input" required>
                </div>
                <div class="modal-form-full">
                  <label class="login-label">Role</label>
                  <select id="eu_role" class="login-input" required>
                    <option value="Student">Student</option>
                    <option value="Instructor">Instructor</option>
                  </select>
                </div>
                <div id="eu_studentid_wrap">
                  <label class="login-label">Student ID</label>
                  <input type="text" id="eu_student_id" class="login-input" required>
                </div>
                <div id="eu_username_wrap" style="display:none;">
                  <label class="login-label">Username</label>
                  <input type="text" id="eu_username" class="login-input">
                </div>
                <div id="eu_department_wrap">
                  <label class="login-label">Department</label>
                  <select id="eu_department" class="login-input">
                    <option value="">— Select —</option>
                    <option value="BSBA">BSBA</option>
                    <option value="BSCS">BSCS</option>
                    <option value="BSED">BSED</option>
                    <option value="BEED">BEED</option>
                  </select>
                </div>
                <div id="eu_year_wrap">
                  <label class="login-label">Year Level</label>
                  <select id="eu_year_level" class="login-input">
                    <option value="">— Select —</option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="3rd">3rd</option>
                    <option value="4th">4th</option>
                  </select>
                </div>
                <div id="eu_birthday_wrap" style="display:none;">
                  <label class="login-label">Birthday</label>
                  <input type="date" id="eu_birthday" class="login-input">
                </div>
              </div>
              <p id="editUserError" class="login-error" hidden></p>
              <div style="margin-top:1rem;display:flex;gap:0.5rem;">
                <button type="submit" class="btn-primary">Save Changes</button>
                <button type="button" id="cancelEditUserModal" class="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- PASSWORD MODAL -->
      <div class="modal-overlay" id="passwordUserModal" hidden>
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Change Password</h2>
            <button type="button" class="modal-close" id="closePasswordUserModal">×</button>
          </div>
          <div class="modal-body">
            <form id="passwordUserForm">
              <p id="passwordUserNameDisplay" style="margin-bottom:1rem;font-weight:600;"></p>
              <div class="modal-form-grid">
                <div>
                  <label class="login-label">New Password</label>
                  <input type="password" id="pu_password" class="login-input" required>
                </div>
                <div>
                  <label class="login-label">Confirm Password</label>
                  <input type="password" id="pu_password_confirm" class="login-input" required>
                </div>
              </div>
              <div style="font-size: 0.875rem; margin: 1rem 0; padding: 1rem; background: #f0f9ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
                <p style="margin: 0 0 0.5rem 0; font-weight: 500; color: #1e40af;">Password Requirements:</p>
                <ul style="margin: 0; padding-left: 1.5rem; color: #475569;">
                  <li id="admin-req-length" style="opacity: 0.5;">Minimum 8 characters</li>
                  <li id="admin-req-lower" style="opacity: 0.5;">At least one lowercase letter (a-z)</li>
                  <li id="admin-req-number" style="opacity: 0.5;">At least one number (0-9)</li>
                  <li id="admin-req-special" style="opacity: 0.5;">At least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)</li>
                </ul>
              </div>
              <p id="passwordUserError" class="login-error" hidden></p>
              <div style="margin-top:1rem;display:flex;gap:0.5rem;">
                <button type="submit" class="btn-primary">Set Password</button>
                <button type="button" id="cancelPasswordUserModal" class="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- DELETE CONFIRMATION MODAL -->
      <div class="modal-overlay" id="deleteUserModal" hidden>
        <div class="modal" style="max-width: 320px;">
          <div class="modal-header">
            <h2 class="modal-title" style="color:#d32f2f;">⚠️ Delete User</h2>
            <button type="button" class="modal-close" id="closeDeleteUserModal">×</button>
          </div>
          <div class="modal-body">
            <p id="deleteUserText" style="margin-bottom:0.3rem;font-weight:500;font-size:0.95rem;">Delete this user?</p>
            <p style="margin-bottom:0.75rem;font-size:0.8rem;color:#666;">This action cannot be undone.</p>
            <p id="deleteUserError" class="login-error" hidden></p>
            <div style="display:flex;gap:0.5rem;">
              <button type="button" id="confirmDeleteUserBtn" class="btn-primary" style="background-color:#d32f2f;color:white;border:none;">Delete User</button>
              <button type="button" id="cancelDeleteUserModal" class="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <!-- BATCH UPLOAD MODAL -->
      <div class="modal-overlay" id="batchUploadModal" hidden>
        <div class="modal" style="max-width:600px;">
          <div class="modal-header">
            <h2 class="modal-title">Batch Upload Users</h2>
            <button type="button" class="modal-close" id="closeBatchUploadModal">×</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom:1rem;font-size:0.9rem;">Upload an Excel file with columns: FirstName, LastName, Role, StudentID (for Students), Department (for Students), YearLevel (for Students)</p>
            <input type="file" id="batchUploadFile" class="login-input" accept=".xlsx,.xls">
            <p id="batchUploadError" class="login-error" hidden></p>
            <p id="batchUploadSuccess" class="login-success" hidden></p>
            <div style="margin-top:1rem;display:flex;gap:0.5rem;">
              <button type="button" id="previewBatchBtn" class="btn-primary">👁️ Preview</button>
              <button type="button" id="cancelBatchUploadModal" class="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </main>`;
}

// call this after renderUsers has inserted the HTML to wire up events
export async function initUsersPage() {
  // Notification helper
  const showUserNotification = (msg, type = 'success') => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay notification';

    const modal = document.createElement('div');
    modal.className = 'modal-dialog notification';

    const iconMap = { 'success': '✓', 'error': '✕' };

    const header = document.createElement('div');
    header.className = 'notification-header';

    const icon = document.createElement('div');
    icon.className = `notification-icon ${type}`;
    icon.textContent = iconMap[type] || '!';

    const titleText = type === 'success' ? 'Success' : 'Error';
    const title = document.createElement('h2');
    title.className = `notification-title ${type}`;
    title.textContent = titleText;

    header.appendChild(icon);
    header.appendChild(title);
    modal.appendChild(header);

    const content = document.createElement('div');
    content.className = 'notification-content';
    content.textContent = msg;
    modal.appendChild(content);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = `notification-button ${type}`;
    closeBtn.addEventListener('click', () => overlay.remove());
    modal.appendChild(closeBtn);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  };

  // Filter functionality
  const filterSearch = document.getElementById('filterSearch');
  const filterRole = document.getElementById('filterRole');
  const filterDepartment = document.getElementById('filterDepartment');
  const filterYear = document.getElementById('filterYear');
  const filterResetBtn = document.getElementById('filterResetBtn');
  const usersTableBody = document.getElementById('usersTableBody');
  const prevBtn = document.getElementById('usersPrevBtn');
  const nextBtn = document.getElementById('usersNextBtn');
  const pageInfo = document.getElementById('usersPageInfo');

  let currentPage = 1;
  const PAGE_SIZE = 15;

  const updateUsersList = async (page = 1) => {
    currentPage = page;
    const search = filterSearch?.value?.trim() || '';
    const roleFilter = filterRole?.value || '';
    const deptFilter = filterDepartment?.value || '';
    const yearFilter = filterYear?.value || '';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (roleFilter) params.append('role', roleFilter);
    if (deptFilter) params.append('department', deptFilter);
    if (yearFilter) params.append('year_level', yearFilter);

    // always paginate for user management
    params.append('limit', PAGE_SIZE);
    params.append('page', currentPage);

    const url = '/users' + (params.toString() ? '?' + params.toString() : '');
    const res = await api(url);
    let users = [];
    let total = 0;
    if (res.data) {
      if (Array.isArray(res.data)) {
        users = res.data;
      } else if (Array.isArray(res.data.data)) {
        users = res.data.data;
        total = res.data.total || 0;
      }
    }
    const displayId = (u) => u.username || u.student_id || '—';

    // update pagination UI (if controls present)
    if (pageInfo && prevBtn && nextBtn) {
      if (total > 0) {
        const totalPages = Math.ceil(total / PAGE_SIZE);
        // if page requested is beyond available pages, go back to last page
        if (currentPage > totalPages) {
          return updateUsersList(totalPages);
        }
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
      } else {
        pageInfo.textContent = `Page 0 of 0`;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
      }
    }


    if (users.length === 0) {
      usersTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No users found</td></tr>';
      return;
    }

    usersTableBody.innerHTML = users.map(u => {
      const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString() : '—';
      const isAdmin = u.role === 'Admin';
      const editBtn = isAdmin 
        ? ''
        : `<button type="button" class="btn-sm btn-secondary edit-user" data-id="${u.user_id}" data-name="${escapeHtml(u.name)}" title="Edit">Edit</button>`;
      const editPassBtn = isAdmin
        ? ''
        : `<button type="button" class="btn-sm btn-secondary edit-password" data-id="${u.user_id}" data-name="${escapeHtml(u.name)}" title="Change password">Password</button>`;
      const deleteBtn = isAdmin
        ? `<button type="button" class="btn-sm" disabled title="Admin accounts cannot be deleted" style="opacity: 0.5; cursor: not-allowed;">Delete</button>`
        : `<button type="button" class="btn-sm btn-danger delete-user" data-id="${u.user_id}" data-name="${escapeHtml(u.name)}" title="Delete">Delete</button>`;
      return `<tr ${isAdmin ? 'style="background-color: #f0f0f0;"' : ''}>
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(displayId(u))}</td>
              <td>${escapeHtml(u.year_level || '—')}</td>
              <td>${escapeHtml(u.department || '—')}</td>
              <td><span class="role-badge">${escapeHtml(u.role)}</span></td>
              <td>${escapeHtml(createdDate)}</td>
              <td>${editBtn}${editPassBtn}${deleteBtn}</td>
            </tr>`;
    }).join('');

    document.querySelectorAll('.edit-user').forEach(btn => {
      btn.addEventListener('click', async function() {
        const userId = this.getAttribute('data-id');
        const userRes = await api('/users');
        const user = userRes.data?.find(u => u.user_id == userId);
        if (!user) return;
        if (user.role === 'Admin') {
          alert('Admin accounts cannot be edited');
          return;
        }
        openEditModal(userId);
        document.getElementById('eu_f_name').value = user.f_name || '';
        document.getElementById('eu_m_name').value = user.m_name || '';
        document.getElementById('eu_l_name').value = user.l_name || '';
        document.getElementById('eu_role').value = user.role;
        document.getElementById('eu_username').value = user.username || '';
        document.getElementById('eu_student_id').value = user.student_id || '';
        document.getElementById('eu_department').value = user.department || '';
        document.getElementById('eu_year_level').value = user.year_level || '';
        
        // Format birthday for date input (YYYY-MM-DD)
        if (user.birthday) {
          const bday = user.birthday.trim();
          if (bday) {
            // If already in YYYY-MM-DD format, use as-is
            document.getElementById('eu_birthday').value = bday;
          }
        } else {
          document.getElementById('eu_birthday').value = '';
        }
        
        const isStudent = user.role === 'Student';
        const isInstructor = user.role === 'Instructor';
        document.getElementById('eu_username_wrap').style.display = isStudent ? 'none' : '';
        document.getElementById('eu_studentid_wrap').style.display = isStudent ? '' : 'none';
        document.getElementById('eu_department_wrap').style.display = isStudent ? '' : 'none';
        document.getElementById('eu_year_wrap').style.display = isStudent ? '' : 'none';
        document.getElementById('eu_birthday_wrap').style.display = isStudent ? '' : 'none';
        document.getElementById('eu_year_level').required = isStudent;
      });
    });

    document.querySelectorAll('.edit-password').forEach(btn => {
      btn.addEventListener('click', function() {
        const userId = this.getAttribute('data-id');
        const userName = this.getAttribute('data-name');
        openPasswordModal(userId, userName);
      });
    });

    document.querySelectorAll('.delete-user').forEach(btn => {
      btn.addEventListener('click', function() {
        const userId = this.getAttribute('data-id');
        const userName = this.getAttribute('data-name');
        openDeleteModal(userId, userName);
      });
    });
  };

  filterSearch?.addEventListener('input', () => {
    updateUsersList(1);
  });
  filterRole?.addEventListener('change', () => {
    updateUsersList(1);
  });
  filterDepartment?.addEventListener('change', () => {
    updateUsersList(1);
  });
  filterYear?.addEventListener('change', () => {
    updateUsersList(1);
  });
  filterResetBtn?.addEventListener('click', async () => {
    filterSearch.value = '';
    filterRole.value = '';
    filterDepartment.value = '';
    filterYear.value = '';
    await updateUsersList(1);
  });

  // page navigation buttons
  prevBtn?.addEventListener('click', () => {
    if (currentPage > 1) updateUsersList(currentPage - 1);
  });
  nextBtn?.addEventListener('click', () => {
    updateUsersList(currentPage + 1);
  });

  // New user modal handling
  const modal = document.getElementById('userModal');
  const openBtn = document.getElementById('newUserBtn');
  const closeBtn = document.getElementById('closeUserModal');
  const cancelBtn = document.getElementById('cancelUserModal');
  const form = document.getElementById('newUserForm');
  const errEl = document.getElementById('newUserError');
  const roleSel = document.getElementById('nu_role');

  // Function to format birthday to MMDDYY
  const formatBirthdayToStudentId = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return month + day + year;
  };

  // Function to generate student ID: initials + birthday (MMDDYY)
  const generateStudentId = () => {
    const fName = document.getElementById('nu_f_name').value.trim();
    const mName = document.getElementById('nu_m_name').value.trim();
    const lName = document.getElementById('nu_l_name').value.trim();
    const birthday = document.getElementById('nu_birthday').value;

    if (!fName || !lName || !birthday) return '';

    const initial1 = fName[0].toUpperCase();
    const initial2 = mName ? mName[0].toUpperCase() : '';
    const initial3 = lName[0].toUpperCase();
    const birthdayPart = formatBirthdayToStudentId(birthday);

    const studentId = initial1 + (initial2 || '') + initial3 + (birthdayPart ? '-' + birthdayPart : '');
    return studentId;
  };

  // Function to generate student ID for edit form
  const generateEditStudentId = () => {
    const fName = document.getElementById('eu_f_name').value.trim();
    const mName = document.getElementById('eu_m_name').value.trim();
    const lName = document.getElementById('eu_l_name').value.trim();
    const birthday = document.getElementById('eu_birthday').value;

    if (!fName || !lName || !birthday) return '';

    const initial1 = fName[0].toUpperCase();
    const initial2 = mName ? mName[0].toUpperCase() : '';
    const initial3 = lName[0].toUpperCase();
    const birthdayPart = formatBirthdayToStudentId(birthday);

    const studentId = initial1 + (initial2 || '') + initial3 + (birthdayPart ? '-' + birthdayPart : '');
    return studentId;
  };

  const setRoleFields = () => {
    const val = roleSel.value;
    const isStudent = val === 'Student';
    const isAdmin = val === 'Admin';
    const isInstructor = val === 'Instructor';
    document.getElementById('nu_studentid_wrap').style.display = isStudent ? '' : 'none';
    document.getElementById('nu_department_wrap').style.display = isStudent ? '' : 'none';
    document.getElementById('nu_year_wrap').style.display = isStudent ? '' : 'none';
    document.getElementById('nu_birthday_wrap').style.display = isStudent ? '' : 'none';
    document.getElementById('nu_username_wrap').style.display = isAdmin ? '' : 'none';
    document.getElementById('nu_email_wrap').style.display = (isInstructor || isAdmin) ? '' : 'none';
    const yearSelect = document.getElementById('nu_year_level');
    if (isStudent) {
      yearSelect.required = true;
    } else {
      yearSelect.required = false;
    }
  };

  const open = () => {
    errEl.hidden = true;
    modal.hidden = false;
    setRoleFields();
  };
  const close = () => { modal.hidden = true; };

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });
  roleSel?.addEventListener('change', setRoleFields);

  // Add event listeners for auto-generating student ID
  document.getElementById('nu_f_name')?.addEventListener('change', () => {
    const studentIdField = document.getElementById('nu_student_id');
    if (studentIdField) {
      studentIdField.value = generateStudentId();
    }
  });
  document.getElementById('nu_m_name')?.addEventListener('change', () => {
    const studentIdField = document.getElementById('nu_student_id');
    if (studentIdField) {
      studentIdField.value = generateStudentId();
    }
  });
  document.getElementById('nu_l_name')?.addEventListener('change', () => {
    const studentIdField = document.getElementById('nu_student_id');
    if (studentIdField) {
      studentIdField.value = generateStudentId();
    }
  });
  document.getElementById('nu_birthday')?.addEventListener('change', () => {
    const studentIdField = document.getElementById('nu_student_id');
    if (studentIdField) {
      studentIdField.value = generateStudentId();
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;

    const f_name = document.getElementById('nu_f_name').value.trim();
    const m_name = document.getElementById('nu_m_name').value.trim();
    const l_name = document.getElementById('nu_l_name').value.trim();
    const newRole = document.getElementById('nu_role').value;
    const username = document.getElementById('nu_username').value.trim();
    const email = document.getElementById('nu_email').value.trim();
    const student_id = document.getElementById('nu_student_id').value.trim();
    const department = document.getElementById('nu_department').value || null;
    const year_level = document.getElementById('nu_year_level').value || null;
    const birthday = document.getElementById('nu_birthday').value || null;

    if (!f_name || !l_name) {
      errEl.textContent = 'First name and last name are required.';
      errEl.hidden = false;
      return;
    }
    if (newRole === 'Student' && !student_id) {
      errEl.textContent = 'Student ID is required for Student role.';
      errEl.hidden = false;
      return;
    }
    if (newRole === 'Student' && !document.getElementById('nu_year_level').value) {
      errEl.textContent = 'Year Level is required for Student role.';
      errEl.hidden = false;
      return;
    }
    if ((newRole === 'Instructor' || newRole === 'Admin') && !email) {
      errEl.textContent = 'Email address is required for Instructors and Admins.';
      errEl.hidden = false;
      return;
    }
    
    // Validate email format for Instructor/Admin
    if ((newRole === 'Instructor' || newRole === 'Admin') && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errEl.textContent = 'Please enter a valid email address (e.g., user@gmail.com).';
        errEl.hidden = false;
        return;
      }
    }

    const payload = {
      f_name,
      m_name: m_name || null,
      l_name,
      role: newRole,
      username: newRole === 'Student' ? student_id : (newRole === 'Admin' ? username : ''),
      student_id: newRole === 'Student' ? student_id : '',
      department: newRole === 'Student' ? department : null,
      year_level: newRole === 'Student' ? year_level : null,
      birthday: newRole === 'Student' ? birthday : null,
      email: (newRole === 'Instructor' || newRole === 'Admin') ? email : null,
    };

    // For Instructor/Admin, show email confirmation modal before proceeding
    if ((newRole === 'Instructor' || newRole === 'Admin')) {
      document.getElementById('confirmEmailDisplay').textContent = email;
      document.getElementById('emailConfirmModal').hidden = false;
      // Store payload for submission after confirmation
      window.pendingUserPayload = payload;
      return;
    }

    // For students, submit directly
    const resp = await api('/users', { method: 'POST', body: payload });
    if (!resp.ok) {
      errEl.textContent = resp.data?.error || 'Failed to create user.';
      errEl.hidden = false;
      return;
    }
    close();
    document.getElementById('nu_f_name').value = '';
    document.getElementById('nu_m_name').value = '';
    document.getElementById('nu_l_name').value = '';
    document.getElementById('nu_role').value = 'Student';
    document.getElementById('nu_username').value = '';
    document.getElementById('nu_email').value = '';
    document.getElementById('nu_student_id').value = '';
    document.getElementById('nu_department').value = '';
    document.getElementById('nu_year_level').value = '';
    document.getElementById('nu_birthday').value = '';
    await updateUsersList();
    showUserNotification(`✓ User created successfully`, 'success');
  });

  // Email confirmation modal handlers
  const emailConfirmModal = document.getElementById('emailConfirmModal');
  const confirmEmailBtn = document.getElementById('confirmEmailBtn');
  const cancelEmailBtn = document.getElementById('cancelEmailBtn');
  const emailConfirmErrorEl = document.getElementById('emailConfirmError');

  const closeEmailConfirmModal = () => {
    emailConfirmModal.hidden = true;
    emailConfirmErrorEl.hidden = true;
    window.pendingUserPayload = null;
  };

  cancelEmailBtn?.addEventListener('click', closeEmailConfirmModal);

  confirmEmailBtn?.addEventListener('click', async () => {
    if (!window.pendingUserPayload) return;
    
    emailConfirmErrorEl.hidden = true;
    confirmEmailBtn.disabled = true;

    const resp = await api('/users', { method: 'POST', body: window.pendingUserPayload });
    confirmEmailBtn.disabled = false;

    if (!resp.ok) {
      emailConfirmErrorEl.textContent = resp.data?.error || 'Failed to create user.';
      emailConfirmErrorEl.hidden = false;
      return;
    }

    closeEmailConfirmModal();
    close(); // Close the new user modal
    
    document.getElementById('nu_f_name').value = '';
    document.getElementById('nu_m_name').value = '';
    document.getElementById('nu_l_name').value = '';
    document.getElementById('nu_role').value = 'Student';
    document.getElementById('nu_username').value = '';
    document.getElementById('nu_email').value = '';
    document.getElementById('nu_student_id').value = '';
    document.getElementById('nu_department').value = '';
    document.getElementById('nu_year_level').value = '';
    document.getElementById('nu_birthday').value = '';
    
    await updateUsersList();
    showUserNotification(`✓ User created successfully. Credentials sent to email.`, 'success');
  });

  // Batch upload modal
  const batchModal = document.getElementById('batchUploadModal');
  const batchOpenBtn = document.getElementById('batchUploadBtn');
  const batchCloseBtn = document.getElementById('closeBatchUploadModal');
  const batchCancelBtn = document.getElementById('cancelBatchUploadModal');
  const batchFileInput = document.getElementById('batchUploadFile');
  const batchPreviewBtn = document.getElementById('previewBatchBtn');
  const batchErrorEl = document.getElementById('batchUploadError');
  const batchSuccessEl = document.getElementById('batchUploadSuccess');

  let currentBatchFile = null;
  
  const openBatchModal = () => {
    batchModal.hidden = false;
    batchFileInput.value = '';
    batchErrorEl.hidden = true;
    batchSuccessEl.hidden = true;
  };
  
  const closeBatchModal = () => { batchModal.hidden = true; };

  batchOpenBtn?.addEventListener('click', openBatchModal);
  batchCloseBtn?.addEventListener('click', closeBatchModal);
  batchCancelBtn?.addEventListener('click', closeBatchModal);
  batchModal?.addEventListener('click', (e) => { if (e.target === batchModal) closeBatchModal(); });

  const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
  downloadTemplateBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(API_BASE + '/users/batch/template', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + getToken() }
      });
      if (!response.ok) {
        alert('Failed to download template');
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'batch_upload_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download template: ' + err.message);
    }
  });

  let batchPreviewCurrentPage = 1;

  batchPreviewBtn?.addEventListener('click', async () => {
    if (!batchFileInput.files.length) {
      batchErrorEl.textContent = 'Please select a file';
      batchErrorEl.hidden = false;
      return;
    }
    
    const file = batchFileInput.files[0];
    
    // Store file in sessionStorage for the preview page
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target.result.split(',')[1]; // Get base64
        const fileData = file.name + '|' + fileContent;
        sessionStorage.setItem('batchUploadFile', fileData);
        // Navigate to preview page
        window.location.href = 'batch-upload-preview.html';
      };
      reader.readAsDataURL(file);
    } catch (err) {
      batchErrorEl.textContent = 'Error reading file: ' + err.message;
      batchErrorEl.hidden = false;
    }
  });

  // Edit user modal
  const editModal = document.getElementById('editUserModal');
  const editForm = document.getElementById('editUserForm');
  const editErrorEl = document.getElementById('editUserError');
  const editCloseBtn = document.getElementById('closeEditUserModal');
  const editCancelBtn = document.getElementById('cancelEditUserModal');
  let editingUserId = null;

  const openEditModal = (userId) => {
    editingUserId = userId;
    editModal.hidden = false;
    editErrorEl.hidden = true;
  };
  const closeEditModal = () => { editModal.hidden = true; };

  editCloseBtn?.addEventListener('click', closeEditModal);
  editCancelBtn?.addEventListener('click', closeEditModal);
  editModal?.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });

  // Update required attribute when role changes in edit form
  document.getElementById('eu_role')?.addEventListener('change', function() {
    const isStudent = this.value === 'Student';
    document.getElementById('eu_year_level').required = isStudent;
    document.getElementById('eu_studentid_wrap').style.display = isStudent ? '' : 'none';
    document.getElementById('eu_department_wrap').style.display = isStudent ? '' : 'none';
    document.getElementById('eu_year_wrap').style.display = isStudent ? '' : 'none';
    document.getElementById('eu_birthday_wrap').style.display = isStudent ? 'none' : '';
    document.getElementById('eu_username_wrap').style.display = isStudent ? 'none' : '';
  });

  // Add event listeners for auto-generating student ID in edit form
  document.getElementById('eu_f_name')?.addEventListener('change', () => {
    const studentIdField = document.getElementById('eu_student_id');
    if (studentIdField) {
      studentIdField.value = generateEditStudentId();
    }
  });
  document.getElementById('eu_m_name')?.addEventListener('change', () => {
    const studentIdField = document.getElementById('eu_student_id');
    if (studentIdField) {
      studentIdField.value = generateEditStudentId();
    }
  });
  document.getElementById('eu_l_name')?.addEventListener('change', () => {
    const studentIdField = document.getElementById('eu_student_id');
    if (studentIdField) {
      studentIdField.value = generateEditStudentId();
    }
  });
  document.getElementById('eu_birthday')?.addEventListener('change', () => {
    const studentIdField = document.getElementById('eu_student_id');
    if (studentIdField) {
      studentIdField.value = generateEditStudentId();
    }
  });

  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    editErrorEl.hidden = true;

    const editRole = document.getElementById('eu_role').value;
    if (editRole === 'Student' && !document.getElementById('eu_year_level').value) {
      editErrorEl.textContent = 'Year Level is required for Student role.';
      editErrorEl.hidden = false;
      return;
    }

    const payload = {
      f_name: document.getElementById('eu_f_name').value.trim(),
      m_name: document.getElementById('eu_m_name').value.trim() || null,
      l_name: document.getElementById('eu_l_name').value.trim(),
      role: document.getElementById('eu_role').value,
      username: document.getElementById('eu_username').value.trim() || null,
      student_id: document.getElementById('eu_student_id').value.trim() || null,
      department: document.getElementById('eu_department').value || null,
      year_level: document.getElementById('eu_year_level').value || null,
      birthday: document.getElementById('eu_role').value === 'Student' ? document.getElementById('eu_birthday').value || null : null,
    };
    const resp = await api(`/users/${editingUserId}`, { method: 'PATCH', body: payload });
    if (!resp.ok) {
      editErrorEl.textContent = resp.data?.error || 'Failed to update user.';
      editErrorEl.hidden = false;
      return;
    }
    closeEditModal();
    await updateUsersList(currentPage);
    showUserNotification(`✓ User updated successfully`, 'success');
  });

  // Delete user modal
  const deleteModal = document.getElementById('deleteUserModal');
  const deleteText = document.getElementById('deleteUserText');
  const deleteCloseBtn = document.getElementById('closeDeleteUserModal');
  const deleteCancelBtn = document.getElementById('cancelDeleteUserModal');
  const confirmDeleteBtn = document.getElementById('confirmDeleteUserBtn');
  let deleteUserId = null;

  const openDeleteModal = (userId, userName) => {
    deleteUserId = userId;
    deleteText.textContent = `Delete user "${userName}"?`;
    deleteModal.hidden = false;
  };
  const closeDeleteModal = () => { deleteModal.hidden = true; };

  deleteCloseBtn?.addEventListener('click', closeDeleteModal);
  deleteCancelBtn?.addEventListener('click', closeDeleteModal);
  deleteModal?.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); });

  confirmDeleteBtn?.addEventListener('click', async () => {
    const resp = await api(`/users/${deleteUserId}`, { method: 'DELETE' });
    if (!resp.ok) {
      showUserNotification(resp.data?.error || 'Failed to delete user.', 'error');
      return;
    }
    closeDeleteModal();
    await updateUsersList(currentPage);
    showUserNotification('✓ User deleted successfully', 'success');
  });

  // Edit password modal
  const passwordModal = document.getElementById('passwordUserModal');
  const passwordForm = document.getElementById('passwordUserForm');
  const passwordErrorEl = document.getElementById('passwordUserError');
  const passwordNameDisplay = document.getElementById('passwordUserNameDisplay');
  const passwordCloseBtn = document.getElementById('closePasswordUserModal');
  const passwordCancelBtn = document.getElementById('cancelPasswordUserModal');
  let passwordUserId = null;
  let passwordUserName = null;

  const openPasswordModal = (userId, userName) => {
    passwordUserId = userId;
    passwordUserName = userName;
    passwordModal.hidden = false;
    passwordErrorEl.hidden = true;
    passwordNameDisplay.textContent = `Changing password for: ${userName}`;
    document.getElementById('pu_password').value = '';
    document.getElementById('pu_password_confirm').value = '';
  };
  const closePasswordModal = () => { passwordModal.hidden = true; };

  passwordCloseBtn?.addEventListener('click', closePasswordModal);
  passwordCancelBtn?.addEventListener('click', closePasswordModal);
  passwordModal?.addEventListener('click', (e) => { if (e.target === passwordModal) closePasswordModal(); });

  passwordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    passwordErrorEl.hidden = true;

    const newPassword = document.getElementById('pu_password').value;
    const confirmPassword = document.getElementById('pu_password_confirm').value;
    const passwordUserError = document.getElementById('passwordUserError');
    const passwordInput = document.getElementById('pu_password');

    // Real-time password validation display
    passwordInput?.addEventListener('input', function() {
      const pwd = this.value;
      document.getElementById('admin-req-length').style.opacity = pwd.length >= 8 ? '1' : '0.5';
      document.getElementById('admin-req-lower').style.opacity = /[a-z]/.test(pwd) ? '1' : '0.5';
      document.getElementById('admin-req-number').style.opacity = /\d/.test(pwd) ? '1' : '0.5';
      document.getElementById('admin-req-special').style.opacity = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd) ? '1' : '0.5';
    });

    if (!newPassword) {
      passwordErrorEl.textContent = 'Password is required.';
      passwordErrorEl.hidden = false;
      return;
    }

    if (newPassword !== confirmPassword) {
      passwordErrorEl.textContent = 'Passwords do not match.';
      passwordErrorEl.hidden = false;
      return;
    }

    // Validate password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      passwordErrorEl.textContent = validation.errors[0];
      passwordErrorEl.hidden = false;
      return;
    }

    const payload = {
      password: newPassword,
      adminChangingPassword: true
    };

    const resp = await api(`/users/${passwordUserId}`, { method: 'PATCH', body: payload });
    if (!resp.ok) {
      passwordErrorEl.textContent = resp.data?.error || 'Failed to change password.';
      passwordErrorEl.hidden = false;
      return;
    }

    alert(`Password changed successfully for ${passwordUserName}`);
    closePasswordModal();
    await updateUsersList(currentPage);
  });

  // initial load (start on page 1)
  await updateUsersList(1);
}
