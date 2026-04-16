import { api, escapeHtml } from './dashboard-utils.js';

// keep a cache of the most recent classes (uppercase-normalized)
let classesCache = [];
let currentUserRole = 'Admin'; // default to Admin

export async function renderClasses(role = 'Admin') {
  currentUserRole = role;
  const res = await api('/classes');
  const classes = (res.data && Array.isArray(res.data)) ? res.data : [];
  classesCache = classes.map(c=>({
    ...c,
    class_name: (c.class_name||'').toString().toUpperCase(),
    section: (c.section||'').toString().toUpperCase()
  }));
  
  const isInstructor = role === 'Instructor';
  return `
    <main class="main-content single-col">
      <div class="page-header">
        <h1 class="page-title">${isInstructor ? 'My Classes' : 'Class Management'}</h1>
        <button type="button" id="newClassBtn" class="btn-primary">+ New Class</button>
      </div>
      ${(!res.ok) ? `<div class="notice error">Could not load classes. ${escapeHtml(res.data?.error || '')}</div>` : ''}
      ${(res.ok && classes.length === 0) ? `<div class="notice">No classes found yet. Run <code>npm run init-db</code> to seed, or add a new class.</div>` : ''}
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Class</th><th>Class Description</th><th>Section</th>${!isInstructor ? '<th>Instructor</th>' : ''}<th>Students</th><th>Actions</th></tr></thead>
          <tbody>${classes.map(c => `
            <tr>
              <td>${escapeHtml(c.class_name)}</td>
              <td>${escapeHtml(c.description || '—')}</td>
              <td>${escapeHtml(c.section || '—')}</td>
              ${!isInstructor ? `<td>${escapeHtml(c.instructor_name || '—')}</td>` : ''}
              <td>${(c.student_count != null) ? c.student_count + ' Students' : '—'}</td>
              <td><button type="button" class="icon-btn view-class" data-id="${c.class_id}" title="View students">👁️</button><button type="button" class="icon-btn enroll-class" data-id="${c.class_id}" title="Enroll students">➕</button><button type="button" class="icon-btn edit-class" data-id="${c.class_id}" title="Edit">✏️</button><button type="button" class="icon-btn delete-class" data-id="${c.class_id}" title="Delete">🗑️</button></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>

      <!-- NEW CLASS MODAL -->
      <div class="modal-overlay" id="newClassModal" hidden>
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Add New Class</h2>
            <button type="button" class="modal-close" id="closeNewClassModal">×</button>
          </div>
          <div class="modal-body">
            <form id="newClassForm">
              <div class="modal-form-grid">
                <div>
                  <label class="login-label">Class Name</label>
                  <input type="text" id="nc_class_name" class="login-input" required>
                </div>
                <div>
                  <label class="login-label">Section</label>
                  <input type="text" id="nc_section" class="login-input" placeholder="A, B, C..." required>
                </div>
                <div class="modal-form-full">
                  <label class="login-label">Description</label>
                  <input type="text" id="nc_class_full_name" class="login-input">
                </div>
                ${!isInstructor ? `
                <div class="modal-form-full">
                  <label class="login-label">Instructor</label>
                  <select id="nc_instructor_id" class="login-input" required>
                    <option value="">— Select Instructor —</option>
                  </select>
                </div>
                ` : ''}
              </div>
              <p id="newClassError" class="login-error" hidden></p>
              <div style="margin-top:0.75rem;display:flex;gap:0.5rem;">
                <button type="submit" class="btn-primary">Create Class</button>
                <button type="button" id="cancelNewClassModal" class="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- EDIT CLASS MODAL -->
      <div class="modal-overlay" id="editClassModal" hidden>
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Edit Class</h2>
            <button type="button" class="modal-close" id="closeEditClassModal">×</button>
          </div>
          <div class="modal-body">
            <form id="editClassForm">
              <div class="modal-form-grid">
                <div>
                  <label class="login-label">Class Name</label>
                  <input type="text" id="ec_class_name" class="login-input" required>
                </div>
                <div>
                  <label class="login-label">Section</label>
                  <input type="text" id="ec_section" class="login-input" required>
                </div>
                <div class="modal-form-full">
                  <label class="login-label">Description</label>
                  <input type="text" id="ec_class_full_name" class="login-input">
                </div>
                ${!isInstructor ? `
                <div class="modal-form-full">
                  <label class="login-label">Instructor</label>
                  <select id="ec_instructor_id" class="login-input" required>
                    <option value="">— Select Instructor —</option>
                  </select>
                </div>
                ` : ''}
              </div>
              <p id="editClassError" class="login-error" hidden></p>
              <div style="margin-top:0.75rem;display:flex;gap:0.5rem;">
                <button type="submit" class="btn-primary">Save Changes</button>
                <button type="button" id="cancelEditClassModal" class="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- ENROLL STUDENTS MODAL -->
      <div class="modal-overlay" id="enrollModal" hidden>
        <div class="modal" style="max-width: 800px;">
          <div class="modal-header">
            <h2 class="modal-title">Enroll Students in <span id="enrollClassName"></span></h2>
            <button type="button" class="modal-close" id="closeEnrollModal">×</button>
          </div>
          <div class="modal-body">
            <input type="text" id="enrollSearch" class="login-input" placeholder="Search by name, ID, year, or department..." style="margin-bottom:1rem;">
            <div id="enrollList" style="max-height:400px;overflow-y:auto;border:1px solid #ccc;border-radius:4px;"></div>
            <p id="enrollError" class="login-error" hidden></p>
            <div style="margin-top:1rem;display:flex;gap:0.5rem;justify-content:space-between;align-items:center;">
              <button type="button" id="batchEnrollBtn" class="btn-secondary">📥 Batch Enroll</button>
              <div style="display:flex;gap:0.5rem;">
                <button type="button" id="saveEnrollBtn" class="btn-primary">Save Enrollments</button>
                <button type="button" id="cancelEnrollModal" class="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- BATCH ENROLL MODAL -->
      <div class="modal-overlay" id="batchEnrollModal" hidden>
        <div class="modal" style="max-width: 700px;">
          <div class="modal-header">
            <h2 class="modal-title">Batch Enroll: <span id="batchEnrollClassName"></span></h2>
            <button type="button" class="modal-close" id="closeBatchEnrollModal">×</button>
          </div>
          <div class="modal-body">
            <label class="login-label">Upload Excel File with Student Names</label>
            <input type="file" id="batchEnrollFile" class="login-input" accept=".xlsx,.xls" style="margin-bottom:1rem;">
            <p style="font-size:0.85rem;color:#666;margin-bottom:1rem;">
              Upload an Excel file with a column named "Name" containing student names. The system will find and enroll matching students.
            </p>
            <p id="batchEnrollError" class="login-error" hidden></p>
            <p id="batchEnrollSuccess" class="login-error" style="background:#dcfce7;color:#166534;border-left-color:#16a34a;" hidden></p>
            <div style="margin-top:1rem;display:flex;gap:0.5rem;justify-content:flex-end;">
              <button type="button" id="previewBatchEnrollBtn" class="btn-primary">Preview</button>
              <button type="button" id="cancelBatchEnrollModal" class="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <!-- BATCH ENROLL PREVIEW MODAL -->
      <div class="modal-overlay" id="batchEnrollPreviewModal" hidden>
        <div class="modal" style="max-width: 900px;">
          <div class="modal-header">
            <h2 class="modal-title">Review Batch Enrollment</h2>
            <button type="button" class="modal-close" id="closeBatchEnrollPreviewModal">×</button>
          </div>
          <div class="modal-body">
            <div style="display:flex;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;">
              <div style="padding:0.75rem 1rem;background:#dcfce7;color:#166534;border-radius:4px;border:1px solid #86efac;">
                ✅ <strong id="batchEnrollMatchCount">0</strong> Students Found
              </div>
              <div style="padding:0.75rem 1rem;background:#fef3c7;color:#92400e;border-radius:4px;border:1px solid #fcd34d;">
                ⚠️ <strong id="batchEnrollNoMatchCount">0</strong> Names Not Found
              </div>
            </div>
            <div id="batchEnrollPreviewContent" style="max-height:400px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:4px;margin-bottom:1rem;"></div>
            <p id="batchEnrollPreviewError" class="login-error" hidden></p>
            <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
              <button type="button" id="backToBatchEnrollBtn" class="btn-secondary">Back</button>
              <button type="button" id="confirmBatchEnrollBtn" class="btn-primary">Confirm Enrollment</button>
            </div>
          </div>
        </div>
      </div>

      <!-- VIEW STUDENTS MODAL -->
      <div class="modal-overlay" id="viewStudentsModal" hidden>
        <div class="modal" style="max-width:600px;">
          <div class="modal-header">
            <h2 class="modal-title">Students in <span id="viewClassName"></span></h2>
            <button type="button" class="modal-close" id="closeViewStudentsModal">×</button>
          </div>
          <div class="modal-body">
            <input type="text" id="viewStudentsSearch" class="login-input" placeholder="Search by name, ID, year, or department..." style="margin-bottom:1rem;">
            <div id="viewStudentsList" class="table-wrap" style="max-height:400px;overflow:auto;"></div>
            <div style="margin-top:1rem;text-align:right;"><button type="button" id="cancelViewStudentsModal" class="btn-primary">Close</button></div>
          </div>
        </div>
      </div>

      <!-- REMOVE STUDENT CONFIRMATION MODAL -->
      <div class="modal-overlay" id="removeStudentModal" hidden>
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title" style="color:#d32f2f;">⚠️ Remove Student</h2>
            <button type="button" class="modal-close" id="closeRemoveStudentModal">×</button>
          </div>
          <div class="modal-body">
            <p id="removeStudentText" style="margin-bottom:1.5rem;font-weight:500;">Remove this student from the class?</p>
            <p id="removeStudentError" class="login-error" hidden></p>
            <div style="display:flex;gap:0.5rem;">
              <button type="button" id="confirmRemoveStudentBtn" class="btn-primary" style="background-color:#d32f2f;color:white;border:none;">Remove</button>
              <button type="button" id="cancelRemoveStudentModal" class="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <!-- DELETE CONFIRMATION MODAL (shared with user management) -->
      <div class="modal-overlay" id="deleteUserModal" hidden>
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title" style="color:#d32f2f;">⚠️ Delete Class</h2>
            <button type="button" class="modal-close" id="closeDeleteUserModal">×</button>
          </div>
          <div class="modal-body">
            <p id="deleteUserText" style="margin-bottom:1.5rem;font-weight:500;">Delete this class?</p>
            <p style="margin-bottom:1rem;font-size:0.85rem;color:#666;">This will remove all enrollments as well.</p>
            <p id="deleteUserError" class="login-error" hidden></p>
            <div style="display:flex;gap:0.5rem;">
              <button type="button" id="confirmDeleteUserBtn" class="btn-primary" style="background-color:#d32f2f;color:white;border:none;">Delete</button>
              <button type="button" id="cancelDeleteUserModal" class="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </main>`;
}

