import { route, escapeHtml, renderSidebar, layoutClass, validatePasswordStrength } from './dashboard-utils.js';
import { renderAnnouncements, renderDashboardOverview, initAnnouncementsPage, renderMyClasses, renderClassAnnouncements } from './dashboard-announcements.js';
import { renderSmsReports, initReportTabs } from './dashboard-reports.js';
import { renderUsers, initUsersPage } from './dashboard-users.js';
import { renderClasses, initClassesPage } from './dashboard-classes.js';

let currentUser = null;

function renderProfile(user) {
  const profilePicUrl = user.profile_path || '/uploads/default-profile.svg';
  
  return `
    <main class="main-content single-col">
      <!-- Header Section with Avatar and User Info -->
      <div class="profile-header-section">
        <div class="profile-avatar-large" style="background-image: url('${profilePicUrl}'); background-size: cover; background-position: center; position: relative; overflow: visible;">
          <input type="file" id="profilePictureInput" style="display:none;" accept="image/*">
          <label for="profilePictureInput" class="profile-pic-upload-btn" style="position: absolute; bottom: -5px; right: -5px; background: #3b82f6; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.2rem; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">📷</label>
        </div>
        <div class="profile-header-info">
          <h1 class="profile-user-name">${escapeHtml(user.name)}</h1>
          <p class="profile-user-role">${escapeHtml(user.role)}</p>
          <p class="profile-user-username">@${escapeHtml(user.username || '')}</p>
        </div>
      </div>

      <!-- Personal Information Section -->
      <div class="profile-section">
        <h2 class="profile-section-title">Personal Information</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1rem;">
          <div class="profile-info-item">
            <span class="profile-info-label" style="color:#9ca3af;">First Name</span>
            <span class="profile-info-value">${escapeHtml(user.f_name || '—')}</span>
          </div>
          <div class="profile-info-item">
            <span class="profile-info-label" style="color:#9ca3af;">Middle Name</span>
            <span class="profile-info-value">${escapeHtml(user.m_name || '—')}</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1rem;">
          <div class="profile-info-item">
            <span class="profile-info-label" style="color:#9ca3af;">Last Name</span>
            <span class="profile-info-value">${escapeHtml(user.l_name || '—')}</span>
          </div>
          <div class="profile-info-item">
            <span class="profile-info-label" style="color:#9ca3af;">Birthday</span>
            <span class="profile-info-value">${escapeHtml(user.birthday || '—')}</span>
          </div>
        </div>
        ${user.role === 'Student' ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1rem;">
          ${user.student_id ? `
            <div class="profile-info-item">
              <span class="profile-info-label" style="color:#9ca3af;">Student ID</span>
              <span class="profile-info-value">${escapeHtml(user.student_id)}</span>
            </div>
          ` : ''}
          <div class="profile-info-item">
            <span class="profile-info-label" style="color:#9ca3af;">Department</span>
            <span class="profile-info-value">${escapeHtml(user.department || '—')}</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
          <div class="profile-info-item">
            <span class="profile-info-label" style="color:#9ca3af;">Year Level</span>
            <span class="profile-info-value">${escapeHtml(user.year_level || '—')}</span>
          </div>
        </div>
        ` : ''}
      </div>

      <!-- Contact Information Section -->
      <div class="profile-section">
        <h2 class="profile-section-title">Contact Information</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
          <div class="profile-contact-item">
            <div class="profile-contact-label">Phone Number</div>
            <div id="phoneDisplayRow" class="profile-contact-value">
              <span id="phoneDisplay">${escapeHtml(user.phone_num || '—')}</span>
              <button type="button" id="editPhoneBtn" class="btn-contact-edit">✏️ Edit</button>
            </div>
            <div id="phoneEditRow" style="display:none;margin-top:1rem;">
              <input id="profilePhoneInput" class="login-input" type="text" value="${escapeHtml(user.phone_num || '')}" placeholder="09xxxxxxxxx">
              <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
                <button type="button" id="sendPhoneOtpBtn" class="btn-primary">Send OTP</button>
                <button type="button" id="cancelPhoneBtn" class="btn-secondary">Cancel</button>
              </div>
            </div>
            <div id="phoneOtpRow" style="display:none;margin-top:1rem;">
              <input id="phoneOtpInput" class="login-input" type="text" placeholder="Enter 6-digit OTP" maxlength="6">
              <div style="display:flex;gap:0.5rem;margin-top:0.5rem;align-items:center;">
                <button type="button" id="verifyPhoneOtpBtn" class="btn-primary">Verify OTP</button>
                <button type="button" id="cancelOtpBtn" class="btn-secondary">Cancel</button>
                <div id="otpTimer" style="font-size:0.85rem;color:#6b7280;min-width:60px;"></div>
              </div>
            </div>
            <p id="profilePhoneNotice" class="login-error" style="margin-top:0.5rem;" hidden></p>
          </div>

          <div class="profile-contact-item">
            <div class="profile-contact-label">Email Address</div>
            <div id="emailDisplayRow" class="profile-contact-value">
              <span id="emailDisplay">${escapeHtml(user.email || '—')}</span>
              <button type="button" id="editEmailBtn" class="btn-contact-edit">✏️ Edit</button>
            </div>
            <div id="emailEditRow" style="display:none;margin-top:1rem;">
              <input id="profileEmailInput" class="login-input" type="email" value="${escapeHtml(user.email || '')}" placeholder="your.email@example.com">
              <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
                <button type="button" id="sendEmailOtpBtn" class="btn-primary">Send OTP</button>
                <button type="button" id="cancelEmailBtn" class="btn-secondary">Cancel</button>
              </div>
            </div>
            <div id="emailOtpRow" style="display:none;margin-top:1rem;">
              <input id="emailOtpInput" class="login-input" type="text" placeholder="Enter 6-digit OTP" maxlength="6">
              <div style="display:flex;gap:0.5rem;margin-top:0.5rem;align-items:center;">
                <button type="button" id="verifyEmailOtpBtn" class="btn-primary">Verify OTP</button>
                <button type="button" id="cancelEmailOtpBtn" class="btn-secondary">Cancel</button>
                <div id="emailOtpTimer" style="font-size:0.85rem;color:#6b7280;min-width:60px;"></div>
              </div>
            </div>
            <p id="profileEmailNotice" class="login-error" style="margin-top:0.5rem;" hidden></p>
          </div>
        </div>
      </div>

      <!-- Security Section -->
      <div class="profile-section">
        <h2 class="profile-section-title">Security</h2>
        <form id="changePasswordForm" class="profile-password-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1rem;">
            <div style="width:100%;">
              <label class="login-label">Current Password</label>
              <div style="position:relative;width:100%;">
                <input class="login-input" id="currentPassword" type="password" required placeholder="Enter current password" style="width:100%;box-sizing:border-box;">
                <button type="button" class="pwd-toggle" id="toggleCurrentPassword" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b7280;padding:4px;">👁️</button>
              </div>
            </div>

            <div style="width:100%;">
              <label class="login-label">New Password</label>
              <div style="position:relative;width:100%;">
                <input class="login-input" id="newPassword" type="password" required placeholder="Enter new password" style="width:100%;box-sizing:border-box;">
                <button type="button" class="pwd-toggle" id="toggleNewPassword" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b7280;padding:4px;">👁️</button>
              </div>
            </div>
          </div>
          
          <div style="font-size: 0.875rem; margin: 1rem 0; padding: 1rem; background: #f0f9ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
            <p style="margin: 0 0 0.5rem 0; font-weight: 500; color: #1e40af;">Password Requirements:</p>
            <ul style="margin: 0; padding-left: 1.5rem; color: #475569;">
              <li id="profile-req-length" style="opacity: 0.5;">Minimum 8 characters</li>
              <li id="profile-req-lower" style="opacity: 0.5;">At least one lowercase letter (a-z)</li>
              <li id="profile-req-number" style="opacity: 0.5;">At least one number (0-9)</li>
              <li id="profile-req-special" style="opacity: 0.5;">At least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)</li>
            </ul>
          </div>

          <p id="profileFormNotice" class="login-error" hidden></p>
          <button type="submit" class="btn-primary" style="margin-top:1rem;">Update Password</button>
        </form>
      </div>

      <!-- Database Backup Section (Admin Only) -->
      ${user.role === 'Admin' ? `
      <div class="profile-section" id="backupSection">
        <h2 class="profile-section-title">Database Backup</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div>
            <p style="margin: 0 0 1rem 0; font-size: 0.95rem; color: #475569;">Create a backup of your entire database to prevent data loss.</p>
            <button type="button" id="createBackupBtn" class="btn-primary">Create Backup</button>
            <p id="backupStatus" style="margin-top: 0.5rem; font-size: 0.85rem; color: #6b7280; display: none;"></p>
          </div>
          <div>
            <p style="margin: 0 0 1rem 0; font-size: 0.95rem; color: #475569;">Available backups:</p>
            <div id="backupsList" style="max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1rem; background: #fafafa;">
              <p style="margin: 0; color: #9ca3af; font-size: 0.85rem;">Loading backups...</p>
            </div>
          </div>
        </div>
      </div>
      ` : ''}
    </main>`;
}

function renderMustRegisterEmail() {
  return `
    <main class="main-content single-col" style="display:flex;align-items:center;justify-content:center;">
      <form id="forceEmailRegisterForm" style="width:100%;max-width:500px;padding:2rem;background:#ffffff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <h2 style="margin:0 0 0.5rem 0;font-size:1.25rem;color:#1a1d21;">Complete Your Profile</h2>
        <p style="margin:0 0 1.5rem 0;font-size:0.875rem;color:#6b7280;">Please register your email address to use all features of the system. We'll send a verification code to confirm your email.</p>
        
        <label class="login-label">Email Address</label>
        <input id="forceRegEmailInput" class="login-input" type="email" placeholder="your.email@example.com" required>
        
        <div id="forceEmailOtpSection" style="display:none;margin-top:1.5rem;">
          <label class="login-label">Verification Code</label>
          <p style="font-size:0.875rem;color:#6b7280;margin-bottom:0.5rem;">Enter the 6-digit code we sent to your email.</p>
          <input id="forceRegEmailOtpInput" class="login-input" type="text" placeholder="000000" maxlength="6">
          <div id="forceEmailTestimonial" style="font-size:0.8rem;color:#6b7280;margin-top:0.5rem;"></div>
        </div>
        
        <p id="forceEmailError" class="login-error" style="margin-top:1rem;" hidden></p>
        
        <button type="button" id="forceEmailSendOtpBtn" class="btn-primary" style="width:100%;margin-top:1.5rem;">Send Verification Code</button>
        <button type="button" id="forceEmailVerifyOtpBtn" class="btn-primary" style="width:100%;margin-top:1rem;display:none;">Verify & Continue</button>
      </form>
    </main>`;
}

function renderPrivacyNotice(role = 'Student') {
  let content = '';

  if (role === 'Instructor') {
    content = `
      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">1. Overview</h2>
      <p>This Announcement Management and SMS Broadcasting System ("the System") is committed to protecting the privacy and security of our faculty members. This notice outlines how your personal information is processed in compliance with the Philippine Data Privacy Act of 2012.</p>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">2. Information We Collect</h2>
      <p>Upon the creation of your account by the System Administrator, the following data is processed:</p>
      <ul style="margin-left:1.5rem;">
        <li><strong>Professional Identity:</strong> Full Name and Employee/Faculty ID.</li>
        <li><strong>Contact Information:</strong> Mobile Phone Number and Institutional/Personal Email Address.</li>
        <li><strong>System Logs:</strong> Records of announcements sent, delivery timestamps, and login activity.</li>
      </ul>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">3. Purpose of Processing</h2>
      <p>Your data is used to enable the following functionalities:</p>
      <ul style="margin-left:1.5rem;">
        <li><strong>Announcement Broadcasting:</strong> To allow you to send SMS and Email alerts to students.</li>
        <li><strong>Account Management:</strong> To provide you with login credentials and system-related security updates.</li>
        <li><strong>Audit Trails:</strong> To maintain a record of communications sent through the system for institutional accountability.</li>
      </ul>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">4. Data Security &amp; Protection</h2>
      <p>We employ robust technical measures to ensure your information remains confidential:</p>
      <ul style="margin-left:1.5rem;">
        <li><strong>Advanced Encryption:</strong> Mobile numbers are protected using AES-256 encryption. Plain-text phone numbers are never stored in our database.</li>
        <li><strong>Data Masking:</strong> For security, phone numbers are masked within the user interface (e.g., 09*****05) and are only decrypted momentarily by the backend for SMS transmission.</li>
        <li><strong>Secure Transit:</strong> All email communications are transmitted via encrypted HTTPS protocols to our delivery partner, Ahasend.</li>
      </ul>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">5. Third-Party Service Providers</h2>
      <p>To facilitate broadcasting, the system interacts with:</p>
      <ul style="margin-left:1.5rem;">
        <li><strong>Ahasend (Email API):</strong> Processes your email address solely to deliver notifications.</li>
        <li><strong>SMS Gateway:</strong> Processes encrypted contact data to facilitate mobile broadcasts.</li>
      </ul>
      <p>These providers are bound by their own privacy standards and do not have permission to use your data for any other purpose.</p>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">6. Data Retention</h2>
      <ul style="margin-left:1.5rem;">
        <li><strong>Contact Information:</strong> Phone numbers are subject to an automated 4-year retention policy, after which they are purged from the system.</li>
        <li><strong>Account Data:</strong> Email addresses and names are retained as long as your faculty account remains active.</li>
        <li><strong>Archiving:</strong> Upon separation from the institution, your account may be soft-deleted or archived in accordance with school records management policies.</li>
      </ul>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">7. Your Rights as a Data Subject</h2>
      <p>You have the right to access your stored data, dispute any inaccuracies, and stay informed about any changes to how your data is handled. For inquiries regarding your privacy, please contact the Office of the Data Protection Officer.</p>
    `;
  } else {
    // Student privacy notice
    content = `
      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">1. Introduction</h2>
      <p>This system is committed to protecting the privacy of our students and faculty. In compliance with the Philippine Data Privacy Act of 2012 (RA 10173), this notice explains how we collect, use, and protect your personal information within our Announcement and SMS Broadcasting System.</p>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">2. Information We Collect</h2>
      <p>We process the following personal information provided by the School Administrator:</p>
      <ul style="margin-left:1.5rem;">
        <li><strong>Basic Identity:</strong> Full Name and Student/Faculty ID.</li>
        <li><strong>Contact Details:</strong> Mobile Phone Number and Email Address.</li>
      </ul>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">3. Purpose and Use of Data</h2>
      <p>Your data is used strictly for academic communication, including:</p>
      <ul style="margin-left:1.5rem;">
        <li>Sending official school announcements via SMS and Email.</li>
        <li>Distributing account credentials and system notifications.</li>
        <li>Tracking delivery status of important broadcasts.</li>
      </ul>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">4. How We Protect Your Data</h2>
      <p>We implement high-level technical security to keep your information safe:</p>
      <ul style="margin-left:1.5rem;">
        <li><strong>Encryption:</strong> Your phone numbers are encrypted using AES-256 standards. We do not store plain-text phone numbers in our database.</li>
        <li><strong>Masking:</strong> For your protection, phone numbers are masked in the system interface (e.g., 09*****05).</li>
        <li><strong>Transit Security:</strong> Emails are sent securely via HTTPS using the Ahasend API.</li>
      </ul>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">5. Data Sharing &amp; Third Parties</h2>
      <p>We do not sell or trade your data. To facilitate communications, your email and phone number are processed through:</p>
      <ul style="margin-left:1.5rem;">
        <li><strong>Ahasend (Email Service):</strong> Receives your email address only to deliver notifications.</li>
        <li><strong>SMS Gateway:</strong> Receives your encrypted phone number for broadcast purposes.</li>
      </ul>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">6. Data Retention &amp; Deletion</h2>
      <p>We do not keep your data forever.</p>
      <ul style="margin-left:1.5rem;">
        <li><strong>Phone Numbers:</strong> Automatically deleted from our system four (4) years after being added.</li>
        <li><strong>Email Addresses:</strong> Retained as long as your account is active for essential system communication.</li>
        <li><strong>Logs:</strong> Transactional logs (like delivery timestamps) are kept to ensure the system is working correctly.</li>
      </ul>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">7. Your Rights</h2>
      <p>As a data subject, you have the right to:</p>
      <ul style="margin-left:1.5rem;">
        <li>Be informed that your data is being processed.</li>
        <li>Access your data or request a summary of how it is used.</li>
        <li>Object to the processing of your data (though this may limit your ability to receive school updates).</li>
        <li>Request correction of any inaccurate information.</li>
      </ul>

      <h2 style="font-size:1.1rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem;">8. Contact Us</h2>
      <p>If you have concerns regarding your data privacy, please contact the System Administrator or the school's Data Protection Officer (DPO).</p>
    `;
  }

  return `
    <main class="main-content single-col" style="display:flex;align-items:center;justify-content:center;padding:1rem;">
      <div style="width:100%;max-width:700px;background:#ffffff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);padding:2rem;max-height:90vh;overflow-y:auto;">
        <h1 style="font-size:1.5rem;margin-bottom:0.5rem;color:#1a1d21;">DATA PRIVACY NOTICE</h1>
        <p style="font-size:0.85rem;color:#6b7280;margin-bottom:2rem;">Last Updated: April 17, 2026</p>

        <div style="font-size:0.95rem;line-height:1.6;color:#374151;">
          ${content}
        </div>

        <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid #e5e7eb;">
          <label style="display:flex;align-items:flex-start;gap:0.75rem;margin-bottom:1rem;cursor:pointer;">
            <input type="checkbox" id="privacyCheckbox" style="margin-top:0.25rem;width:18px;height:18px;cursor:pointer;">
            <span style="font-size:0.9rem;color:#374151;">I have read and understand the Data Privacy Notice. I consent to the processing of my personal data as described above.</span>
          </label>
          <p id="privacyError" class="login-error" hidden style="margin-bottom:1rem;"></p>
          <button type="button" id="acceptPrivacyBtn" class="login-btn" style="width:100%;">I Accept &amp; Continue</button>
        </div>
      </div>
    </main>`;
}

function renderMustChangePassword() {
  return `
    <main class="main-content single-col" style="display:flex;align-items:center;justify-content:center;">
      <form id="mustChangePasswordForm" style="width:100%;max-width:500px;padding:2rem;background:#ffffff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <h2 style="margin:0 0 0.5rem 0;font-size:1.25rem;color:#1a1d21;">Change Password</h2>
        <p style="margin:0 0 1.5rem 0;font-size:0.875rem;color:#6b7280;">Your account was created with a temporary password. Please set a strong new password to continue.</p>
        
        <div style="font-size: 0.875rem; margin: 1rem 0; padding: 1rem; background: #f0f9ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
          <p style="margin: 0 0 0.5rem 0; font-weight: 500; color: #1e40af;">Password Requirements:</p>
          <ul style="margin: 0; padding-left: 1.5rem; color: #475569;">
            <li id="req-length" style="opacity: 0.5;">Minimum 8 characters</li>
            <li id="req-lower" style="opacity: 0.5;">At least one lowercase letter (a-z)</li>
            <li id="req-number" style="opacity: 0.5;">At least one number (0-9)</li>
            <li id="req-special" style="opacity: 0.5;">At least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)</li>
          </ul>
        </div>
        
        <label class="login-label">New Password</label>
        <div style="position:relative;margin-bottom:1rem;">
          <input class="login-input" id="mustChangeNew" type="password" required placeholder="Enter new password">
          <button type="button" class="pwd-toggle" id="toggleMustChangeNew" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b7280;padding:4px;">👁️</button>
        </div>
        <label class="login-label">Confirm Password</label>
        <div style="position:relative;margin-bottom:1rem;">
          <input class="login-input" id="mustChangeConfirm" type="password" required placeholder="Confirm new password">
          <button type="button" class="pwd-toggle" id="toggleMustChangeConfirm" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b7280;padding:4px;">👁️</button>
        </div>
        <p id="mustChangeError" class="login-error" hidden></p>
        <button type="submit" class="login-btn" style="width:100%;margin-top:1rem;">Update Password</button>
      </form>
    </main>`;
}

async function render() {
  if (!getToken()) {
    window.location.href = 'login.html';
    return;
  }
  
  console.log('🔄 Render called, fetching user data...');
  const res = await api('/users/me');
  console.log('📦 API response:', res);
  
  if (res.ok && res.data) {
    console.log('✓ User data from API:', res.data);
    currentUser = res.data;
    setUser(res.data);
  } else {
    console.log('⚠️ API call failed or no data, falling back to local storage');
    if (res.status === 401 || res.error === 'Unauthorized') {
      window.location.href = 'login.html';
      return;
    }
    currentUser = getUser();
    console.log('✓ User from localStorage:', currentUser);
    
    if (!currentUser || !currentUser.role) {
      console.error('❌ No user data available');
      window.location.href = 'login.html';
      return;
    }
  }

  if (!currentUser) {
    console.error('❌ CRITICAL: currentUser is null/undefined after setup');
    window.location.href = 'login.html';
    return;
  }

  console.log('✓ currentUser is set:', currentUser);

  // Check privacy acceptance first (before password change)
  if (!currentUser.privacy_accepted) {
    console.log('⚠️ Privacy not accepted. Rendering privacy notice for role:', currentUser.role);
    const html = renderPrivacyNotice(currentUser.role);
    document.getElementById('app').innerHTML = html;
    const checkbox = document.getElementById('privacyCheckbox');
    const acceptBtn = document.getElementById('acceptPrivacyBtn');
    const errEl = document.getElementById('privacyError');

    if (!acceptBtn) {
      console.error('❌ Accept button not found in privacy notice');
      return;
    }

    acceptBtn.addEventListener('click', async () => {
      console.log('✓ Accept button clicked');
      errEl.hidden = true;
      
      if (!checkbox.checked) {
        console.log('⚠️ Checkbox not checked');
        errEl.textContent = 'You must accept the Privacy Notice to continue.';
        errEl.hidden = false;
        return;
      }

      console.log('✓ Checkbox is checked, sending accept request...');
      acceptBtn.disabled = true;
      acceptBtn.textContent = 'Accepting...';

      const res = await api('/users/privacy/accept', { method: 'POST' });
      console.log('✓ Privacy accept response:', res);
      acceptBtn.disabled = false;
      acceptBtn.textContent = 'I Accept & Continue';

      if (!res.ok) {
        console.error('❌ API error:', res);
        errEl.textContent = 'Failed to accept privacy notice. Please try again.';
        errEl.hidden = false;
        return;
      }

      console.log('✓ Privacy accepted successfully, refetching user data...');
      // Refetch user data from server to ensure privacy_accepted is updated
      const userRes = await api('/users/me');
      if (userRes.data) {
        currentUser = userRes.data;
        setUser(userRes.data);
      }
      render();
    });
    return;
  }

  // Then check password change
  if (currentUser.change_pass === true) {
    console.log('⚠️ Password change required for user:', currentUser.user_id);
    const html = renderMustChangePassword();
    document.getElementById('app').innerHTML = html;
    const form = document.getElementById('mustChangePasswordForm');
    const errEl = document.getElementById('mustChangeError');
    const newPwdInput = document.getElementById('mustChangeNew');
    const confirmPwdInput = document.getElementById('mustChangeConfirm');
    const toggleNewBtn = document.getElementById('toggleMustChangeNew');
    const toggleConfirmBtn = document.getElementById('toggleMustChangeConfirm');

    if (!form) {
      console.error('❌ Password change form not found');
      return;
    }

    // Real-time password validation display
    newPwdInput?.addEventListener('input', function() {
      const pwd = this.value;
      document.getElementById('req-length').style.opacity = pwd.length >= 8 ? '1' : '0.5';
      document.getElementById('req-lower').style.opacity = /[a-z]/.test(pwd) ? '1' : '0.5';
      document.getElementById('req-number').style.opacity = /\d/.test(pwd) ? '1' : '0.5';
      document.getElementById('req-special').style.opacity = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd) ? '1' : '0.5';
    });

    // Password visibility toggles
    toggleNewBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const type = newPwdInput.type === 'password' ? 'text' : 'password';
      newPwdInput.type = type;
      toggleNewBtn.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });
    toggleConfirmBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const type = confirmPwdInput.type === 'password' ? 'text' : 'password';
      confirmPwdInput.type = type;
      toggleConfirmBtn.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });

    form?.addEventListener('submit', async function(e) {
      e.preventDefault();
      console.log('✓ Password change form submitted');
      errEl.hidden = true;
      const newPassword = document.getElementById('mustChangeNew').value;
      const confirmPassword = document.getElementById('mustChangeConfirm').value;
      
      // Validate that passwords match
      if (newPassword !== confirmPassword) {
        console.log('⚠️ Passwords do not match');
        errEl.textContent = 'Passwords do not match.';
        errEl.hidden = false;
        return;
      }
      
      // Validate password strength
      const validation = validatePasswordStrength(newPassword);
      if (!validation.isValid) {
        console.log('⚠️ Password validation failed:', validation.errors);
        errEl.textContent = validation.errors[0];
        errEl.hidden = false;
        return;
      }
      
      console.log('✓ Sending password change request...');
      const r = await api('/users/me', { method: 'PATCH', body: { newPassword, forcePasswordChange: true } });
      console.log('✓ Password change response:', r);
      
      if (r.ok) {
        console.log('✓ Password changed successfully, fetching fresh user data...');
        // Get fresh user data with all fields including has_email
        const freshUser = await api('/users/me');
        console.log('✓ Fresh user data:', freshUser.data);
        
        if (freshUser.ok && freshUser.data) {
          currentUser = freshUser.data;
          currentUser.change_pass = !!currentUser.change_pass;
          currentUser.has_email = !!currentUser.has_email;
          setUser(currentUser);
          console.log('✓ Updated currentUser.change_pass to:', currentUser.change_pass);
          
          // Force clear the app div before re-rendering
          document.getElementById('app').innerHTML = '';
          
          console.log('✓ Re-rendering dashboard...');
          render();
        } else {
          console.error('❌ Failed to fetch fresh user data:', freshUser);
          errEl.textContent = 'Failed to load updated user data.';
          errEl.hidden = false;
        }
      } else {
        console.error('❌ Password change failed:', r);
        errEl.textContent = r.data?.error || 'Failed to update password.';
        errEl.hidden = false;
      }
    });
    return;
  }

  // Force email registration for students without email
  if (currentUser.role === 'Student' && !currentUser.has_email) {
    document.getElementById('app').innerHTML = renderMustRegisterEmail();
    const form = document.getElementById('forceEmailRegisterForm');
    const errEl = document.getElementById('forceEmailError');
    const emailInput = document.getElementById('forceRegEmailInput');
    const otpInput = document.getElementById('forceRegEmailOtpInput');
    const sendOtpBtn = document.getElementById('forceEmailSendOtpBtn');
    const verifyOtpBtn = document.getElementById('forceEmailVerifyOtpBtn');
    const otpSection = document.getElementById('forceEmailOtpSection');
    
    let otpTimer = null;
    
    // Send OTP
    sendOtpBtn?.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      errEl.hidden = true;
      
      if (!email) {
        errEl.textContent = 'Please enter your email address.';
        errEl.hidden = false;
        return;
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errEl.textContent = 'Please enter a valid email address.';
        errEl.hidden = false;
        return;
      }
      
      sendOtpBtn.disabled = true;
      const res = await api('/users/send-email-otp', { method: 'POST', body: { email } });
      sendOtpBtn.disabled = false;
      
      if (res.ok) {
        otpSection.style.display = 'block';
        emailInput.disabled = true;
        sendOtpBtn.style.display = 'none';
        verifyOtpBtn.style.display = 'block';
        
        // Start OTP timer (2 minutes)
        let timeLeft = 120;
        const timerEl = document.getElementById('forceEmailTestimonial');
        
        if (otpTimer) clearInterval(otpTimer);
        otpTimer = setInterval(() => {
          timeLeft--;
          if (timeLeft <= 0) {
            clearInterval(otpTimer);
            timerEl.textContent = 'Code expired. Request a new one.';
            verifyOtpBtn.disabled = true;
          } else {
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerEl.textContent = `Valid for ${mins}:${secs.toString().padStart(2, '0')}`;
          }
        }, 1000);
      } else {
        errEl.textContent = res.data?.error || 'Failed to send verification code.';
        errEl.hidden = false;
      }
    });
    
    // Verify OTP
    verifyOtpBtn?.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const otpCode = otpInput.value.trim();
      errEl.hidden = true;
      
      if (!otpCode) {
        errEl.textContent = 'Please enter the verification code.';
        errEl.hidden = false;
        return;
      }
      
      verifyOtpBtn.disabled = true;
      const res = await api('/users/verify-email-otp', { method: 'POST', body: { otp_code: otpCode, email } });
      verifyOtpBtn.disabled = false;
      
      if (res.ok) {
        // Email verified, fetch fresh user data and render dashboard
        const freshUser = await api('/users/me');
        if (freshUser.ok && freshUser.data) {
          currentUser = freshUser.data;
          currentUser.has_email = !!freshUser.data.has_email;
          setUser(currentUser);
          render();
        } else {
          errEl.textContent = 'Email verified but failed to load updated profile.';
          errEl.hidden = false;
        }
      } else {
        errEl.textContent = res.data?.error || 'Failed to verify email.';
        errEl.hidden = false;
      }
    });
    return;
  }

  const role = currentUser.role;
  const r = route();

  let classesList = [];
  if (role === 'Student' || role === 'Instructor') {
    const cr = await api('/classes');
    if (cr.data && Array.isArray(cr.data)) classesList = cr.data;
  }

  const sidebarHtml = renderSidebar(role, currentUser);
  let mainHtml = '';
  if (r === 'dashboard') mainHtml = await renderDashboardOverview(role);
  else if (r === 'announcements') mainHtml = await renderAnnouncements(role);
  else if (r === 'myclasses' && (role === 'Student' || role === 'Instructor')) mainHtml = await renderMyClasses(role);
  else if (r.startsWith('class-announcements/') && (role === 'Student' || role === 'Instructor')) mainHtml = await renderClassAnnouncements(role);
  else if (r === 'users' && role === 'Admin') mainHtml = await renderUsers();
  else if (r === 'classes' && (role === 'Admin' || role === 'Instructor')) mainHtml = await renderClasses(role);
  else if (r === 'sms-reports' && role === 'Admin') mainHtml = await renderSmsReports();
  else if (r === 'profile') mainHtml = renderProfile(currentUser);
  else mainHtml = await renderDashboardOverview(role);

  const gridClass = layoutClass(role, r);
  document.getElementById('app').innerHTML = `<div class="${gridClass}">${sidebarHtml}${mainHtml}</div>`;

  // post-render initialization
  if (r === 'users' && role === 'Admin') {
    await initUsersPage();
  }
  if (r === 'classes' && (role === 'Admin' || role === 'Instructor')) {
    initClassesPage();
  }
  if (r === 'announcements' || r.startsWith('class-announcements/')) {
    await initAnnouncementsPage();
  }
  if (r === 'sms-reports' && role === 'Admin') {
    initReportTabs();
  }

  // Profile form: change password
  if (r === 'profile') {
    // Profile picture upload
    const profilePictureInput = document.getElementById('profilePictureInput');
    const profileAvatarLarge = document.querySelector('.profile-avatar-large');
    
    profilePictureInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('profile', file);
      
      try {
        const res = await fetch('/api/users/me/profile-picture', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getToken()}` },
          body: formData
        });
        
        if (res.ok) {
          const userData = await res.json();
          currentUser = userData;
          setUser(userData);
          // Update avatar immediately
          const newUrl = userData.profile_path || '/uploads/default-profile.svg';
          if (profileAvatarLarge) {
            profileAvatarLarge.style.backgroundImage = `url('${newUrl}?t=${Date.now()}')`;
          }
        } else {
          const error = await res.json();
          alert('Failed to upload profile picture: ' + (error.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Error uploading profile picture: ' + err.message);
      }
    });
    
    // Profile picture upload button behavior
    const uploadBtn = document.querySelector('.profile-pic-upload-btn');
    uploadBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      profilePictureInput?.click();
    });

    const form = document.getElementById('changePasswordForm');
    const notice = document.getElementById('profileFormNotice');
    const toggleCurrentBtn = document.getElementById('toggleCurrentPassword');
    const toggleNewBtn = document.getElementById('toggleNewPassword');
    const currentPwdInput = document.getElementById('currentPassword');
    const newPwdInput = document.getElementById('newPassword');

    // Real-time password validation display
    newPwdInput?.addEventListener('input', function() {
      const pwd = this.value;
      document.getElementById('profile-req-length').style.opacity = pwd.length >= 8 ? '1' : '0.5';
      document.getElementById('profile-req-lower').style.opacity = /[a-z]/.test(pwd) ? '1' : '0.5';
      document.getElementById('profile-req-number').style.opacity = /\d/.test(pwd) ? '1' : '0.5';
      document.getElementById('profile-req-special').style.opacity = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd) ? '1' : '0.5';
    });

    // Password visibility toggles
    toggleCurrentBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const type = currentPwdInput.type === 'password' ? 'text' : 'password';
      currentPwdInput.type = type;
      toggleCurrentBtn.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });
    toggleNewBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const type = newPwdInput.type === 'password' ? 'text' : 'password';
      newPwdInput.type = type;
      toggleNewBtn.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (notice) { notice.hidden = true; notice.textContent = ''; }
      const currentPassword = document.getElementById('currentPassword')?.value || '';
      const newPassword = document.getElementById('newPassword')?.value || '';
      if (!currentPassword || !newPassword) {
        if (notice) { notice.textContent = 'Please fill both current and new password.'; notice.hidden = false; }
        return;
      }
      
      // Validate password strength
      const validation = validatePasswordStrength(newPassword);
      if (!validation.isValid) {
        if (notice) { notice.textContent = validation.errors[0]; notice.hidden = false; }
        return;
      }
      
      const res = await api('/users/me', { method: 'PATCH', body: { currentPassword, newPassword } });
      if (res.ok) {
        if (notice) { notice.textContent = 'Password updated successfully.'; notice.hidden = false; }
        setTimeout(() => { window.render(); }, 800);
      } else {
        if (notice) { notice.textContent = res.data?.error || 'Failed to update password.'; notice.hidden = false; }
      }
    });

    // Backup handlers (Admin only)
    const createBackupBtn = document.getElementById('createBackupBtn');
    const backupStatus = document.getElementById('backupStatus');
    const backupsList = document.getElementById('backupsList');

    // Load backups on page load
    if (currentUser.role === 'Admin') {
      await loadBackupsList();
    }

    async function loadBackupsList() {
      try {
        const res = await api('/backup/list');
        if (res.ok && res.data.backups) {
          const backups = res.data.backups;
          if (backups.length === 0) {
            backupsList.innerHTML = '<p style="margin: 0; color: #9ca3af; font-size: 0.85rem;">No backups found</p>';
          } else {
            backupsList.innerHTML = backups.map(backup => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #e5e7eb; font-size: 0.85rem;">
                <div>
                  <div style="font-weight: 500; color: #374151;">${backup.filename}</div>
                  <div style="color: #9ca3af; font-size: 0.8rem;">${backup.createdFormatted} • ${backup.sizeFormatted}</div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                  <button type="button" class="btn-sm btn-secondary restore-backup" data-filename="${backup.filename}" title="Restore">Restore</button>
                  <button type="button" class="btn-sm btn-danger delete-backup" data-filename="${backup.filename}" title="Delete">Delete</button>
                </div>
              </div>
            `).join('');

            // Add event listeners for restore and delete buttons
            document.querySelectorAll('.restore-backup').forEach(btn => {
              btn.addEventListener('click', async (e) => {
                const filename = e.target.dataset.filename;
                
                // Show password confirmation modal
                const overlay = document.createElement('div');
                overlay.className = 'modal-overlay';
                overlay.innerHTML = `
                  <div class="modal" style="max-width: 500px;">
                    <div class="modal-header">
                      <h2 class="modal-title">Confirm Database Restore</h2>
                      <button type="button" class="modal-close" id="restoreModalClose">×</button>
                    </div>
                    <div class="modal-body">
                      <div style="padding: 1rem; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 1.5rem;">
                        <p style="margin: 0; font-weight: 500; color: #92400e;">⚠️ Warning</p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; color: #b45309;">This will restore your database from <strong>${filename}</strong>. Your current database will be automatically backed up first.</p>
                      </div>
                      <p style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #475569;">Enter your password to confirm:</p>
                      <input type="password" id="restorePasswordInput" class="login-input" placeholder="Enter your admin password" style="width: 100%; margin-bottom: 0.5rem;">
                      <p id="restoreError" style="color: #ef4444; font-size: 0.85rem; margin: 0.5rem 0; display: none;"></p>
                      <p id="restoreStatus" style="color: #6b7280; font-size: 0.85rem; margin: 0.5rem 0; display: none;"></p>
                      <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
                        <button type="button" id="restoreCancelBtn" class="btn-secondary" style="flex: 1;">Cancel</button>
                        <button type="button" id="restoreConfirmBtn" class="btn-danger" style="flex: 1;">Restore Database</button>
                      </div>
                    </div>
                  </div>`;
                
                document.body.appendChild(overlay);

                const closeModal = () => overlay.remove();
                document.getElementById('restoreModalClose').addEventListener('click', closeModal);
                document.getElementById('restoreCancelBtn').addEventListener('click', closeModal);

                const passwordInput = document.getElementById('restorePasswordInput');
                const confirmBtn = document.getElementById('restoreConfirmBtn');
                const errorEl = document.getElementById('restoreError');
                const statusEl = document.getElementById('restoreStatus');

                confirmBtn.addEventListener('click', async () => {
                  const password = passwordInput.value;
                  if (!password) {
                    errorEl.textContent = 'Please enter your password';
                    errorEl.style.display = 'block';
                    return;
                  }

                  confirmBtn.disabled = true;
                  confirmBtn.textContent = 'Restoring...';
                  errorEl.style.display = 'none';
                  statusEl.textContent = 'Creating safety backup...';
                  statusEl.style.display = 'block';

                  const res = await api('/backup/restore', { 
                    method: 'POST', 
                    body: { filename, password } 
                  });

                  if (res.ok) {
                    statusEl.textContent = '✓ Database restored successfully! Safety backup: ' + res.data.autoBackup.filename;
                    statusEl.style.color = '#10b981';
                    setTimeout(() => {
                      closeModal();
                      alert('Database restored successfully!');
                      loadBackupsList();
                    }, 2000);
                  } else {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Restore Database';
                    errorEl.textContent = res.data?.message || res.data?.error || 'Failed to restore backup';
                    errorEl.style.display = 'block';
                    statusEl.style.display = 'none';
                  }
                });

                passwordInput.focus();
              });
            });

            document.querySelectorAll('.delete-backup').forEach(btn => {
              btn.addEventListener('click', async (e) => {
                const filename = e.target.dataset.filename;
                if (confirm(`Delete backup ${filename}?`)) {
                  e.target.disabled = true;
                  e.target.textContent = 'Deleting...';
                  const res = await api(`/backup/${filename}`, { method: 'DELETE' });
                  if (res.ok) {
                    await loadBackupsList();
                  } else {
                    alert('Failed to delete backup: ' + (res.data?.error || 'Unknown error'));
                  }
                  e.target.disabled = false;
                  e.target.textContent = 'Delete';
                }
              });
            });
          }
        }
      } catch (error) {
        backupsList.innerHTML = '<p style="margin: 0; color: #ef4444; font-size: 0.85rem;">Failed to load backups</p>';
      }
    }

    if (createBackupBtn) {
      createBackupBtn.addEventListener('click', async () => {
        createBackupBtn.disabled = true;
        createBackupBtn.textContent = 'Creating backup...';
        backupStatus.style.display = 'block';
        backupStatus.textContent = 'Creating backup...';
        backupStatus.style.color = '#6b7280';

        const res = await api('/backup/create', { method: 'POST' });
        
        if (res.ok) {
          backupStatus.textContent = `✓ Backup created: ${res.data.filename}`;
          backupStatus.style.color = '#10b981';
          createBackupBtn.textContent = 'Create Backup';
          createBackupBtn.disabled = false;
          await loadBackupsList();
        } else {
          backupStatus.textContent = `✗ Failed: ${res.data?.error || 'Unknown error'}`;
          backupStatus.style.color = '#ef4444';
          createBackupBtn.textContent = 'Create Backup';
          createBackupBtn.disabled = false;
        }
      });
    }
    // Phone edit handlers with OTP
    const editBtn = document.getElementById('editPhoneBtn');
    const sendOtpBtn = document.getElementById('sendPhoneOtpBtn');
    const verifyOtpBtn = document.getElementById('verifyPhoneOtpBtn');
    const cancelBtn = document.getElementById('cancelPhoneBtn');
    const cancelOtpBtn = document.getElementById('cancelOtpBtn');
    const phoneEditRow = document.getElementById('phoneEditRow');
    const phoneOtpRow = document.getElementById('phoneOtpRow');
    const phoneDisplay = document.getElementById('phoneDisplay');
    const phoneInput = document.getElementById('profilePhoneInput');
    const phoneOtpInput = document.getElementById('phoneOtpInput');
    const phoneNotice = document.getElementById('profilePhoneNotice');
    const otpTimer = document.getElementById('otpTimer');
    let otpTimeRemaining = 0;
    let otpTimerInterval = null;

    function updateOtpTimer() {
      if (otpTimeRemaining > 0) {
        const mins = Math.floor(otpTimeRemaining / 60);
        const secs = otpTimeRemaining % 60;
        otpTimer.textContent = `Expires in ${mins}:${String(secs).padStart(2, '0')}`;
        otpTimeRemaining--;
      } else {
        clearInterval(otpTimerInterval);
        otpTimer.textContent = 'OTP expired';
      }
    }

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (phoneEditRow) phoneEditRow.style.display = 'block';
        if (editBtn) editBtn.style.display = 'none';
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (phoneEditRow) phoneEditRow.style.display = 'none';
        if (editBtn) editBtn.style.display = 'inline-block';
        if (phoneNotice) phoneNotice.hidden = true;
        if (phoneInput) phoneInput.value = phoneDisplay?.textContent === '—' ? '' : phoneDisplay?.textContent;
      });
    }

    if (sendOtpBtn) {
      sendOtpBtn.addEventListener('click', async () => {
        const newPhone = phoneInput ? phoneInput.value.trim() : '';
        if (!newPhone) {
          if (phoneNotice) { phoneNotice.textContent = 'Please enter a phone number.'; phoneNotice.hidden = false; }
          return;
        }
        const res = await api('/users/send-phone-otp', { method: 'POST', body: { phone_num: newPhone } });
        if (res.ok) {
          otpTimeRemaining = res.data.expiresIn || 120;
          clearInterval(otpTimerInterval);
          otpTimerInterval = setInterval(updateOtpTimer, 1000);
          updateOtpTimer();
          if (phoneEditRow) phoneEditRow.style.display = 'none';
          if (phoneOtpRow) phoneOtpRow.style.display = 'block';
          if (phoneNotice) { phoneNotice.textContent = `OTP sent to ${newPhone}`; phoneNotice.hidden = false; phoneNotice.style.color = '#10b981'; }
        } else {
          if (phoneNotice) { phoneNotice.textContent = res.data?.error || 'Failed to send OTP.'; phoneNotice.hidden = false; phoneNotice.style.color = '#ef4444'; }
        }
      });
    }

    if (cancelOtpBtn) {
      cancelOtpBtn.addEventListener('click', () => {
        clearInterval(otpTimerInterval);
        if (phoneOtpRow) phoneOtpRow.style.display = 'none';
        if (phoneEditRow) phoneEditRow.style.display = 'block';
        if (phoneOtpInput) phoneOtpInput.value = '';
        if (phoneNotice) phoneNotice.hidden = true;
      });
    }

    if (verifyOtpBtn) {
      verifyOtpBtn.addEventListener('click', async () => {
        const otpCode = phoneOtpInput ? phoneOtpInput.value.trim() : '';
        const phone = phoneInput ? phoneInput.value.trim() : '';
        if (!otpCode || otpCode.length !== 6 || isNaN(otpCode)) {
          if (phoneNotice) { phoneNotice.textContent = 'Please enter a valid 6-digit OTP.'; phoneNotice.hidden = false; phoneNotice.style.color = '#ef4444'; }
          return;
        }
        verifyOtpBtn.disabled = true;
        const res = await api('/users/verify-phone-otp', { method: 'POST', body: { otp_code: otpCode, phone_num: phone } });
        verifyOtpBtn.disabled = false;
        if (res.ok) {
          clearInterval(otpTimerInterval);
          currentUser.phone_num = res.data.phone_num;
          setUser(currentUser);
          if (phoneDisplay) phoneDisplay.textContent = res.data.phone_num;
          if (phoneOtpRow) phoneOtpRow.style.display = 'none';
          if (phoneEditRow) phoneEditRow.style.display = 'none';
          if (editBtn) editBtn.style.display = 'inline-block';
          if (phoneOtpInput) phoneOtpInput.value = '';
          if (phoneNotice) { phoneNotice.textContent = 'Phone number verified and updated!'; phoneNotice.hidden = false; phoneNotice.style.color = '#10b981'; }
        } else {
          if (phoneNotice) { phoneNotice.textContent = res.data?.error || 'Failed to verify OTP.'; phoneNotice.hidden = false; phoneNotice.style.color = '#ef4444'; }
        }
      });
    }
  }

  // Student phone prompt
  if (role === 'Student' && !(currentUser.phone_num && currentUser.phone_num.trim()) && !sessionStorage.getItem('phonePromptSkipped')) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'phoneCollectOverlay';
    let studentOtpTimeRemaining = 0;
    let studentOtpInterval = null;

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Phone number (optional)</h2>
          <button type="button" class="modal-close" id="phoneCollectClose">×</button>
        </div>
        <div class="modal-body">
          <p class="profile-card-subtitle">Add your phone number to receive SMS notifications from the school. You can skip if you don't have one.</p>
          
          <div id="studentPhoneInputSection">
            <label class="login-label">Phone number</label>
            <input type="text" id="phoneCollectInput" class="login-input" placeholder="09xxxxxxxxx" maxlength="15">
            <p id="phoneCollectNotice" class="login-error" style="margin-top:0.5rem;" hidden></p>
            <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
              <button type="button" class="btn-primary" id="phoneCollectSkip">Skip</button>
              <button type="button" class="btn-primary" id="phoneCollectSendOtp">Send OTP</button>
            </div>
          </div>

          <div id="studentPhoneOtpSection" style="display:none;">
            <p style="font-size:0.9rem;color:#666;margin-bottom:0.5rem;" id="sentToPhone"></p>
            <label class="login-label">Enter OTP (6 digits)</label>
            <input type="text" id="phoneCollectOtp" class="login-input" placeholder="000000" maxlength="6">
            <p id="phoneCollectOtpNotice" class="login-error" style="margin-top:0.5rem;" hidden></p>
            <p id="phoneCollectOtpTimer" style="font-size:0.85rem;color:#666;margin-top:0.5rem;"></p>
            <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
              <button type="button" class="btn-primary" id="phoneCollectCancelOtp">Cancel</button>
              <button type="button" class="btn-primary" id="phoneCollectVerifyOtp">Verify OTP</button>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const skipBtn = document.getElementById('phoneCollectSkip');
    const sendOtpBtn = document.getElementById('phoneCollectSendOtp');
    const verifyOtpBtn = document.getElementById('phoneCollectVerifyOtp');
    const cancelOtpBtn = document.getElementById('phoneCollectCancelOtp');
    const closeBtn = document.getElementById('phoneCollectClose');
    const phoneInput = document.getElementById('phoneCollectInput');
    const otpInput = document.getElementById('phoneCollectOtp');
    const notice = document.getElementById('phoneCollectNotice');
    const otpNotice = document.getElementById('phoneCollectOtpNotice');
    const otpTimer = document.getElementById('phoneCollectOtpTimer');
    const sentToPhone = document.getElementById('sentToPhone');
    const inputSection = document.getElementById('studentPhoneInputSection');
    const otpSection = document.getElementById('studentPhoneOtpSection');

    function updateStudentOtpTimer() {
      if (studentOtpTimeRemaining > 0) {
        const mins = Math.floor(studentOtpTimeRemaining / 60);
        const secs = studentOtpTimeRemaining % 60;
        otpTimer.textContent = `Expires in ${mins}:${String(secs).padStart(2, '0')}`;
        studentOtpTimeRemaining--;
      } else {
        clearInterval(studentOtpInterval);
        otpTimer.textContent = 'OTP expired';
      }
    }

    const closeModal = () => {
      clearInterval(studentOtpInterval);
      overlay.remove();
      sessionStorage.setItem('phonePromptSkipped', '1');
    };

    skipBtn?.addEventListener('click', closeModal);
    closeBtn?.addEventListener('click', closeModal);

    sendOtpBtn?.addEventListener('click', async () => {
      const newPhone = phoneInput?.value.trim() || '';
      if (!newPhone) {
        if (notice) { notice.textContent = 'Please enter a phone number.'; notice.hidden = false; }
        return;
      }
      const res = await api('/users/send-phone-otp', { method: 'POST', body: { phone_num: newPhone } });
      if (res.ok) {
        studentOtpTimeRemaining = res.data.expiresIn || 600;
        clearInterval(studentOtpInterval);
        studentOtpInterval = setInterval(updateStudentOtpTimer, 1000);
        updateStudentOtpTimer();
        if (inputSection) inputSection.style.display = 'none';
        if (otpSection) otpSection.style.display = 'block';
        if (sentToPhone) sentToPhone.textContent = `OTP sent to ${newPhone}`;
        if (otpNotice) otpNotice.hidden = true;
      } else {
        if (notice) { notice.textContent = res.data?.error || 'Failed to send OTP.'; notice.hidden = false; }
      }
    });

    cancelOtpBtn?.addEventListener('click', () => {
      clearInterval(studentOtpInterval);
      if (otpSection) otpSection.style.display = 'none';
      if (inputSection) inputSection.style.display = 'block';
      if (otpInput) otpInput.value = '';
      if (otpNotice) otpNotice.hidden = true;
    });

    verifyOtpBtn?.addEventListener('click', async () => {
      const otpCode = otpInput?.value.trim() || '';
      if (!otpCode || otpCode.length !== 6 || isNaN(otpCode)) {
        if (otpNotice) { otpNotice.textContent = 'Please enter a valid 6-digit OTP.'; otpNotice.hidden = false; }
        return;
      }
      verifyOtpBtn.disabled = true;
      const res = await api('/users/verify-phone-otp', { method: 'POST', body: { otp_code: otpCode } });
      verifyOtpBtn.disabled = false;
      if (res.ok) {
        currentUser.phone_num = res.data.phone_num;
        setUser(currentUser);
        clearInterval(studentOtpInterval);
        closeModal();
        window.render();
      } else {
        if (otpNotice) { otpNotice.textContent = res.data?.error || 'Failed to verify OTP.'; otpNotice.hidden = false; }
      }
    });
  }

  // Email edit handlers with OTP
  const editEmailBtn = document.getElementById('editEmailBtn');
  const sendEmailOtpBtn = document.getElementById('sendEmailOtpBtn');
  const verifyEmailOtpBtn = document.getElementById('verifyEmailOtpBtn');
  const cancelEmailBtn = document.getElementById('cancelEmailBtn');
  const cancelEmailOtpBtn = document.getElementById('cancelEmailOtpBtn');
  const emailEditRow = document.getElementById('emailEditRow');
  const emailOtpRow = document.getElementById('emailOtpRow');
  const emailDisplay = document.getElementById('emailDisplay');
  const emailInput = document.getElementById('profileEmailInput');
  const emailOtpInput = document.getElementById('emailOtpInput');
  const emailNotice = document.getElementById('profileEmailNotice');
  const emailOtpTimer = document.getElementById('emailOtpTimer');
  let emailOtpTimeRemaining = 0;
  let emailOtpTimerInterval = null;

  function updateEmailOtpTimer() {
    if (emailOtpTimeRemaining > 0) {
      const mins = Math.floor(emailOtpTimeRemaining / 60);
      const secs = emailOtpTimeRemaining % 60;
      emailOtpTimer.textContent = `Expires in ${mins}:${String(secs).padStart(2, '0')}`;
      emailOtpTimeRemaining--;
    } else {
      clearInterval(emailOtpTimerInterval);
      emailOtpTimer.textContent = 'OTP expired';
    }
  }

  if (editEmailBtn) {
    editEmailBtn.addEventListener('click', () => {
      if (emailEditRow) emailEditRow.style.display = 'block';
      if (editEmailBtn) editEmailBtn.style.display = 'none';
    });
  }

  if (cancelEmailBtn) {
    cancelEmailBtn.addEventListener('click', () => {
      if (emailEditRow) emailEditRow.style.display = 'none';
      if (editEmailBtn) editEmailBtn.style.display = 'inline-block';
      if (emailNotice) emailNotice.hidden = true;
      if (emailInput) emailInput.value = emailDisplay?.textContent === '—' ? '' : emailDisplay?.textContent;
    });
  }

  if (sendEmailOtpBtn) {
    sendEmailOtpBtn.addEventListener('click', async () => {
      const newEmail = emailInput ? emailInput.value.trim() : '';
      if (!newEmail) {
        if (emailNotice) { emailNotice.textContent = 'Please enter an email address.'; emailNotice.hidden = false; }
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        if (emailNotice) { emailNotice.textContent = 'Please enter a valid email address.'; emailNotice.hidden = false; }
        return;
      }
      const res = await api('/users/send-email-otp', { method: 'POST', body: { email: newEmail } });
      if (res.ok) {
        emailOtpTimeRemaining = res.data.expiresIn || 120;
        clearInterval(emailOtpTimerInterval);
        emailOtpTimerInterval = setInterval(updateEmailOtpTimer, 1000);
        updateEmailOtpTimer();
        if (emailEditRow) emailEditRow.style.display = 'none';
        if (emailOtpRow) emailOtpRow.style.display = 'block';
        if (emailNotice) { emailNotice.textContent = `OTP sent to ${newEmail}`; emailNotice.hidden = false; emailNotice.style.color = '#10b981'; }
      } else {
        if (emailNotice) { emailNotice.textContent = res.data?.error || 'Failed to send OTP.'; emailNotice.hidden = false; emailNotice.style.color = '#ef4444'; }
      }
    });
  }

  if (cancelEmailOtpBtn) {
    cancelEmailOtpBtn.addEventListener('click', () => {
      clearInterval(emailOtpTimerInterval);
      if (emailOtpRow) emailOtpRow.style.display = 'none';
      if (emailEditRow) emailEditRow.style.display = 'block';
      if (emailOtpInput) emailOtpInput.value = '';
      if (emailNotice) emailNotice.hidden = true;
    });
  }

  if (verifyEmailOtpBtn) {
    verifyEmailOtpBtn.addEventListener('click', async () => {
      const otpCode = emailOtpInput ? emailOtpInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      if (!otpCode || otpCode.length !== 6 || isNaN(otpCode)) {
        if (emailNotice) { emailNotice.textContent = 'Please enter a valid 6-digit OTP.'; emailNotice.hidden = false; emailNotice.style.color = '#ef4444'; }
        return;
      }
      verifyEmailOtpBtn.disabled = true;
      const res = await api('/users/verify-email-otp', { method: 'POST', body: { otp_code: otpCode, email: email } });
      verifyEmailOtpBtn.disabled = false;
      if (res.ok) {
        clearInterval(emailOtpTimerInterval);
        currentUser.email = res.data.email;
        setUser(currentUser);
        if (emailDisplay) emailDisplay.textContent = res.data.email;
        if (emailOtpRow) emailOtpRow.style.display = 'none';
        if (emailEditRow) emailEditRow.style.display = 'none';
        if (editEmailBtn) editEmailBtn.style.display = 'inline-block';
        if (emailOtpInput) emailOtpInput.value = '';
        if (emailNotice) { emailNotice.textContent = 'Email address verified and updated!'; emailNotice.hidden = false; emailNotice.style.color = '#10b981'; }
      } else {
        if (emailNotice) { emailNotice.textContent = res.data?.error || 'Failed to verify OTP.'; emailNotice.hidden = false; emailNotice.style.color = '#ef4444'; }
      }
    });
  }

  // Nav link handlers
  document.querySelectorAll('.nav-link[data-route]').forEach(el => {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.hash = this.getAttribute('data-route');
    });
  });

  // Logout handler
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      clearToken();
      window.location.href = 'login.html';
    });
  }
}

// expose for other modules
window.render = render;
window.addEventListener('hashchange', render);
window.addEventListener('load', render);
