import { escapeHtml } from './dashboard-utils.js';
import {
  formatDateShort,
  getFileIcon,
  isImageFile,
  buildAuthorSection,
  buildAttachmentIndicator,
  buildAttachmentRow,
  buildAnnouncementCard,
  buildMakeAnnouncementBox,
  buildStatsSidebar,
  buildStudentsSidebar,
  buildSearchFilterUI
} from './announcement-card-builder.js';
import { renderMarkdown } from './markdown-editor.js';

// Module-level variable for tracking selected files in announcement creation
let selectedFiles = [];

// Extract class_id from URL if present
function getClassIdFromUrl() {
  const hash = window.location.hash || '';
  // Only honor ?class_id=... when the hash is the announcements tab (e.g. #announcements?class_id=5)
  if (!hash.startsWith('#announcements?')) return null;
  const params = new URLSearchParams(hash.split('?')[1] || '');
  const classId = params.get('class_id');
  return classId ? parseInt(classId, 10) : null;
}

// ensure click handler for view links is attached once
if (typeof window !== 'undefined' && !window._annModalHandlerAttached) {
  document.addEventListener('click', async (ev) => {
    const viewEl = ev.target.closest && ev.target.closest('.view-ann');
    if (viewEl) {
      ev.preventDefault();
      const id = viewEl.getAttribute('data-id');
      if (!id) return;
      await openAnnouncementModalById(parseInt(id, 10));
      return;
    }
    
    const commentEl = ev.target.closest && ev.target.closest('.comment-btn');
    if (commentEl) {
      ev.preventDefault();
      const id = commentEl.getAttribute('data-id');
      if (!id) return;
      await openAnnouncementModalById(parseInt(id, 10), true); // true = scroll to comments
      return;
    }
  });
  window._annModalHandlerAttached = true;
}

// Extract class_id from route like #class-announcements/5
function getClassIdFromRoute() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#class-announcements\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Initialize search UI event listeners and filters
 * Attaches to #ann-search input and filter selects
 */
export function initAnnouncementSearch() {
  // Remove old listener references to allow re-binding
  const searchInput = document.getElementById('ann-search');
  
  if (searchInput) {
    // Handle search input with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const searchTerm = e.target.value.trim();
      
      // Immediately call updateAnnouncementSearch
      searchTimeout = setTimeout(() => {
        updateAnnouncementSearch(searchTerm);
      }, 300); // 300ms debounce
    });
  }
  
  // Handle filter select changes
  document.querySelectorAll('.filter-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const filterType = select.dataset.filter;
      const filterValue = select.value;
      updateAnnouncementFilter(filterType, filterValue);
    });
  });
}

/**
 * Filter announcements based on search term
 * @param {Array} announcements - All announcements
 * @param {string} searchTerm - Search text
 * @returns {Array} Filtered announcements
 */
export function filterAnnouncements(announcements, searchTerm) {
  if (!searchTerm) return announcements;
  
  const search = searchTerm.toLowerCase();
  return announcements.filter(a => {
    const title = (a.title || '').toLowerCase();
    const content = (a.content || '').toLowerCase();
    return title.includes(search) || content.includes(search);
  });
}

/**
 * Update announcement search and re-render feed
 * @param {string} searchTerm - Search term
 */
export function updateAnnouncementSearch(searchTerm) {
  const hashSegments = window.location.hash.split('?');
  const basePath = hashSegments[0] || '#announcements';
  
  const params = new URLSearchParams(hashSegments[1] || '');
  
  if (searchTerm) {
    params.set('search', searchTerm);
  } else {
    params.delete('search');
  }

  const newHash = params.toString() ? `${basePath}?${params.toString()}` : basePath;
  window.location.hash = newHash;
}

/**
 * Get current search term from URL
 * @returns {string} Search term
 */
export function getSearchTerm() {
  const hashSegments = window.location.hash.split('?');
  const params = new URLSearchParams(hashSegments[1] || '');
  return params.get('search') || '';
}

/**
 * Get current filters from URL
 * @returns {object} Filters object with department and year_level
 */
export function getFilters() {
  const hashSegments = window.location.hash.split('?');
  const params = new URLSearchParams(hashSegments[1] || '');
  return {
    department: params.get('department') || '',
    year_level: params.get('year_level') || ''
  };
}

/**
 * Update announcement filters and re-render feed
 * @param {string} filterType - 'department' or 'year_level'
 * @param {string} filterValue - The filter value
 */
export function updateAnnouncementFilter(filterType, filterValue) {
  const hashSegments = window.location.hash.split('?');
  const basePath = hashSegments[0] || '#announcements';
  
  const params = new URLSearchParams(hashSegments[1] || '');
  
  if (filterValue) {
    params.set(filterType, filterValue);
  } else {
    params.delete(filterType);
  }

  const newHash = params.toString() ? `${basePath}?${params.toString()}` : basePath;
  window.location.hash = newHash;
  
  // Trigger re-render manually since hashchange might not fire for parameter-only changes
  if (typeof window.render === 'function') {
    setTimeout(() => window.render(), 50);
  }
}