export function initClassesPage() {
  const newClassModal = document.getElementById('newClassModal');
  const openNewClassBtn = document.getElementById('newClassBtn');
  const closeNewClassBtn = document.getElementById('closeNewClassModal');
  const cancelNewClassBtn = document.getElementById('cancelNewClassModal');
  const newClassForm = document.getElementById('newClassForm');
  const newClassError = document.getElementById('newClassError');
  const instructorSelect = document.getElementById('nc_instructor_id');
  const ncNameInput = document.getElementById('nc_class_name');
  const ncSectionInput = document.getElementById('nc_section');

  // Edit class modal
  const editModal = document.getElementById('editClassModal');
  const ecNameInput = document.getElementById('ec_class_name');
  const ecSectionInput = document.getElementById('ec_section');
  const closeEditClassBtn = document.getElementById('closeEditClassModal');
  const cancelEditClassBtn = document.getElementById('cancelEditClassModal');
  const editClassForm = document.getElementById('editClassForm');
  const editClassError = document.getElementById('editClassError');
  let currentEditId = null;

  // View students modal
  const viewStudentsModal = document.getElementById('viewStudentsModal');
  const closeViewStudentsBtn = document.getElementById('closeViewStudentsModal');
  const cancelViewStudentsBtn = document.getElementById('cancelViewStudentsModal');
  const viewStudentsList = document.getElementById('viewStudentsList');
  const viewClassName = document.getElementById('viewClassName');
  let currentViewClassId = null;

  // Remove student confirmation modal
  const removeStudentModal = document.getElementById('removeStudentModal');
  const closeRemoveStudentBtn = document.getElementById('closeRemoveStudentModal');
  const cancelRemoveStudentBtn = document.getElementById('cancelRemoveStudentModal');
  const removeStudentText = document.getElementById('removeStudentText');
  const confirmRemoveStudentBtn = document.getElementById('confirmRemoveStudentBtn');
  let pendingRemoveStudentId = null;
  let pendingRemoveStudentName = null;

  // Delete confirmation reuse user modal
  const deleteClassModal = document.getElementById('deleteUserModal');
  const deleteClassText = document.getElementById('deleteUserText');
  let pendingDeleteClassId = null;

  // Enroll modal
  const enrollModal = document.getElementById('enrollModal');
  const closeEnrollBtn = document.getElementById('closeEnrollModal');
  const cancelEnrollBtn = document.getElementById('cancelEnrollModal');
  const enrollList = document.getElementById('enrollList');
  const enrollClassName = document.getElementById('enrollClassName');
  const enrollError = document.getElementById('enrollError');
  const saveEnrollBtn = document.getElementById('saveEnrollBtn');
  let currentEnrollId = null;

  // small helper for compatibility with paginated API responses
  const extractArray = (res) => {
    if (!res || !res.data) return [];
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data.data)) return res.data.data;
    return [];
  };

  // helper to load instructor dropdown into a <select> element
  const loadInstructors = async (selectEl, selectedId) => {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">Loading...</option>';
    try {
      const res = await api('/users?role=Instructor');
      const instructors = extractArray(res);
      if (res.ok && instructors.length) {
        selectEl.innerHTML = '<option value="">— Select Instructor —</option>' +
          instructors.map(i =>
            `<option value="${i.user_id}"${selectedId && i.user_id == selectedId ? ' selected' : ''}>${escapeHtml(i.name)}</option>`
          ).join('');
      } else {
        selectEl.innerHTML = '<option value="">(no instructors)</option>';
      }
    } catch {
      selectEl.innerHTML = '<option value="">(failed to load instructors)</option>';
    }
  };

  // delete modal close/cancel
  const deleteCloseBtn = document.getElementById('closeDeleteUserModal');
  const deleteCancelBtn = document.getElementById('cancelDeleteUserModal');

  // helper to detect duplicates in cached classes; optionally ignore a given id
  const isDuplicateClass = (name, section, ignoreId) => {
    if (!name) return false;
    const n = name.trim().toUpperCase();
    const s = (section || 'A').trim().toUpperCase();
    const ignoreNum = (typeof ignoreId !== 'undefined' && ignoreId !== null) ? parseInt(ignoreId, 10) : null;
    return classesCache.some(c => {
      const matchName = (c.class_name||'').toString().toUpperCase() === n;
      const matchSection = (c.section||'').toString().toUpperCase() === s;
      if (!matchName || !matchSection) return false;
      if (ignoreNum !== null) return c.class_id !== ignoreNum;
      return true;
    });
  };

  const openNewClass = async () => {
    newClassError.hidden = true;
    newClassModal.hidden = false;
    if (instructorSelect) {
      await loadInstructors(instructorSelect);
    }

    document.getElementById('nc_class_name').value = '';
    document.getElementById('nc_class_full_name').value = '';
    document.getElementById('nc_section').value = '';
  };
  const closeNewClass = () => { newClassModal.hidden = true };

  const openEditClass = async (id) => {
    editClassError.hidden = true;
    editModal.hidden = false;
    currentEditId = id;
    const ecInstructorSelect = document.getElementById('ec_instructor_id');
    if (ecInstructorSelect) {
      await loadInstructors(ecInstructorSelect);
    }
    const res = await api(`/classes/${id}`);
    if (!res.ok) return alert('Unable to fetch class');
    const cls = res.data;
    document.getElementById('ec_class_name').value = (cls.class_name || '').toString().toUpperCase();
    document.getElementById('ec_class_full_name').value = cls.description || '';
    document.getElementById('ec_section').value = (cls.section || '').toString().toUpperCase();
    await loadInstructors(document.getElementById('ec_instructor_id'), cls.instructor_id);

    editClassError.hidden = true;
  };
  const closeEditClass = () => { editModal.hidden = true; };

  const openViewStudents = async (id, code) => {
    currentViewClassId = id;
    viewClassName.textContent = code;
    viewStudentsList.innerHTML = 'Loading...';
    viewStudentsModal.hidden = false;
    const res = await api(`/classes/${id}`);
    if (res.ok && res.data && Array.isArray(res.data.enrollments)) {
      const allEnrollments = res.data.enrollments;
      
      const renderViewList = (filter='') => {
        const term = filter.trim().toLowerCase();
        const filtered = allEnrollments.filter(s => {
          if (!term) return true;
          return s.name.toLowerCase().includes(term) || (s.student_id||'').toLowerCase().includes(term) || (s.year_level||'').toLowerCase().includes(term) || (s.department||'').toLowerCase().includes(term);
        });
        const rows = filtered.map(s => `
            <tr>
              <td>${escapeHtml(s.name)}</td>
              <td>${escapeHtml(s.student_id)}</td>
              <td>${escapeHtml(s.year_level||'')}</td>
              <td>${escapeHtml(s.department||'')}</td>
              <td><button type="button" class="icon-btn danger remove-student" data-student-id="${s.user_id}" data-student-name="${escapeHtml(s.name)}" title="Remove">🗑️</button></td>
            </tr>`).join('');
        viewStudentsList.innerHTML = `<table class="data-table"><thead><tr><th>Name</th><th>ID</th><th>Year</th><th>Dept</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;

        // attach removal listeners
        viewStudentsList.querySelectorAll('.remove-student').forEach(btn => {
          btn.addEventListener('click', function() {
            const sid = this.getAttribute('data-student-id');
            const sname = this.getAttribute('data-student-name');
            if (!sid || !currentViewClassId) return;
            pendingRemoveStudentId = sid;
            pendingRemoveStudentName = sname;
            removeStudentText.textContent = `Remove "${sname}" from the class?`;
            removeStudentModal.hidden = false;
          });
        });
      };
      
      renderViewList();
      const searchInput = document.getElementById('viewStudentsSearch');
      if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = () => renderViewList(searchInput.value);
      }
    } else {
      viewStudentsList.innerHTML = '<p class="notice error">Unable to load students.</p>';
    }
  };

  const openDeleteClass = (id, code) => {
    pendingDeleteClassId = id;
    deleteClassText.textContent = `Delete class "${code}"? This removes all enrollments.`;
    deleteClassModal.hidden = false;
  };

  let enrollAllStudents = [];
  let enrollCurrentEnrollments = [];
  let enrollInitiallyEnrolled = [];
  const renderEnrollList = (filter='') => {
    const term = filter.trim().toLowerCase();
    const rows = enrollAllStudents
      .filter(s => {
        // hide students who were already enrolled when the modal opened
        if (enrollInitiallyEnrolled.includes(s.user_id)) return false;
        if (!term) return true;
        return s.name.toLowerCase().includes(term) || (s.student_id||'').toLowerCase().includes(term) || (s.year_level||'').toLowerCase().includes(term) || (s.department||'').toLowerCase().includes(term);
      });
    enrollList.innerHTML = `
            <table class="data-table" style="margin:0; width:100%;">
              <thead><tr><th></th><th>Name</th><th>ID</th><th>Year</th><th>Dept</th></tr></thead>
              <tbody>
                ${rows.map(s => `
                  <tr style="cursor:pointer;">
                    <td><input type="checkbox" value="${s.user_id}" ${enrollCurrentEnrollments.includes(s.user_id)?'checked':''}></td>
                    <td>${escapeHtml(s.name)}</td>
                    <td>${escapeHtml(s.student_id)}</td>
                    <td>${escapeHtml(s.year_level||'')}</td>
                    <td>${escapeHtml(s.department||'')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
    enrollList.querySelectorAll('input[type=checkbox]').forEach(chk => {
      chk.addEventListener('change', function() {
        const uid = parseInt(this.value,10);
        if (this.checked) {
          if (!enrollCurrentEnrollments.includes(uid)) enrollCurrentEnrollments.push(uid);
        } else {
          enrollCurrentEnrollments = enrollCurrentEnrollments.filter(x=>x!==uid);
        }
      });
    });
    enrollList.querySelectorAll('tbody tr').forEach(row => {
      row.addEventListener('click', function(e) {
        if (e.target.tagName === 'INPUT') return;
        const chk = this.querySelector('input[type=checkbox]');
        if (chk) chk.checked = !chk.checked;
        chk.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  };
  const openEnroll = async (id, code) => {
    enrollError.hidden = true;
    currentEnrollId = id;
    enrollClassName.textContent = `Class: ${code}`;
    enrollModal.hidden = false;
    enrollList.innerHTML = 'Loading...';
    const allRes = await api('/users?role=Student');
    enrollAllStudents = extractArray(allRes);
    const clsRes = await api(`/classes/${id}`);
    enrollInitiallyEnrolled = (clsRes.data?.enrollments||[]).map(e=>e.user_id);
    // current selections start as the initial enrollments (checked state)
    enrollCurrentEnrollments = Array.from(enrollInitiallyEnrolled);
    renderEnrollList();
    const searchInput = document.getElementById('enrollSearch');
    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = () => renderEnrollList(searchInput.value);
    }
  };
  const closeEnroll = () => { enrollModal.hidden = true; };

  openNewClassBtn?.addEventListener('click', openNewClass);
  closeNewClassBtn?.addEventListener('click', closeNewClass);
  cancelNewClassBtn?.addEventListener('click', closeNewClass);
  newClassModal?.addEventListener('click', e=>{ if(e.target===newClassModal) closeNewClass(); });

  closeEditClassBtn?.addEventListener('click', closeEditClass);
  cancelEditClassBtn?.addEventListener('click', closeEditClass);
  editModal?.addEventListener('click', e=>{ if(e.target===editModal) closeEditClass(); });

  closeEnrollBtn?.addEventListener('click', closeEnroll);
  cancelEnrollBtn?.addEventListener('click', closeEnroll);
  enrollModal?.addEventListener('click', e=>{ if(e.target===enrollModal) closeEnroll(); });

  // Batch enroll modal
  const batchEnrollModal = document.getElementById('batchEnrollModal');
  const closeBatchEnrollBtn = document.getElementById('closeBatchEnrollModal');
  const cancelBatchEnrollBtn = document.getElementById('cancelBatchEnrollModal');
  const batchEnrollFile = document.getElementById('batchEnrollFile');
  const previewBatchEnrollBtn = document.getElementById('previewBatchEnrollBtn');
  const batchEnrollError = document.getElementById('batchEnrollError');
  const batchEnrollSuccess = document.getElementById('batchEnrollSuccess');
  const batchEnrollBtn = document.getElementById('batchEnrollBtn');
  let currentBatchEnrollId = null;
  let batchEnrollMatches = [];

  const openBatchEnroll = (id, code) => {
    currentBatchEnrollId = id;
    document.getElementById('batchEnrollClassName').textContent = code;
    batchEnrollFile.value = '';
    batchEnrollError.hidden = true;
    batchEnrollSuccess.hidden = true;
    batchEnrollModal.hidden = false;
  };
  const closeBatchEnroll = () => { batchEnrollModal.hidden = true; };
  const closeBatchEnrollPreview = () => { document.getElementById('batchEnrollPreviewModal').hidden = true; };

  batchEnrollBtn?.addEventListener('click', () => {
    const code = enrollClassName.textContent || '';
    openBatchEnroll(currentEnrollId, code);
  });
  closeBatchEnrollBtn?.addEventListener('click', closeBatchEnroll);
  cancelBatchEnrollBtn?.addEventListener('click', closeBatchEnroll);
  batchEnrollModal?.addEventListener('click', e=>{ if(e.target===batchEnrollModal) closeBatchEnroll(); });

  // Batch enroll preview modal
  const batchEnrollPreviewModal = document.getElementById('batchEnrollPreviewModal');
  const closeBatchEnrollPreviewBtn = document.getElementById('closeBatchEnrollPreviewModal');
  const backToBatchEnrollBtn = document.getElementById('backToBatchEnrollBtn');
  const confirmBatchEnrollBtn = document.getElementById('confirmBatchEnrollBtn');

  closeBatchEnrollPreviewBtn?.addEventListener('click', closeBatchEnrollPreview);
  backToBatchEnrollBtn?.addEventListener('click', closeBatchEnrollPreview);
  batchEnrollPreviewModal?.addEventListener('click', e=>{ if(e.target===batchEnrollPreviewModal) closeBatchEnrollPreview(); });

  previewBatchEnrollBtn?.addEventListener('click', async () => {
    if (!batchEnrollFile.files.length) {
      batchEnrollError.textContent = 'Please select a file';
      batchEnrollError.hidden = false;
      return;
    }

    try {
      // Read and parse Excel file
      const file = batchEnrollFile.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            batchEnrollError.textContent = 'Excel file is empty';
            batchEnrollError.hidden = false;
            return;
          }

          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { range: 1 });

          if (rows.length === 0) {
            batchEnrollError.textContent = 'No data found in Excel file. Make sure there is a "Name" column.';
            batchEnrollError.hidden = false;
            return;
          }

          // Get student names from the file
          const studentNamesToFind = rows
            .map(row => {
              // Try different column names
              return (row['Name'] || row['name'] || row['Student Name'] || row['student_name'] || '').toString().trim();
            })
            .filter(name => name.length > 0);

          if (studentNamesToFind.length === 0) {
            batchEnrollError.textContent = 'No student names found. Make sure there is a column named "Name"';
            batchEnrollError.hidden = false;
            return;
          }

          // Match students by name against all available students
          batchEnrollMatches = [];
          const notFound = [];
          
          for (const nameToFind of studentNamesToFind) {
            const found = enrollAllStudents.find(s => 
              s.name.toLowerCase().includes(nameToFind.toLowerCase()) || 
              nameToFind.toLowerCase().includes(s.name.toLowerCase())
            );
            if (found && !enrollInitiallyEnrolled.includes(found.user_id)) {
              batchEnrollMatches.push(found);
            } else if (!found) {
              notFound.push(nameToFind);
            }
          }

          // Show preview
          renderBatchEnrollPreview(batchEnrollMatches, notFound);
          batchEnrollModal.hidden = true;
          batchEnrollPreviewModal.hidden = false;
        } catch (err) {
          console.error('Error processing file:', err);
          batchEnrollError.textContent = 'Error reading file: ' + err.message;
          batchEnrollError.hidden = false;
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('Error:', err);
      batchEnrollError.textContent = 'Error: ' + err.message;
      batchEnrollError.hidden = false;
    }
  });

  const renderBatchEnrollPreview = (matches, notFound) => {
    document.getElementById('batchEnrollMatchCount').textContent = matches.length;
    document.getElementById('batchEnrollNoMatchCount').textContent = notFound.length;

    const content = document.getElementById('batchEnrollPreviewContent');
    content.innerHTML = `
      <table class="data-table" style="margin:0; width:100%;">
        <thead>
          <tr><th>Name</th><th>ID</th><th>Year</th><th>Dept</th></tr>
        </thead>
        <tbody>
          ${matches.map(s => `
            <tr style="background:#f0fdf4;">
              <td>${escapeHtml(s.name)}</td>
              <td>${escapeHtml(s.student_id)}</td>
              <td>${escapeHtml(s.year_level || '')}</td>
              <td>${escapeHtml(s.department || '')}</td>
            </tr>
          `).join('')}
          ${notFound.length > 0 ? `
            <tr style="background:#fee2e2;">
              <td colspan="4" style="color:#991b1b;padding:0.75rem;"><strong>⚠️ Not Found (${notFound.length}):</strong> ${notFound.map(n => escapeHtml(n)).join(', ')}</td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    `;
  };

  confirmBatchEnrollBtn?.addEventListener('click', async () => {
    if (batchEnrollMatches.length === 0) {
      alert('No students to enroll');
      return;
    }

    try {
      const studentIds = batchEnrollMatches.map(s => s.user_id);
      const r = await api(`/classes/${currentBatchEnrollId}/enrollments`, {
        method: 'POST',
        body: { student_ids: studentIds }
      });

      if (r.ok) {
        document.getElementById('batchEnrollPreviewError').hidden = true;
        closeBatchEnrollPreview();
        batchEnrollModal.hidden = true;
        batchEnrollSuccess.textContent = `✅ ${batchEnrollMatches.length} student(s) enrolled successfully!`;
        batchEnrollSuccess.hidden = false;
        
        // Reload student list
        setTimeout(() => {
          openEnroll(currentEnrollId, enrollClassName.textContent);
        }, 1500);
      } else {
        document.getElementById('batchEnrollPreviewError').textContent = r.data?.error || 'Failed to enroll students';
        document.getElementById('batchEnrollPreviewError').hidden = false;
      }
    } catch (err) {
      console.error('Error:', err);
      document.getElementById('batchEnrollPreviewError').textContent = 'Error: ' + err.message;
      document.getElementById('batchEnrollPreviewError').hidden = false;
    }
  });

  // delete modal listeners
  deleteCloseBtn?.addEventListener('click', () => { deleteClassModal.hidden = true; });
  deleteCancelBtn?.addEventListener('click', () => { deleteClassModal.hidden = true; });
  deleteClassModal?.addEventListener('click', e=>{ if(e.target===deleteClassModal) deleteClassModal.hidden=true; });

  // view students listeners
  closeViewStudentsBtn?.addEventListener('click', () => { viewStudentsModal.hidden = true; });
  cancelViewStudentsBtn?.addEventListener('click', () => { viewStudentsModal.hidden = true; });
  viewStudentsModal?.addEventListener('click', e=>{ if(e.target===viewStudentsModal) viewStudentsModal.hidden=true; });

  // remove student confirmation listeners
  closeRemoveStudentBtn?.addEventListener('click', () => { removeStudentModal.hidden = true; });
  cancelRemoveStudentBtn?.addEventListener('click', () => { removeStudentModal.hidden = true; });
  removeStudentModal?.addEventListener('click', e=>{ if(e.target===removeStudentModal) removeStudentModal.hidden=true; });

  confirmRemoveStudentBtn?.addEventListener('click', async () => {
    if (!pendingRemoveStudentId || !currentViewClassId) return;
    const r = await api(`/classes/${currentViewClassId}/enrollments/${pendingRemoveStudentId}`, { method: 'DELETE' });
    if (r.ok) {
      removeStudentModal.hidden = true;
      pendingRemoveStudentId = null;
      pendingRemoveStudentName = null;
      openViewStudents(currentViewClassId, viewClassName.textContent);
    } else {
      document.getElementById('removeStudentError').textContent = r.data?.error || 'Failed to remove student.';
      document.getElementById('removeStudentError').hidden = false;
    }
  });

  newClassForm?.addEventListener('submit', async e=>{
    e.preventDefault();
    newClassError.hidden=true;
    let class_name=document.getElementById('nc_class_name').value.trim().toUpperCase();
    const description=document.getElementById('nc_class_full_name').value.trim();
    let section=document.getElementById('nc_section').value.trim().toUpperCase()||'A';
    const instructor_id=document.getElementById('nc_instructor_id')?.value;
    if(!class_name||!description){
      newClassError.textContent='Class code and description are required.';
      newClassError.hidden=false;return;
    }
    if (currentUserRole === 'Admin' && !instructor_id) {
      newClassError.textContent='Instructor is required.';
      newClassError.hidden=false;return;
    }
    if (isDuplicateClass(class_name, section)) {
      newClassError.textContent = 'Class code and section combination already exists.';
      newClassError.hidden = false;
      return;
    }
    const body = { class_name, section, description };
    if (instructor_id) body.instructor_id = instructor_id;
    const resp=await api('/classes',{method:'POST',body});
    if(!resp.ok){
      newClassError.textContent=resp.data?.error||'Failed to create class.';
      newClassError.hidden=false;return;
    }
    closeNewClass();window.render();
  });

  editClassForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    editClassError.hidden=true;
    let class_name=document.getElementById('ec_class_name').value.trim().toUpperCase();
    const description=document.getElementById('ec_class_full_name').value.trim();
    let section=document.getElementById('ec_section').value.trim().toUpperCase()||'A';
    const instructor_id=document.getElementById('ec_instructor_id')?.value;
    if(!class_name||!description){
      editClassError.textContent='Class code and description are required.';
      editClassError.hidden=false;return;
    }
    if (currentUserRole === 'Admin' && !instructor_id) {
      editClassError.textContent='Instructor is required.';
      editClassError.hidden=false;return;
    }
    if (isDuplicateClass(class_name, section, currentEditId)) {
      editClassError.textContent = 'Class code and section combination already exists.';
      editClassError.hidden = false;
      return;
    }
    const body = { class_name, section, description };
    if (instructor_id) body.instructor_id = instructor_id;
    const resp=await api(`/classes/${currentEditId}`,{method:'PATCH',body});
    if(!resp.ok){
      editClassError.textContent=resp.data?.error||'Failed to update class.';
      editClassError.hidden=false;return;
    }
    closeEditClass();window.render();
  });

  saveEnrollBtn?.addEventListener('click',async ()=>{
    const checked=Array.from(enrollList.querySelectorAll('input[type=checkbox]:checked')).map(i=>parseInt(i.value,10));
    try{await api(`/classes/${currentEnrollId}/enrollments`,{method:'POST',body:{student_ids:checked}});closeEnroll();}catch{enrollError.textContent='Failed to save enrollments.';enrollError.hidden=false;}
  });

  document.querySelectorAll('.edit-class').forEach(btn=>btn.addEventListener('click',function(){openEditClass(this.getAttribute('data-id'));}));
  document.querySelectorAll('.view-class').forEach(btn=>btn.addEventListener('click',function(){openViewStudents(this.getAttribute('data-id'),this.closest('tr').querySelector('td').textContent);}));
  document.querySelectorAll('.enroll-class').forEach(btn=>btn.addEventListener('click',function(){openEnroll(this.getAttribute('data-id'),this.closest('tr').querySelector('td').textContent);}));
  document.querySelectorAll('.delete-class').forEach(btn=>btn.addEventListener('click',function(){openDeleteClass(this.getAttribute('data-id'),this.closest('tr').querySelector('td').textContent);}));
  const confirmDeleteUserBtn = document.getElementById('confirmDeleteUserBtn');
  confirmDeleteUserBtn?.addEventListener('click',async ()=>{
    if(!pendingDeleteClassId) return;
    const resp=await api(`/classes/${pendingDeleteClassId}`,{method:'DELETE'});
    if(!resp.ok){alert(resp.data?.error||'Failed to delete class.');return;}
    deleteClassModal.hidden=true;window.render();
  });
}