// announcements and overview rendering
export async function renderAnnouncements(role, page = 1) {
  const PAGE_SIZE = 10;
  const classId = getClassIdFromUrl();
  const searchTerm = !classId ? getSearchTerm() : '';
  const filters = !classId ? getFilters() : {};
  
  // When searching, disable pagination and fetch all announcements
  const usePagination = !searchTerm;
  
  // Build API endpoint with pagination
  let announcementEndpoint = classId 
    ? `/announcements?class_id=${classId}${usePagination ? `&limit=${PAGE_SIZE}&page=${page}` : ''}` 
    : `/announcements${usePagination ? `?limit=${PAGE_SIZE}&page=${page}` : ''}`;
  
  const [annRes, statsRes, classRes] = await Promise.all([
    api(announcementEndpoint),
    role === 'Admin' ? api('/announcements/stats/counts') : Promise.resolve({}),
    classId ? api(`/classes/${classId}`) : Promise.resolve({})
  ]);
  
  // Extract data and metadata from response
  let announcements = [];
  let totalAnnouncements = 0;
  
  if (annRes.data) {
    if (Array.isArray(annRes.data)) {
      announcements = annRes.data;
      totalAnnouncements = announcements.length;
    } else if (annRes.data.data && Array.isArray(annRes.data.data)) {
      announcements = annRes.data.data;
      totalAnnouncements = annRes.data.total || announcements.length;
    }
  }
  
  // Defensive: if no classId provided, ensure feed contains only school-wide posts
  if (!classId) announcements = announcements.filter(a => a.class_id === null || typeof a.class_id === 'undefined');
  
  // Further filter client-side according to stored user dept/year in case server didn't
  if (!classId) {
    const user = getUser();
    if (user && user.role === 'Student') {
      const dept = user.department || null;
      const yrlvl = user.year_level || null;
      announcements = announcements.filter(a => {
        const deptOk = !a.target_department || dept === null || a.target_department === dept;
        const yearOk = !a.target_year_level || yrlvl === null || a.target_year_level === yrlvl;
        return deptOk && yearOk;
      });
    }
  }
  
  const stats = (statsRes.data && role === 'Admin') ? statsRes.data : null;
  const currentClass = (classRes.data && classId) ? classRes.data : null;

  // Apply search filter to announcements
  let filteredAnnouncements = !classId 
    ? filterAnnouncements(announcements, searchTerm)
    : announcements;
  
  // Apply UI filter selections to announcements for all users
  // When a specific filter is selected, show ONLY announcements for that group (strict filter)
  // When "All" is selected, show all announcements
  if (!classId && (filters.department || filters.year_level)) {
    if (filters.department) {
      // Show only announcements specifically targeted to this department
      filteredAnnouncements = filteredAnnouncements.filter(a => 
        a.target_department === filters.department
      );
    }
    if (filters.year_level) {
      // Show only announcements specifically targeted to this year level
      filteredAnnouncements = filteredAnnouncements.filter(a => 
        a.target_year_level === filters.year_level
      );
    }
  }

  // Build announcement cards using new helper
  const cardsHtml = filteredAnnouncements.length 
    ? filteredAnnouncements.map(a => buildAnnouncementCard(a)).join('')
    : '<div class="notice">No announcements yet.</div>';

  // Build make announcement box
  let makeAnnouncementHtml = '';
  if ((role === 'Admin') || (role === 'Instructor' && classId)) {
    const currentUser = getUser();
    const userProfilePic = currentUser?.profile_path || '/uploads/default-profile.svg';
    const classContext = classId && currentClass ? `Posting to: <strong>${escapeHtml(currentClass.class_name)} ${escapeHtml(currentClass.section || '')}</strong>` : '';
    makeAnnouncementHtml = buildMakeAnnouncementBox(userProfilePic, { classContext, classId: classId || '' });
  }

  // Build search UI with current search term and filters
  let searchFilterHtml = '';
  if (!classId) {
    searchFilterHtml = buildSearchFilterUI({ searchTerm, filters });
  }

  // Build stats sidebar
  const statsHtml = buildStatsSidebar(stats && role === 'Admin' ? stats : null);

  const pageTitle = classId && currentClass 
    ? `${escapeHtml(currentClass.class_name)} ${escapeHtml(currentClass.section || '')} - Announcements` 
    : 'Announcements';
  const backLink = classId ? `<a href="#announcements" style="color:#2563eb;text-decoration:none;font-size:0.9rem;margin-bottom:1rem;display:inline-block;">← Back to All Announcements</a>` : '';

  // Calculate pagination info (only show if not searching)
  const totalPages = usePagination ? Math.ceil(totalAnnouncements / PAGE_SIZE) : 0;
  const paginationHtml = usePagination && totalPages > 1 ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border);">
      <button type="button" id="annPrevBtn" class="btn-secondary" ${page === 1 ? 'disabled' : ''}>← Previous</button>
      <span id="annPageInfo" style="font-size:0.9rem;color:var(--text-muted);">Page ${page} of ${totalPages}</span>
      <button type="button" id="annNextBtn" class="btn-secondary" ${page === totalPages ? 'disabled' : ''}>Next →</button>
    </div>
  ` : '';

  const innerHtml = `
      ${backLink}
      <div class="page-header">
        <h1 class="page-title">${pageTitle}</h1>
      </div>
      ${makeAnnouncementHtml}
      ${searchFilterHtml}
      <div class="announcements-feed">${cardsHtml}</div>
      ${paginationHtml}`;

  const html = `
    <main class="main-content">
      ${innerHtml}
    </main>
    ${!classId ? statsHtml : ''}`;

  // Store for pagination updates
  renderAnnouncements._lastInnerHtml = innerHtml;

  // Initialize search after page renders
  setTimeout(() => {
    initAnnouncementSearch();
  }, 50);

  return html;
}

export async function renderDashboardOverview(role) {
  const [statsRes, classesRes, annRes] = await Promise.all([
    role === 'Admin' ? api('/announcements/stats/counts') : Promise.resolve({}),
    (role === 'Student' || role === 'Instructor') ? api('/classes') : Promise.resolve({}),
    // fetch recent announcements (server returns school-wide for /announcements when no class_id)
    api('/announcements')
  ]);
  const stats = (statsRes.data && role === 'Admin') ? statsRes.data : null;
  const myClasses = (classesRes.data && Array.isArray(classesRes.data)) ? classesRes.data : [];

  // recent announcements: only school-wide posts
  const announcements = (annRes.data && Array.isArray(annRes.data)) ? annRes.data : [];
  const recent = announcements.filter(a => a.class_id === null || typeof a.class_id === 'undefined').slice(0,4);

  const recentList = recent.length ? recent.map(a => `
      <div class="mini-item">
        <div class="mini-title">${escapeHtml(a.title)}</div>
        <div class="mini-meta">${escapeHtml(a.author_name || '')} • ${new Date(a.date_posted).toLocaleDateString()}</div>
      </div>
    `).join('') : '<div class="muted">No recent announcements.</div>';

  const classesList = myClasses.slice(0, 6).map(c => `
      <div class="mini-item">
        <div class="mini-title">${escapeHtml(c.class_name)} ${escapeHtml(c.section || '')}</div>
        <div class="mini-meta">${escapeHtml(c.instructor_name || '')}</div>
      </div>
    `).join('') || '<div class="muted">No classes found.</div>';

  // ADMIN DASHBOARD
  if (role === 'Admin') {
    const statsCards = stats ? `
      <div class="dashboard-stats-section">
        <h2 class="dashboard-section-title">System Overview</h2>
        <div class="stats-grid">
          <div class="stat-card-enhanced">
            <div class="stat-card-icon">📢</div>
            <div class="stat-card-content">
              <div class="stat-num">${stats.announcements}</div>
              <div class="stat-label">Announcements</div>
            </div>
          </div>
          <div class="stat-card-enhanced">
            <div class="stat-card-icon">👥</div>
            <div class="stat-card-content">
              <div class="stat-num">${stats.students}</div>
              <div class="stat-label">Students</div>
            </div>
          </div>
          <div class="stat-card-enhanced">
            <div class="stat-card-icon">👨‍🏫</div>
            <div class="stat-card-content">
              <div class="stat-num">${stats.instructors}</div>
              <div class="stat-label">Instructors</div>
            </div>
          </div>
          <div class="stat-card-enhanced">
            <div class="stat-card-icon">📚</div>
            <div class="stat-card-content">
              <div class="stat-num">${stats.classes}</div>
              <div class="stat-label">Classes</div>
            </div>
          </div>
        </div>
      </div>
    ` : '';

    return `
      <main class="main-content single-col">
        <div class="dashboard-header">
          <h1 class="page-title">Admin Dashboard</h1>
          <p class="dashboard-subtitle">Manage your school system</p>
        </div>
        ${statsCards}
        <div class="dashboard-grid">
          <section class="dashboard-card">
            <div class="dashboard-card-header">
              <h2 class="dashboard-card-title">📢 Recent Announcements</h2>
              <a class="view-link" href="#announcements">View All →</a>
            </div>
            <div class="dashboard-card-content">
              ${recentList}
            </div>
          </section>

          <section class="dashboard-card">
            <div class="dashboard-card-header">
              <h2 class="dashboard-card-title">⚙️ Quick Actions</h2>
            </div>
            <div class="dashboard-card-content">
              <a href="#announcements" class="dashboard-action-item">
                <span class="action-icon">📝</span>
                <div>
                  <div class="action-title">Post Announcement</div>
                  <div class="action-desc">Create a school-wide announcement</div>
                </div>
                <span class="action-arrow">→</span>
              </a>
              <a href="#classes" class="dashboard-action-item">
                <span class="action-icon">📚</span>
                <div>
                  <div class="action-title">Manage Classes</div>
                  <div class="action-desc">View and manage all classes</div>
                </div>
                <span class="action-arrow">→</span>
              </a>
              <a href="#users" class="dashboard-action-item">
                <span class="action-icon">👥</span>
                <div>
                  <div class="action-title">Manage Users</div>
                  <div class="action-desc">Add, edit, or remove users</div>
                </div>
                <span class="action-arrow">→</span>
              </a>
            </div>
          </section>
        </div>
      </main>`;
  }

  // INSTRUCTOR DASHBOARD
  if (role === 'Instructor') {
    return `
      <main class="main-content single-col">
        <div class="dashboard-header">
          <h1 class="page-title">Instructor Dashboard</h1>
          <p class="dashboard-subtitle">Welcome back! Manage your classes and announcements</p>
        </div>

        <div class="dashboard-grid">
          <section class="dashboard-card">
            <div class="dashboard-card-header">
              <h2 class="dashboard-card-title">📚 My Classes</h2>
              <a class="view-link" href="#myclasses">View All →</a>
            </div>
            <div class="dashboard-card-content">
              ${classesList}
            </div>
          </section>

          <section class="dashboard-card">
            <div class="dashboard-card-header">
              <h2 class="dashboard-card-title">📢 School Announcements</h2>
              <a class="view-link" href="#announcements">View All →</a>
            </div>
            <div class="dashboard-card-content">
              ${recentList}
            </div>
          </section>
        </div>

        <section class="dashboard-card">
          <div class="dashboard-card-header">
            <h2 class="dashboard-card-title">✨ Quick Start</h2>
          </div>
          <div class="dashboard-card-content">
            <a href="#announcements" class="dashboard-action-item">
              <span class="action-icon">✍️</span>
              <div>
                <div class="action-title">Create Announcement</div>
                <div class="action-desc">Post an announcement to your class</div>
              </div>
              <span class="action-arrow">→</span>
            </a>
          </div>
        </section>
      </main>`;
  }

  // STUDENT DASHBOARD
  if (role === 'Student') {
    return `
      <main class="main-content single-col">
        <div class="dashboard-header">
          <h1 class="page-title">Student Dashboard</h1>
          <p class="dashboard-subtitle">Stay updated with your classes</p>
        </div>

        <div class="dashboard-grid">
          <section class="dashboard-card">
            <div class="dashboard-card-header">
              <h2 class="dashboard-card-title">📚 My Classes</h2>
              <a class="view-link" href="#myclasses">View All →</a>
            </div>
            <div class="dashboard-card-content">
              ${classesList}
            </div>
          </section>

          <section class="dashboard-card">
            <div class="dashboard-card-header">
              <h2 class="dashboard-card-title">📢 Latest Announcements</h2>
              <a class="view-link" href="#announcements">View All →</a>
            </div>
            <div class="dashboard-card-content">
              ${recentList}
            </div>
          </section>
        </div>
      </main>`;
  }

  // DEFAULT FALLBACK
  return `
    <main class="main-content single-col">
      <h1 class="page-title">Dashboard</h1>
      <div class="overview-grid">
        <section class="overview-card">
          <div class="overview-head">
            <h2 class="overview-title">Recent Announcements</h2>
            <a class="view-link" href="#announcements">Go to Announcements →</a>
          </div>
          ${recentList}
        </section>
        
        <section class="overview-card">
          <div class="overview-head">
            <h2 class="overview-title">My Classes</h2>
          </div>
          ${classesList}
        </section>
      </div>
    </main>`;
}

export async function initAnnouncementsPage() {
  let currentPage = 1;
  
  // Attach handlers after brief delay
  setTimeout(() => {
    attachAnnouncementHandlers();
  }, 100);
}

// Helper function to attach announcement handlers
function attachAnnouncementHandlers() {
  // Attach pagination button listeners
  let currentPage = 1;
  const pageInfo = document.getElementById('annPageInfo');
  if (pageInfo) {
    const match = pageInfo.textContent.match(/Page (\d+)/);
    if (match) currentPage = parseInt(match[1], 10);
  }
  
  const updateAnnouncementsList = async (page) => {
    currentPage = page;
    const role = getUser()?.role || 'Student';
    await renderAnnouncements(role, page);
    
    const innerHtml = renderAnnouncements._lastInnerHtml;
    if (!innerHtml) return;
    
    // Update main content inner HTML only (avoids nesting issues)
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.innerHTML = innerHtml;
      // Re-attach handlers after DOM update
      setTimeout(() => {
        initAnnouncementSearch();
        attachAnnouncementHandlers();
      }, 50);
    }
  };
  
  const prevBtn = document.getElementById('annPrevBtn');
  const nextBtn = document.getElementById('annNextBtn');
  
  // Remove old listeners by cloning (prevents duplicate listeners)
  if (prevBtn) {
    const newPrevBtn = prevBtn.cloneNode(true);
    prevBtn.replaceWith(newPrevBtn);
    newPrevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentPage > 1) updateAnnouncementsList(currentPage - 1);
    });
  }
  
  if (nextBtn) {
    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.replaceWith(newNextBtn);
    newNextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      updateAnnouncementsList(currentPage + 1);
    });
  }
  
  // Original announcement modal handlers
  function openAnnounceModal(classIdFromTrigger) {
    const existingModal = document.getElementById('announce-creation-modal');
    if (existingModal) existingModal.remove();

    const classId = classIdFromTrigger || '';
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'announce-creation-modal';
    overlay.className = 'modal-overlay';

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-dialog';

    // Modal header
    const header = document.createElement('div');
    header.className = 'modal-header';

    const title = document.createElement('h2');
    title.className = 'modal-title';
    title.textContent = 'Create Announcement';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => overlay.remove());

    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Modal body
    const body = document.createElement('div');
    body.className = 'modal-body';

    // Class context if applicable
    if (classId) {
      const classContextEl = document.querySelector('.class-context');
      if (classContextEl) {
        const classCtx = document.createElement('div');
        classCtx.className = 'class-context';
        classCtx.textContent = classContextEl.textContent;
        body.appendChild(classCtx);
      }
    }

    // Title input group
    const titleGroup = document.createElement('div');
    titleGroup.className = 'form-group';
    const titleLabel = document.createElement('label');
    titleLabel.className = 'form-label';
    titleLabel.textContent = 'Title';
    const titleInput = document.createElement('textarea');
    titleInput.id = 'newAnnTitle';
    titleInput.className = 'form-textarea';
    titleInput.placeholder = 'Announcement title...';
    titleInput.rows = 1;
    titleGroup.appendChild(titleLabel);
    titleGroup.appendChild(titleInput);
    body.appendChild(titleGroup);

    // Content input group
    const contentGroup = document.createElement('div');
    contentGroup.className = 'form-group';
    const contentLabel = document.createElement('label');
    contentLabel.className = 'form-label';
    contentLabel.textContent = 'Message';
    const contentInput = document.createElement('textarea');
    contentInput.id = 'newAnnContent';
    contentInput.className = 'form-textarea';
    contentInput.placeholder = 'Write your announcement here...';
    contentInput.rows = 5;
    contentGroup.appendChild(contentLabel);
    contentGroup.appendChild(contentInput);
    body.appendChild(contentGroup);

    // Targeting controls (Admin only, school-wide)
    if (!classId) {
      const targetingDiv = document.createElement('div');
      targetingDiv.className = 'targeting-section';

      // Department
      const deptGroup = document.createElement('div');
      deptGroup.className = 'targeting-group';
      const deptLabel = document.createElement('label');
      deptLabel.className = 'form-label';
      deptLabel.textContent = 'Target Department';
      const deptSelect = document.createElement('select');
      deptSelect.id = 'targetDept';
      deptSelect.className = 'form-select';
      deptSelect.innerHTML = '<option value="">All Departments</option><option value="BSBA">BSBA</option><option value="BSCS">BSCS</option><option value="BSED">BSED</option><option value="BEED">BEED</option>';
      deptGroup.appendChild(deptLabel);
      deptGroup.appendChild(deptSelect);
      targetingDiv.appendChild(deptGroup);

      // Year level
      const yearGroup = document.createElement('div');
      yearGroup.className = 'targeting-group';
      const yearLabel = document.createElement('label');
      yearLabel.className = 'form-label';
      yearLabel.textContent = 'Target Year Level';
      const yearSelect = document.createElement('select');
      yearSelect.id = 'targetYear';
      yearSelect.className = 'form-select';
      yearSelect.innerHTML = '<option value="">All Years</option><option value="1st">1st Year</option><option value="2nd">2nd Year</option><option value="3rd">3rd Year</option><option value="4th">4th Year</option>';
      yearGroup.appendChild(yearLabel);
      yearGroup.appendChild(yearSelect);
      targetingDiv.appendChild(yearGroup);

      body.appendChild(targetingDiv);

      // SMS checkbox
      const smsLabel = document.createElement('label');
      smsLabel.className = 'form-checkbox-label';
      const smsCheckbox = document.createElement('input');
      smsCheckbox.type = 'checkbox';
      smsCheckbox.id = 'sendSmsCheckbox';
      smsCheckbox.className = 'form-checkbox';
      const smsText = document.createElement('span');
      smsText.textContent = 'Send SMS to matching students';
      smsLabel.appendChild(smsCheckbox);
      smsLabel.appendChild(smsText);
      body.appendChild(smsLabel);

      // Email checkbox
      const emailLabel = document.createElement('label');
      emailLabel.className = 'form-checkbox-label';
      const emailCheckbox = document.createElement('input');
      emailCheckbox.type = 'checkbox';
      emailCheckbox.id = 'sendEmailCheckbox';
      emailCheckbox.className = 'form-checkbox';
      const emailText = document.createElement('span');
      emailText.textContent = 'Send Email to students with verified email';
      emailLabel.appendChild(emailCheckbox);
      emailLabel.appendChild(emailText);
      body.appendChild(emailLabel);
    }

    // Attachment preview
    const attachmentPreview = document.createElement('div');
    attachmentPreview.id = 'attachmentPreview';
    attachmentPreview.className = 'attachment-preview';
    body.appendChild(attachmentPreview);

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'modal-footer';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'fileInput';
    fileInput.multiple = true;
    fileInput.accept = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt'; // Only allowed file types (no AVIF)
    fileInput.style.display = 'none';

    const addFileBtn = document.createElement('button');
    addFileBtn.type = 'button';
    addFileBtn.id = 'addFileBtn';
    addFileBtn.className = 'btn btn-secondary btn-file';
    addFileBtn.textContent = '📎 Add File';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());

    const postAnnBtn = document.createElement('button');
    postAnnBtn.type = 'button';
    postAnnBtn.id = 'postAnnBtn';
    postAnnBtn.className = 'btn btn-primary';
    postAnnBtn.textContent = 'Post Announcement';
    postAnnBtn.setAttribute('data-class-id', classId);

    actionsDiv.appendChild(fileInput);
    actionsDiv.appendChild(addFileBtn);
    actionsDiv.appendChild(cancelBtn);
    actionsDiv.appendChild(postAnnBtn);
    modal.appendChild(body);
    modal.appendChild(actionsDiv);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    attachEventListeners(fileInput, addFileBtn, postAnnBtn, attachmentPreview);
  }

  function attachEventListeners(fileInput, addFileBtn, postBtn, attachmentPreview) {
    // Reset selected files for this modal
    selectedFiles = [];

    // Define notification function first so it's available to all listeners
    function showAnnFormNotice(msg, type = 'error') {
      const existingPopup = document.getElementById('ann-form-popup');
      if (existingPopup) existingPopup.remove();

      const overlay = document.createElement('div');
      overlay.id = 'ann-form-popup';
      overlay.className = 'modal-overlay notification';

      const modal = document.createElement('div');
      modal.className = 'modal-dialog notification';

      const iconMap = { 'success': '✓', 'error': '✕' };

      const header = document.createElement('div');
      header.className = 'notification-header';

      const icon = document.createElement('div');
      icon.className = `notification-icon ${type}`;
      icon.textContent = iconMap[type] || '!';

      const titleText = type === 'success' ? 'Announcement Posted' : 'Announcement Error';
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
    }

    // File input handler
    if (addFileBtn && fileInput) {
      addFileBtn.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        const maxSize = 10 * 1024 * 1024;
        const maxTotalSize = 50 * 1024 * 1024;
        const files = Array.from(e.target.files);
        
        const oversizedFiles = files.filter(file => file.size > maxSize);
        if (oversizedFiles.length > 0) {
          alert(`The following files are too large (max 10MB each):\n${oversizedFiles.map(f => f.name).join('\n')}`);
          e.target.value = '';
          selectedFiles = [];
          updateAttachmentPreview();
          return;
        }
        
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > maxTotalSize) {
          alert(`Total file size too large (${(totalSize / (1024 * 1024)).toFixed(2)}MB). Maximum total is 50MB.`);
          e.target.value = '';
          selectedFiles = [];
          updateAttachmentPreview();
          return;
        }
        
        selectedFiles = files;
        updateAttachmentPreview();
      });
    }

    function updateAttachmentPreview() {
      if (!attachmentPreview) return;
      attachmentPreview.innerHTML = '';
      if (selectedFiles.length > 0) {
        const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        
        const list = document.createElement('div');
        list.className = 'attachment-list';
        const title = document.createElement('div');
        title.className = 'attachment-list-title';
        title.textContent = `Selected files (${selectedFiles.length}, ${totalSizeMB} MB total):`;
        list.appendChild(title);

        const fileList = document.createElement('ul');
        fileList.className = 'attachment-items';
        selectedFiles.forEach((file, index) => {
          const item = document.createElement('li');
          item.className = 'attachment-item';
          
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          const fileInfo = document.createElement('span');
          fileInfo.className = 'attachment-name';
          fileInfo.textContent = `${file.name} (${sizeMB} MB)`;
          
          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.textContent = '✕';
          deleteBtn.className = 'attachment-remove-btn';
          deleteBtn.title = 'Remove this file';
          
          deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            selectedFiles.splice(index, 1);
            fileInput.value = '';
            updateAttachmentPreview();
          });
          
          item.appendChild(fileInfo);
          item.appendChild(deleteBtn);
          fileList.appendChild(item);
        });
        list.appendChild(fileList);
        attachmentPreview.appendChild(list);
      }
    }

    let isPosting = false;

    // File type validation
    function validateFiles() {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ];
      
      // Disallowed extensions
      const blockedExtensions = ['.avif'];
      
      const maxSize = 10 * 1024 * 1024; // 10MB per file
      const maxTotalSize = 50 * 1024 * 1024; // 50MB total
      
      const errors = [];
      
      // Check individual file types and extensions
      for (const file of selectedFiles) {
        // Check by extension first (more reliable than MIME type)
        const fileName = file.name.toLowerCase();
        const fileExt = fileName.slice(fileName.lastIndexOf('.'));
        
        if (blockedExtensions.includes(fileExt)) {
          errors.push(`File type not supported: ${file.name} (.${fileExt}). AVIF files are not allowed.`);
          continue;
        }
        
        if (!allowedTypes.includes(file.type)) {
          errors.push(`File type not supported: ${file.name} (${file.type}). Allowed types: Images (JPEG, PNG, GIF, WebP), PDF, Word documents, Excel spreadsheets, and text files.`);
        }
      }
      
      // Check individual file sizes
      for (const file of selectedFiles) {
        if (file.size > maxSize) {
          errors.push(`${file.name} is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 10MB per file.`);
        }
      }
      
      // Check total size
      const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
      if (totalSize > maxTotalSize) {
        errors.push(`Total file size is too large (${(totalSize / (1024 * 1024)).toFixed(2)}MB). Maximum total is 50MB.`);
      }
      
      return errors;
    }

    if (postBtn) {
      postBtn.addEventListener('click', async () => {
        if (isPosting) {
          showAnnFormNotice('Please wait while your announcement is being posted...', 'error');
          return;
        }

        const titleEl = document.getElementById('newAnnTitle');
        const contentEl = document.getElementById('newAnnContent');
        const title = titleEl ? titleEl.value.trim() : '';
        const content = contentEl ? contentEl.value.trim() : '';
        const classId = postBtn.getAttribute('data-class-id');

        if (!title || !content) {
          showAnnFormNotice('Please provide both a title and message content before posting.', 'error');
          return;
        }

        // Validate files BEFORE posting
        if (selectedFiles.length > 0) {
          const validationErrors = validateFiles();
          if (validationErrors.length > 0) {
            showAnnFormNotice('Cannot post announcement due to file errors:\n\n' + validationErrors.join('\n\n'), 'error');
            return;
          }
        }

        isPosting = true;
        postBtn.disabled = true;
        const originalText = postBtn.textContent;
        postBtn.textContent = 'Posting...';

        try {
          const body = { title, content };
          if (classId) body.class_id = parseInt(classId, 10);
          const targetDeptEl = document.getElementById('targetDept');
          const targetYearEl = document.getElementById('targetYear');
          if (targetDeptEl) body.target_department = targetDeptEl.value || null;
          if (targetYearEl) body.target_year_level = targetYearEl.value || null;
          const sendSmsEl = document.getElementById('sendSmsCheckbox');
          if (sendSmsEl) body.send_sms = !!sendSmsEl.checked;
          const sendEmailEl = document.getElementById('sendEmailCheckbox');
          if (sendEmailEl) body.send_email = !!sendEmailEl.checked;

          console.log('📤 Posting announcement with body:', body);

          const res = await api('/announcements', { method: 'POST', body });
          if (res.ok) {
            if (selectedFiles.length > 0) {
              const announcementId = res.data.announcement_id;
              console.log('Announcement created with ID:', announcementId);
              
              // Upload attachments if any
              let uploadErrors = [];
              for (const file of selectedFiles) {
                const formData = new FormData();
                formData.append('file', file);
                try {
                  console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
                  const uploadRes = await api(`/announcements/${announcementId}/attachments`, {
                    method: 'POST',
                    body: formData
                  });
                  console.log('Upload response:', { ok: uploadRes.ok, status: uploadRes.status, data: uploadRes.data });
                  if (!uploadRes.ok) {
                    const errorMsg = uploadRes.data?.error || (typeof uploadRes.data === 'object' ? JSON.stringify(uploadRes.data) : String(uploadRes.data)) || `HTTP ${uploadRes.status}`;
                    console.error('Upload failed for', file.name, ':', errorMsg);
                    uploadErrors.push(`${file.name}: ${errorMsg}`);
                  }
                } catch (uploadErr) {
                  console.error('Failed to upload attachment:', file.name, uploadErr);
                  uploadErrors.push(`${file.name}: ${uploadErr.message || 'Network error'}`);
                }
              }
              
              // Show errors if any uploads failed
              if (uploadErrors.length > 0) {
                const errorMsg = 'Failed to upload ' + uploadErrors.length + ' file(s):\n' + uploadErrors.join('\n');
                showAnnFormNotice(errorMsg, 'error');
              }
            }

            if (titleEl) titleEl.value = '';
            if (contentEl) contentEl.value = '';
            selectedFiles = [];
            updateAttachmentPreview();
            
            let successMsg = 'Announcement posted successfully.';
            if (res.data.smsStats) {
              const stats = res.data.smsStats;
              if (stats.total > 0) {
                let smsDetails = `\n\n📱 SMS Status: `;
                if (stats.sent > 0) {
                  smsDetails += `✓ ${stats.sent} sent`;
                }
                if (stats.failed > 0) {
                  smsDetails += `${stats.sent > 0 ? ' | ' : ''}✗ ${stats.failed} failed`;
                }
                if (stats.pending > 0) {
                  smsDetails += `${stats.sent > 0 || stats.failed > 0 ? ' | ' : ''}⏳ ${stats.pending} pending`;
                }
                successMsg += smsDetails;
              }
            }
            if (res.data.emailStats) {
              const stats = res.data.emailStats;
              if (stats.total > 0) {
                let emailDetails = `\n\n📧 Email Status: `;
                if (stats.sent > 0) {
                  emailDetails += `✓ ${stats.sent} sent`;
                }
                if (stats.failed > 0) {
                  emailDetails += `${stats.sent > 0 ? ' | ' : ''}✗ ${stats.failed} failed`;
                }
                successMsg += emailDetails;
              }
            }
            showAnnFormNotice(successMsg, 'success');
            setTimeout(() => {
              document.getElementById('announce-creation-modal')?.remove();
              window.render();
            }, 700);
          } else {
            showAnnFormNotice(res.data?.error || 'Failed to post announcement. Please try again.', 'error');
          }
        } catch (err) {
          console.error('Error posting announcement:', err);
          showAnnFormNotice('An error occurred while posting. Please try again.', 'error');
        } finally {
          isPosting = false;
          postBtn.disabled = false;
          postBtn.textContent = originalText;
        }
      });
    }
  }

  // Attach click handler to compact input to open modal
  document.addEventListener('click', (e) => {
    if (e.target.id === 'annInputTrigger') {
      const classId = e.target.getAttribute('data-class-id');
      openAnnounceModal(classId);
    }
  });

  // Add click handler to announcement cards to open on click
  document.addEventListener('click', async (e) => {
    const card = e.target.closest('.announcement-card');
    if (!card) return;
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
    e.preventDefault();
    const annId = card.getAttribute('data-id');
    if (annId) {
      await openAnnouncementModalById(parseInt(annId, 10));
    }
  });
  
  // Initialize search and filter listeners
  initAnnouncementSearch();
}

export async function openAnnouncementModalById(id, scrollToComments = false) {
  try {
    const res = await api(`/announcements/${id}`);
    if (!res.ok) {
      alert(res.data?.error || 'Failed to load announcement');
      return;
    }
    showAnnouncementModal(res.data, scrollToComments);
  } catch (err) {
    console.error('openAnnouncementModalById', err);
    alert('Failed to load announcement');
  }
}

// Helper function to create a comment element
function createCommentElement(comment, announcementId) {
  const commentItem = document.createElement('div');
  commentItem.className = 'comment-item';
  commentItem.id = `comment-${comment.comment_id}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'comment-avatar';
  avatar.style.backgroundImage = `url('${comment.user_profile_path || '/uploads/default-profile.svg'}')`;
  commentItem.appendChild(avatar);
  
  const content = document.createElement('div');
  content.className = 'comment-content';
  
  const header = document.createElement('div');
  header.className = 'comment-header';
  
  const author = document.createElement('span');
  author.className = 'comment-author';
  author.textContent = comment.user_name || 'Unknown User';
  header.appendChild(author);
  
  const date = document.createElement('span');
  date.className = 'comment-date';
  date.textContent = comment.comment_date ? new Date(comment.comment_date).toLocaleString() : '';
  header.appendChild(date);
  
  const currentUser = getUser();
  if (currentUser && (currentUser.user_id === comment.user_id || currentUser.role === 'Admin')) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'comment-delete-btn';
    deleteBtn.textContent = '✕ Delete';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this comment?')) return;
      
      try {
        const res = await api(`/announcements/${announcementId}/comments/${comment.comment_id}`, {
          method: 'DELETE'
        });
        
        if (res.ok) {
          const commentElement = document.getElementById(`comment-${comment.comment_id}`);
          if (commentElement) {
            commentElement.remove();
            // Update comment count
            const commentsList = document.getElementById(`comments-list-${announcementId}`);
            const commentCount = commentsList.querySelectorAll('.comment-item').length;
            const commentsTitle = document.querySelector('.comments-title');
            if (commentsTitle) {
              commentsTitle.textContent = `Comments (${commentCount})`;
            }
            // Show empty state if no comments
            if (commentCount === 0) {
              const emptyMsg = document.createElement('div');
              emptyMsg.className = 'comments-empty';
              emptyMsg.id = `empty-comments-${announcementId}`;
              emptyMsg.textContent = 'No comments yet. Be the first to comment!';
              commentsList.appendChild(emptyMsg);
            }
          }
        } else {
          alert(res.data?.error || 'Failed to delete comment');
        }
      } catch (err) {
        console.error('Error deleting comment:', err);
        alert('An error occurred while deleting the comment');
      }
    });
    header.appendChild(deleteBtn);
  }
  
  content.appendChild(header);
  
  const text = document.createElement('div');
  text.className = 'comment-text';
  text.textContent = comment.comment_text || '';
  content.appendChild(text);
  
  commentItem.appendChild(content);
  return commentItem;
}

export function showAnnouncementModal(a, scrollToComments = false) {
  // remove existing
  const existing = document.getElementById('announcement-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'announcement-modal-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.5)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';

  const modal = document.createElement('div');
  modal.className = 'announcement-modal';
  modal.style.width = 'min(900px, 95%)';
  modal.style.maxHeight = '90vh';
  modal.style.overflow = 'auto';
  modal.style.background = '#fff';
  modal.style.borderRadius = '8px';
  modal.style.padding = '0';
  modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';

  // Header Section
  const header = document.createElement('div');
  header.style.padding = '1.5rem';
  header.style.borderBottom = '1px solid #e5e7eb';
  header.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #f3f4f6 100%)';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'flex-start';

  const titleContainer = document.createElement('div');
  titleContainer.style.marginBottom = '0.75rem';

  const title = document.createElement('h2');
  title.textContent = a.title || 'Announcement';
  title.style.margin = '0';
  title.style.fontSize = '1.25rem';
  title.style.fontWeight = '600';
  title.style.color = '#1f2937';
  titleContainer.appendChild(title);

  const meta = document.createElement('div');
  meta.style.fontSize = '0.85rem';
  meta.style.color = '#6b7280';
  meta.style.display = 'flex';
  meta.style.alignItems = 'center';
  meta.style.gap = '0.5rem';
  const when = a.date_posted ? new Date(a.date_posted).toLocaleString() : '';
  
  // Author avatar
  const avatar = document.createElement('div');
  avatar.style.width = '32px';
  avatar.style.height = '32px';
  avatar.style.borderRadius = '50%';
  avatar.style.backgroundImage = `url('${a.author_profile_path || '/uploads/default-profile.svg'}')`;
  avatar.style.backgroundSize = 'cover';
  avatar.style.backgroundPosition = 'center';
  avatar.style.flexShrink = '0';
  avatar.style.border = '2px solid #2563eb';
  meta.appendChild(avatar);
  
  // Author info
  const info = document.createElement('div');
  info.style.display = 'flex';
  info.style.flexDirection = 'column';
  info.style.gap = '0.125rem';
  const authorName = document.createElement('div');
  authorName.style.fontWeight = '500';
  authorName.style.color = '#1f2937';
  authorName.textContent = escapeHtml(a.author_name || 'Unknown');
  const authorMeta = document.createElement('div');
  authorMeta.style.fontSize = '0.75rem';
  authorMeta.style.color = '#9ca3af';
  authorMeta.textContent = `${escapeHtml(a.author_role || '')} • ${escapeHtml(when)}`;
  info.appendChild(authorName);
  info.appendChild(authorMeta);
  meta.appendChild(info);

  titleContainer.appendChild(meta);
  
  // Add target audience indicator for admin on the right
  let targetDisplay = null;
  const currentUser = getUser();
  if (currentUser && currentUser.role === 'Admin') {
    targetDisplay = document.createElement('div');
    targetDisplay.style.fontSize = '0.8rem';
    targetDisplay.style.color = '#6b7280';
    
    let targetText = 'School-wide';
    let icon = '📢';
    
    if (a.class_id && a.class_name) {
      targetText = `Class: ${escapeHtml(a.class_name)}`;
      icon = '🎓';
    } else if (a.target_department && a.target_year_level) {
      targetText = `${a.target_department} - ${a.target_year_level} Year`;
      icon = '👥';
    } else if (a.target_department) {
      targetText = `Department: ${a.target_department}`;
      icon = '🏢';
    } else if (a.target_year_level) {
      targetText = `${a.target_year_level} Year Students`;
      icon = '📚';
    }
    
    targetDisplay.innerHTML = `${icon} <strong>Sent to:</strong> ${targetText}`;
  }

  // Create left section for title and author info
  const leftSection = document.createElement('div');
  leftSection.style.flex = '1';
  leftSection.appendChild(titleContainer);
  
  header.appendChild(leftSection);
  
  // Add target indicator on the right side
  if (targetDisplay) {
    targetDisplay.style.textAlign = 'right';
    targetDisplay.style.whiteSpace = 'nowrap';
    targetDisplay.style.paddingTop = '2.5rem';
    header.appendChild(targetDisplay);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '1rem';
  closeBtn.style.right = '1.5rem';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.fontSize = '1.5rem';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.color = '#6b7280';
  closeBtn.style.transition = 'color 0.2s ease';
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#1f2937');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#6b7280');
  closeBtn.addEventListener('click', () => overlay.remove());
  header.style.position = 'relative';
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.style.padding = '1.5rem';
  body.className = 'announcement-full-body';
  body.style.marginBottom = '0';
  body.style.textAlign = 'justify';
  body.innerHTML = renderMarkdown(a.content || '');

  const attachments = document.createElement('div');
  if (a.attachments && Array.isArray(a.attachments) && a.attachments.length) {
    const attachHeader = document.createElement('div');
    attachHeader.style.padding = '0 1.5rem 0.75rem';
    
    const attachTitle = document.createElement('h4');
    attachTitle.textContent = 'Attachments';
    attachTitle.style.margin = '0 0 0.5rem';
    attachTitle.style.fontSize = '0.9rem';
    attachTitle.style.fontWeight = '600';
    attachTitle.style.color = '#1f2937';
    attachHeader.appendChild(attachTitle);
    attachments.appendChild(attachHeader);

    const container = document.createElement('div');
    container.style.padding = '0 1.5rem 1.5rem';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
    container.style.gap = '1rem';
    
    a.attachments.forEach((att) => {
      const filePath = att.file_path ? `/${att.file_path}` : '#';
      const isImage = isImageFile(att.filename);
      const icon = getFileIcon(att.filename);
      
      if (isImage) {
        // Image preview
        const imgWrapper = document.createElement('a');
        imgWrapper.href = filePath;
        imgWrapper.download = att.filename || '';
        imgWrapper.style.display = 'block';
        imgWrapper.style.textAlign = 'center';
        imgWrapper.style.textDecoration = 'none';
        imgWrapper.style.borderRadius = '8px';
        imgWrapper.style.overflow = 'hidden';
        imgWrapper.style.transition = 'transform 0.2s ease';
        imgWrapper.addEventListener('mouseenter', () => { imgWrapper.style.transform = 'scale(1.05)'; });
        imgWrapper.addEventListener('mouseleave', () => { imgWrapper.style.transform = 'scale(1)'; });
        
        const img = document.createElement('img');
        img.src = filePath;
        img.alt = att.filename;
        img.style.width = '100%';
        img.style.height = '120px';
        img.style.objectFit = 'cover';
        img.style.display = 'block';
        
        const label = document.createElement('div');
        label.style.fontSize = '0.75rem';
        label.style.color = '#666';
        label.style.padding = '0.35rem';
        label.style.wordBreak = 'break-word';
        label.textContent = att.filename;
        
        imgWrapper.appendChild(img);
        imgWrapper.appendChild(label);
        container.appendChild(imgWrapper);
      } else {
        // File with icon
        const fileBox = document.createElement('a');
        fileBox.href = filePath;
        fileBox.download = att.filename || '';
        fileBox.style.display = 'flex';
        fileBox.style.flexDirection = 'column';
        fileBox.style.alignItems = 'center';
        fileBox.style.padding = '1rem';
        fileBox.style.borderRadius = '8px';
        fileBox.style.border = '1px solid #e5e7eb';
        fileBox.style.textDecoration = 'none';
        fileBox.style.color = '#1f2937';
        fileBox.style.transition = 'all 0.2s ease';
        fileBox.style.cursor = 'pointer';
        fileBox.addEventListener('mouseenter', () => {
          fileBox.style.background = '#f3f4f6';
          fileBox.style.borderColor = '#2563eb';
        });
        fileBox.addEventListener('mouseleave', () => {
          fileBox.style.background = 'transparent';
          fileBox.style.borderColor = '#e5e7eb';
        });
        
        const iconEl = document.createElement('div');
        iconEl.style.fontSize = '2rem';
        iconEl.style.marginBottom = '0.5rem';
        iconEl.textContent = icon;
        
        const nameEl = document.createElement('div');
        nameEl.style.fontSize = '0.75rem';
        nameEl.style.textAlign = 'center';
        nameEl.style.wordBreak = 'break-word';
        nameEl.textContent = att.filename;
        
        fileBox.appendChild(iconEl);
        fileBox.appendChild(nameEl);
        container.appendChild(fileBox);
      }
    });
    
    attachments.appendChild(container);
  }

  // Check if current user is the author
  const isAuthor = currentUser && (currentUser.user_id === a.author_id || currentUser.role === 'Admin');

  // Footer section with buttons
  const footer = document.createElement('div');
  footer.style.padding = '1rem 1.5rem';
  footer.style.borderTop = '1px solid #e5e7eb';
  footer.style.background = '#f9fafb';
  footer.style.display = 'flex';
  footer.style.gap = '0.5rem';
  footer.style.flexWrap = 'wrap';
  footer.style.justifyContent = 'flex-end';

  if (isAuthor) {
    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️ Edit';
    editBtn.style.padding = '0.5rem 1rem';
    editBtn.style.fontSize = '0.85rem';
    editBtn.style.background = '#2563eb';
    editBtn.style.color = 'white';
    editBtn.style.border = 'none';
    editBtn.style.borderRadius = '6px';
    editBtn.style.fontWeight = '500';
    editBtn.style.cursor = 'pointer';
    editBtn.style.transition = 'all 0.2s ease';
    editBtn.addEventListener('mouseenter', () => editBtn.style.background = '#1d4ed8');
    editBtn.addEventListener('mouseleave', () => editBtn.style.background = '#2563eb');
    editBtn.addEventListener('click', () => {
      overlay.remove();
      showEditAnnouncementForm(a);
    });
    footer.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.style.padding = '0.5rem 1rem';
    deleteBtn.style.fontSize = '0.85rem';
    deleteBtn.style.background = '#ef4444';
    deleteBtn.style.color = 'white';
    deleteBtn.style.border = 'none';
    deleteBtn.style.borderRadius = '6px';
    deleteBtn.style.fontWeight = '500';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.transition = 'all 0.2s ease';
    deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.background = '#dc2626');
    deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.background = '#ef4444');
    deleteBtn.addEventListener('click', () => {
      showDeleteConfirmation(a.announcement_id, () => {
        overlay.remove();
      });
    });
    footer.appendChild(deleteBtn);
  }

  // Add "View Full Discussion" button
  const fullDiscussionBtn = document.createElement('button');
  fullDiscussionBtn.textContent = '💬 Full Discussion →';
  fullDiscussionBtn.style.padding = '0.5rem 1rem';
  fullDiscussionBtn.style.fontSize = '0.85rem';
  fullDiscussionBtn.style.background = '#10b981';
  fullDiscussionBtn.style.color = 'white';
  fullDiscussionBtn.style.border = 'none';
  fullDiscussionBtn.style.borderRadius = '6px';
  fullDiscussionBtn.style.fontWeight = '500';
  fullDiscussionBtn.style.cursor = 'pointer';
  fullDiscussionBtn.style.transition = 'all 0.2s ease';
  fullDiscussionBtn.addEventListener('mouseenter', () => fullDiscussionBtn.style.background = '#059669');
  fullDiscussionBtn.addEventListener('mouseleave', () => fullDiscussionBtn.style.background = '#10b981');
  fullDiscussionBtn.addEventListener('click', () => {
    overlay.remove();
    window.location.href = `announcement-detail.html?id=${a.announcement_id}`;
  });
  footer.appendChild(fullDiscussionBtn);

  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
  document.addEventListener('keydown', function escHandler(ev) { if (ev.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } });

  modal.appendChild(header);
  modal.appendChild(body);
  if (attachments.children.length) modal.appendChild(attachments);
  
  // Comments section
  const commentsSection = document.createElement('div');
  commentsSection.className = 'comments-section';
  commentsSection.id = `comments-section-${a.announcement_id}`;
  commentsSection.style.padding = '1.5rem';
  commentsSection.style.borderTop = '1px solid #e5e7eb';
  
  const commentsTitle = document.createElement('h3');
  commentsTitle.className = 'comments-title';
  const totalComments = a.comments ? a.comments.length : 0;
  const isPreview = totalComments > 5;
  commentsTitle.textContent = isPreview 
    ? `Comments (${totalComments} total, showing latest 5)` 
    : `Comments (${totalComments})`;
  commentsTitle.style.marginTop = '0';
  commentsSection.appendChild(commentsTitle);
  
  // Comments list
  const commentsList = document.createElement('div');
  commentsList.className = 'comments-list';
  commentsList.id = `comments-list-${a.announcement_id}`;
  
  if (a.comments && a.comments.length > 0) {
    // Show only the last 5 comments (most recent)
    const recentComments = a.comments.slice(-5).reverse();
    recentComments.forEach(comment => {
      const commentItem = createCommentElement(comment, a.announcement_id);
      commentsList.appendChild(commentItem);
    });
    
    // Show preview notice if there are more comments
    if (isPreview) {
      const previewNotice = document.createElement('div');
      previewNotice.style.padding = '0.75rem';
      previewNotice.style.background = '#f0fdf4';
      previewNotice.style.border = '1px solid #86efac';
      previewNotice.style.borderRadius = '6px';
      previewNotice.style.fontSize = '0.85rem';
      previewNotice.style.color = '#166534';
      previewNotice.style.textAlign = 'center';
      previewNotice.style.marginTop = '0.75rem';
      previewNotice.innerHTML = `Showing ${Math.min(5, totalComments)} of ${totalComments} comments. <strong>View Full Discussion</strong> to see all comments.`;
      commentsList.appendChild(previewNotice);
    }
  } else {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'comments-empty';
    emptyMsg.id = `empty-comments-${a.announcement_id}`;
    emptyMsg.textContent = 'No comments yet. Be the first to comment!';
    commentsList.appendChild(emptyMsg);
  }
  
  commentsSection.appendChild(commentsList);
  
  // Comment form
  const user = getUser();
  if (user) {
    const commentForm = document.createElement('div');
    commentForm.className = 'comment-form';
    commentForm.style.marginTop = '1rem';
    
    const commentInput = document.createElement('textarea');
    commentInput.className = 'comment-input';
    commentInput.placeholder = 'Add a comment...';
    commentInput.id = `comment-input-${a.announcement_id}`;
    
    const formActions = document.createElement('div');
    formActions.className = 'comment-form-actions';
    formActions.style.display = 'flex';
    formActions.style.gap = '0.5rem';
    formActions.style.marginTop = '0.5rem';
    
    const submitBtn = document.createElement('button');
    submitBtn.className = 'comment-submit-btn';
    submitBtn.textContent = 'Post Comment';
    submitBtn.id = `submit-comment-${a.announcement_id}`;
    submitBtn.style.padding = '0.5rem 1rem';
    submitBtn.style.fontSize = '0.85rem';
    submitBtn.style.background = '#2563eb';
    submitBtn.style.color = 'white';
    submitBtn.style.border = 'none';
    submitBtn.style.borderRadius = '6px';
    submitBtn.style.fontWeight = '500';
    submitBtn.style.cursor = 'pointer';
    
    submitBtn.addEventListener('click', async () => {
      const text = commentInput.value.trim();
      if (!text) {
        alert('Please enter a comment');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting...';
      
      try {
        const res = await api(`/announcements/${a.announcement_id}/comments`, {
          method: 'POST',
          body: { comment_text: text }
        });
        
        if (res.ok) {
          const newComment = res.data;
          commentInput.value = '';
          
          // Remove empty state if it exists
          const emptyState = document.getElementById(`empty-comments-${a.announcement_id}`);
          if (emptyState) emptyState.remove();
          
          // Add new comment to list
          const commentsList = document.getElementById(`comments-list-${a.announcement_id}`);
          const commentItem = createCommentElement(newComment, a.announcement_id);
          commentsList.insertBefore(commentItem, commentsList.firstChild);
          
          // Update comment count
          const commentCount = commentsList.querySelectorAll('.comment-item').length;
          commentsTitle.textContent = `Comments (${commentCount})`;
        } else {
          alert(res.data?.error || 'Failed to post comment');
        }
      } catch (err) {
        console.error('Error posting comment:', err);
        alert('An error occurred while posting the comment');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Comment';
      }
    });
    
    formActions.appendChild(submitBtn);
    commentForm.appendChild(commentInput);
    commentForm.appendChild(formActions);
    commentsSection.appendChild(commentForm);
  }
  
  modal.appendChild(commentsSection);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Scroll to comments section if requested
  if (scrollToComments) {
    setTimeout(() => {
      const commentsSection = document.querySelector(`#comments-section-${a.announcement_id}`);
      if (commentsSection) {
        commentsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus on the comment input
        const commentInput = document.querySelector(`#comment-input-${a.announcement_id}`);
        if (commentInput) commentInput.focus();
      }
    }, 100);
  }
}

// Delete confirmation modal
async function showDeleteConfirmation(announcementId, onClose) {
  const confirmOverlay = document.createElement('div');
  confirmOverlay.style.position = 'fixed';
  confirmOverlay.style.inset = '0';
  confirmOverlay.style.background = 'rgba(0,0,0,0.7)';
  confirmOverlay.style.display = 'flex';
  confirmOverlay.style.alignItems = 'center';
  confirmOverlay.style.justifyContent = 'center';
  confirmOverlay.style.zIndex = '10001';

  const confirmModal = document.createElement('div');
  confirmModal.style.width = 'min(400px, 90%)';
  confirmModal.style.background = '#fff';
  confirmModal.style.borderRadius = '8px';
  confirmModal.style.padding = '2rem';
  confirmModal.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';
  confirmModal.style.textAlign = 'center';

  const icon = document.createElement('div');
  icon.style.fontSize = '3rem';
  icon.style.marginBottom = '1rem';
  icon.textContent = '⚠️';

  const title = document.createElement('h2');
  title.textContent = 'Delete Announcement?';
  title.style.marginBottom = '0.5rem';
  title.style.color = '#ef4444';

  const message = document.createElement('p');
  message.textContent = 'This announcement will be permanently deleted and cannot be recovered.';
  message.style.color = '#666';
  message.style.marginBottom = '2rem';
  message.style.fontSize = '0.95rem';

  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '1rem';
  buttonContainer.style.justifyContent = 'center';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.padding = '0.75rem 1.5rem';
  cancelBtn.style.borderRadius = '4px';
  cancelBtn.style.border = '1px solid #d1d5db';
  cancelBtn.style.background = '#fff';
  cancelBtn.style.color = '#374151';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.style.fontSize = '0.95rem';
  cancelBtn.style.fontWeight = '500';
  cancelBtn.addEventListener('click', () => {
    confirmOverlay.remove();
  });

  const deleteConfirmBtn = document.createElement('button');
  deleteConfirmBtn.textContent = 'Delete';
  deleteConfirmBtn.style.padding = '0.75rem 1.5rem';
  deleteConfirmBtn.style.borderRadius = '4px';
  deleteConfirmBtn.style.border = 'none';
  deleteConfirmBtn.style.background = '#ef4444';
  deleteConfirmBtn.style.color = '#fff';
  deleteConfirmBtn.style.cursor = 'pointer';
  deleteConfirmBtn.style.fontSize = '0.95rem';
  deleteConfirmBtn.style.fontWeight = '500';
  deleteConfirmBtn.addEventListener('click', async () => {
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = 'Deleting...';
    cancelBtn.disabled = true;

    try {
      const response = await fetch(`/api/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error('Failed to parse response as JSON:', e, 'Response status:', response.status);
        data = { error: 'Server error: ' + response.statusText };
      }

      if (!response.ok) {
        deleteConfirmBtn.disabled = false;
        deleteConfirmBtn.textContent = 'Delete';
        cancelBtn.disabled = false;
        const errorMsg = document.createElement('p');
        errorMsg.textContent = data.error || 'Failed to delete announcement';
        errorMsg.style.color = '#ef4444';
        errorMsg.style.marginTop = '1rem';
        confirmModal.appendChild(errorMsg);
        return;
      }

      confirmOverlay.remove();
      if (onClose) onClose();

      // Re-render the current route so class views keep their context.
      if (typeof window.render === 'function') {
        await window.render();
      }
    } catch (err) {
      console.error('Delete error:', err);
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.textContent = 'Delete';
      cancelBtn.disabled = false;
      const errorMsg = document.createElement('p');
      errorMsg.textContent = 'Error deleting announcement. Please try again.';
      errorMsg.style.color = '#ef4444';
      errorMsg.style.marginTop = '1rem';
      confirmModal.appendChild(errorMsg);
    }
  });

  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(deleteConfirmBtn);

  confirmModal.appendChild(icon);
  confirmModal.appendChild(title);
  confirmModal.appendChild(message);
  confirmModal.appendChild(buttonContainer);
  confirmOverlay.appendChild(confirmModal);
  document.body.appendChild(confirmOverlay);
}

// Edit announcement form
export async function showEditAnnouncementForm(a) {
  const overlay = document.createElement('div');
  overlay.id = 'edit-announcement-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.5)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10000';

  const modal = document.createElement('div');
  modal.style.width = 'min(700px, 95%)';
  modal.style.maxHeight = '90vh';
  modal.style.overflow = 'auto';
  modal.style.background = '#fff';
  modal.style.borderRadius = '8px';
  modal.style.padding = '1.25rem';
  modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';

  const title = document.createElement('h2');
  title.textContent = 'Edit Announcement';
  title.style.marginTop = '0';

  const form = document.createElement('form');
  
  const titleLabel = document.createElement('label');
  titleLabel.className = 'login-label';
  titleLabel.textContent = 'Title';
  
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'login-input';
  titleInput.value = a.title || '';
  titleInput.required = true;
  titleInput.style.marginBottom = '1rem';

  const contentLabel = document.createElement('label');
  contentLabel.className = 'login-label';
  contentLabel.textContent = 'Content';
  
  const contentInput = document.createElement('textarea');
  contentInput.className = 'login-input';
  contentInput.value = a.content || '';
  contentInput.required = true;
  contentInput.rows = '6';
  contentInput.style.marginBottom = '1rem';

  // Existing attachments section
  const existingAttachments = a.attachments || [];
  const attachmentToRemove = new Set(); // Track which existing attachments to delete

  const attachmentLabel = document.createElement('label');
  attachmentLabel.className = 'login-label';
  attachmentLabel.textContent = 'Attached Files';

  const attachmentContainer = document.createElement('div');
  attachmentContainer.style.marginBottom = '1rem';
  attachmentContainer.style.padding = '0.75rem';
  attachmentContainer.style.background = '#f5f5f5';
  attachmentContainer.style.borderRadius = '4px';
  attachmentContainer.style.minHeight = '40px';

  if (existingAttachments.length > 0) {
    const existingList = document.createElement('div');
    existingList.style.fontSize = '0.85rem';
    existingList.style.marginBottom = '0.75rem';
    existingList.innerHTML = '<strong style="color:#666;">Existing files:</strong>';
    
    const fileGrid = document.createElement('div');
    fileGrid.style.display = 'grid';
    fileGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
    fileGrid.style.gap = '0.5rem';
    fileGrid.style.marginTop = '0.5rem';

    existingAttachments.forEach((file) => {
      const fileBox = document.createElement('div');
      fileBox.style.padding = '0.5rem';
      fileBox.style.background = '#fff';
      fileBox.style.border = '1px solid #ddd';
      fileBox.style.borderRadius = '4px';
      fileBox.style.display = 'flex';
      fileBox.style.flexDirection = 'column';
      fileBox.style.gap = '0.25rem';

      const icon = document.createElement('span');
      icon.textContent = getFileIcon(file.filename);
      icon.style.fontSize = '1.5rem';
      icon.style.textAlign = 'center';

      const name = document.createElement('span');
      name.textContent = file.filename;
      name.style.fontSize = '0.75rem';
      name.style.wordBreak = 'break-word';
      name.style.color = '#333';
      name.title = file.filename;

      const size = document.createElement('span');
      size.textContent = file.size;
      size.style.fontSize = '0.7rem';
      size.style.color = '#999';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.textContent = '✕ Remove';
      deleteBtn.style.background = '#ef4444';
      deleteBtn.style.color = '#fff';
      deleteBtn.style.border = 'none';
      deleteBtn.style.borderRadius = '3px';
      deleteBtn.style.padding = '0.25rem 0.5rem';
      deleteBtn.style.fontSize = '0.7rem';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.style.marginTop = '0.25rem';
      deleteBtn.title = 'Remove this file from announcement';

      let isRemoved = false;
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isRemoved) {
          attachmentToRemove.add(file.attachment_id);
          fileBox.style.opacity = '0.5';
          fileBox.style.textDecoration = 'line-through';
          deleteBtn.textContent = '↺ Restore';
          isRemoved = true;
        } else {
          attachmentToRemove.delete(file.attachment_id);
          fileBox.style.opacity = '1';
          fileBox.style.textDecoration = 'none';
          deleteBtn.textContent = '✕ Remove';
          isRemoved = false;
        }
      });

      fileBox.appendChild(icon);
      fileBox.appendChild(name);
      fileBox.appendChild(size);
      fileBox.appendChild(deleteBtn);
      fileGrid.appendChild(fileBox);
    });

    existingList.appendChild(fileGrid);
    attachmentContainer.appendChild(existingList);
  }

  // New files section
  const newFileInput = document.createElement('input');
  newFileInput.type = 'file';
  newFileInput.id = 'edit-file-input';
  newFileInput.multiple = true;
  newFileInput.style.display = 'none';

  const addFileBtn = document.createElement('button');
  addFileBtn.type = 'button';
  addFileBtn.textContent = '+ Add Files';
  addFileBtn.className = 'login-btn';
  addFileBtn.style.background = '#2563eb';
  addFileBtn.style.padding = '0.5rem 1rem';
  addFileBtn.style.fontSize = '0.9rem';
  addFileBtn.style.marginBottom = '0.5rem';

  let newFiles = [];

  addFileBtn.addEventListener('click', () => {
    newFileInput.click();
  });

  newFileInput.addEventListener('change', (e) => {
    const maxSize = 10 * 1024 * 1024; // 10MB per file
    const maxTotalSize = 50 * 1024 * 1024; // 50MB total
    const files = Array.from(e.target.files);
    
    // Validate individual file sizes
    const oversizedFiles = files.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      errorMsg.textContent = `The following files are too large (max 10MB each):\n${oversizedFiles.map(f => f.name).join('\n')}`;
      errorMsg.hidden = false;
      e.target.value = '';
      newFiles = [];
      updateNewFilePreview();
      return;
    }
    
    // Validate total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > maxTotalSize) {
      errorMsg.textContent = `Total file size too large (${(totalSize / (1024 * 1024)).toFixed(2)}MB). Maximum total is 50MB.`;
      errorMsg.hidden = false;
      e.target.value = '';
      newFiles = [];
      updateNewFilePreview();
      return;
    }
    
    newFiles = files;
    errorMsg.hidden = true;
    updateNewFilePreview();
  });

  const newFilePreview = document.createElement('div');
  newFilePreview.style.marginTop = '0.5rem';

  function updateNewFilePreview() {
    newFilePreview.innerHTML = '';
    if (newFiles.length > 0) {
      const totalSize = newFiles.reduce((sum, file) => sum + file.size, 0);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      
      const label = document.createElement('div');
      label.style.fontSize = '0.85rem';
      label.style.color = '#666';
      label.innerHTML = `<strong>Selected new files (${newFiles.length}, ${totalSizeMB} MB total):</strong>`;
      
      const fileList = document.createElement('ul');
      fileList.style.margin = '0.3rem 0';
      fileList.style.paddingLeft = '1.5rem';

      newFiles.forEach((file, index) => {
        const item = document.createElement('li');
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        
        const fileInfo = document.createElement('span');
        fileInfo.textContent = `${file.name} (${sizeMB} MB)`;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'remove';
        deleteBtn.style.background = 'none';
        deleteBtn.style.border = 'none';
        deleteBtn.style.color = '#ef4444';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '0.8rem';
        deleteBtn.style.marginLeft = '0.5rem';
        deleteBtn.style.textDecoration = 'underline';

        deleteBtn.addEventListener('click', (e) => {
          e.preventDefault();
          newFiles.splice(index, 1);
          newFileInput.value = '';
          updateNewFilePreview();
        });

        item.appendChild(fileInfo);
        item.appendChild(deleteBtn);
        fileList.appendChild(item);
      });

      newFilePreview.appendChild(label);
      newFilePreview.appendChild(fileList);
    }
  }

  const errorMsg = document.createElement('p');
  errorMsg.style.color = '#ef4444';
  errorMsg.style.fontSize = '0.85rem';
  errorMsg.style.marginBottom = '1rem';
  errorMsg.hidden = true;

  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '0.5rem';
  buttonContainer.style.marginTop = '1.5rem';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.textContent = 'Save Changes';
  saveBtn.className = 'login-btn';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'login-btn';
  cancelBtn.style.background = '#ddd';
  cancelBtn.style.color = '#000';
  cancelBtn.addEventListener('click', () => overlay.remove());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.hidden = true;

    const newTitle = titleInput.value.trim();
    const newContent = contentInput.value.trim();

    if (!newTitle || !newContent) {
      errorMsg.textContent = 'Title and content are required.';
      errorMsg.hidden = false;
      return;
    }

    saveBtn.disabled = true;

    // Create FormData to handle file uploads
    const formData = new FormData();
    formData.append('title', newTitle);
    formData.append('content', newContent);
    
    // Add IDs of attachments to remove
    if (attachmentToRemove.size > 0) {
      formData.append('remove_attachments', JSON.stringify(Array.from(attachmentToRemove)));
    }

    // Add new files
    newFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`/api/announcements/${a.announcement_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        errorMsg.textContent = data.error || `Error: ${response.status}`;
        errorMsg.hidden = false;
        saveBtn.disabled = false;
        return;
      }

      overlay.remove();
      // Re-fetch and display the updated announcement
      await openAnnouncementModalById(a.announcement_id);
    } catch (err) {
      console.error('Edit failed:', err);
      errorMsg.textContent = 'Error saving changes. Please try again.';
      errorMsg.hidden = false;
      saveBtn.disabled = false;
    }
  });

  buttonContainer.appendChild(saveBtn);
  buttonContainer.appendChild(cancelBtn);

  form.appendChild(titleLabel);
  form.appendChild(titleInput);
  form.appendChild(contentLabel);
  form.appendChild(contentInput);
  form.appendChild(attachmentLabel);
  form.appendChild(attachmentContainer);
  form.appendChild(addFileBtn);
  form.appendChild(newFileInput);
  form.appendChild(newFilePreview);
  form.appendChild(errorMsg);
  form.appendChild(buttonContainer);

  modal.appendChild(title);
  modal.appendChild(form);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

export async function renderClassAnnouncements(role) {
  const classId = getClassIdFromRoute();
  if (!classId) {
    return '<main class="main-content single-col"><div class="notice error">Invalid class.</div></main>';
  }
  
  const [annRes, classRes] = await Promise.all([
    api(`/announcements?class_id=${classId}`),
    api(`/classes/${classId}`)
  ]);

  if (!annRes.ok) {
    return `<main class="main-content single-col"><div class="notice error">${escapeHtml(annRes.data?.error || 'Failed to load announcements')}</div></main>`;
  }
  if (!classRes.ok) {
    return `<main class="main-content single-col"><div class="notice error">${escapeHtml(classRes.data?.error || 'Class not found')}</div></main>`;
  }

  let announcements = (annRes.data && Array.isArray(annRes.data)) ? annRes.data : [];
  // defensive filtering: drop any announcements that don't belong to this class
  announcements = announcements.filter(a => a.class_id === classId);
  if (announcements.length === 0 && annRes.data && Array.isArray(annRes.data) && annRes.data.length) {
    console.warn('Filtered out mismatched announcements for class', classId, annRes.data);
  }
  const currentClass = (classRes.data) ? classRes.data : null;
  const enrollments = (classRes.data && classRes.data.enrollments) ? classRes.data.enrollments : [];

  // Build students sidebar using helper
  const studentsSidebarHtml = (role === 'Instructor' && currentClass && enrollments.length > 0)
    ? buildStudentsSidebar(enrollments)
    : '';

  // Build announcement cards using helper
  const cardsHtml = announcements.length
    ? announcements.map(a => buildAnnouncementCard(a)).join('')
    : '<div class="notice">No announcements yet.</div>';

  // Build make announcement box
  let makeAnnouncementHtml = '';
  if ((role === 'Instructor' && currentClass) || (role === 'Admin' && currentClass)) {
    const currentUser = getUser();
    const userProfilePic = currentUser?.profile_path || '/uploads/default-profile.svg';
    const classContext = `Posting to: <strong>${escapeHtml(currentClass.class_name)} ${escapeHtml(currentClass.section || '')}</strong>`;
    makeAnnouncementHtml = buildMakeAnnouncementBox(userProfilePic, { classContext, classId });
  }

  return `
    <div class="class-announcements-container">
      <main class="main-content">
        <a href="#myclasses" style="color:#2563eb;text-decoration:none;font-size:0.9rem;margin-bottom:1rem;display:inline-block;">← Back to My Classes</a>
        <div class="page-header">
          <h1 class="page-title">${currentClass ? escapeHtml(currentClass.class_name) + ' - Announcements' : 'Class Announcements'}</h1>
        </div>
        ${makeAnnouncementHtml}
        <div class="announcements-feed">${cardsHtml}</div>
      </main>
      ${studentsSidebarHtml}
    </div>`;
}

export async function renderMyClasses(role) {
  const res = await api('/classes');
  let classes = (res.data && Array.isArray(res.data)) ? res.data : [];
  // debug: show raw classes response in console to help diagnose missing fields
  console.debug('renderMyClasses - /classes', res);

  // Always recompute announcement_count from announcements endpoint.
  // This keeps counters accurate even if backend counts are stale.
  if (classes.length) {
    try {
      const counts = await Promise.all(classes.map(async (c) => {
        const r = await api(`/announcements?class_id=${c.class_id}`);
        if (!r.data || !Array.isArray(r.data)) return 0;
        return r.data.filter(a => a.class_id === c.class_id).length;
      }));
      classes = classes.map((c, i) => ({ ...c, announcement_count: counts[i] }));
    } catch (err) {
      console.warn('renderMyClasses: failed to fetch announcement counts, will render without counts', err);
    }
  }

  const classCard = (c) => `
    <a href="#class-announcements/${c.class_id}" style="text-decoration:none;color:inherit;">
      <article class="class-card" style="padding:1.1rem;background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);cursor:pointer;transition:box-shadow 0.2s;height:100%;">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:1rem;">
          <div>
            <h3 style="margin:0 0 0.5rem 0;font-size:1.1rem;color:#1a1d21;">${escapeHtml(c.class_name)} ${escapeHtml(c.section || '')}</h3>
            ${typeof c.announcement_count !== 'undefined' ? `<div style="font-size:0.85rem;color:#555;margin-bottom:0.25rem;">${c.announcement_count} announcement${c.announcement_count===1?'':'s'}</div>` : ''}
            ${role === 'Student' ? `<p style="margin:0;font-size:0.9rem;color:#5c6370;">${escapeHtml(c.instructor_name || '—')}</p>` : ''}
          </div>
          <span style="background:#e8eef4;color:#2563eb;padding:0.25rem 0.75rem;border-radius:4px;font-size:0.85rem;font-weight:500;">${c.student_count || 0} Students</span>
        </div>
        <p style="margin:0;font-size:0.9rem;color:#5c6370;line-height:1.5;">${escapeHtml(c.description || 'No description available')}</p>
        <div style="margin-top:0.75rem;background:#2563eb;color:white;padding:0.45rem 0.8rem;border-radius:6px;text-align:center;font-weight:500;">View Announcements →</div>
      </article>
    </a>`;

  return `
    <main class="main-content single-col">
      <div class="page-header">
        <h1 class="page-title">${role === 'Instructor' ? 'My Classes' : 'My Classes'}</h1>
      </div>
      ${(!res.ok) ? `<div class="notice error">Could not load classes. ${escapeHtml(res.data?.error || '')}</div>` : ''}
      ${(res.ok && classes.length === 0) ? `<div class="notice">No classes found.</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem;">
        ${classes.map(classCard).join('')}
      </div>
    </main>`;
}
