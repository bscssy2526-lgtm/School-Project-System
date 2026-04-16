// Batch Upload Preview Page
// This page shows a full preview of all entries before submitting

import { escapeHtml } from './dashboard-utils.js';

let batchFile = null;
let previewData = null;

async function init() {
  // Get file from sessionStorage
  const fileData = sessionStorage.getItem('batchUploadFile');
  
  if (!fileData) {
    showError('No file selected. Going back...');
    setTimeout(() => window.location.href = 'dashboard-users.html', 2000);
    return;
  }

  try {
    // Reconstruct File object from base64
    const [fileName, fileContent] = fileData.split('|');
    const binaryString = atob(fileContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    batchFile = new File([bytes], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Load preview
    await loadFullPreview();
  } catch (err) {
    console.error('Error reconstructing file:', err);
    showError('Failed to load preview data: ' + err.message);
  }
}

async function loadFullPreview() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('preview-content').style.display = 'none';

  try {
    const formData = new FormData();
    formData.append('file', batchFile);
    formData.append('page', 'all');

    const response = await fetch(API_BASE + '/users/batch/preview', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() },
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      showError(result.error || 'Failed to load preview');
      return;
    }

    previewData = result;
    console.log('Preview response:', result); // Debug
    renderPreview(result);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('preview-content').style.display = 'block';
  } catch (err) {
    console.error('Error loading preview:', err);
    showError('Error: ' + err.message);
  }
}

function renderPreview(result) {
  const { preview = [], summary = {} } = result;
  
  // Fallback values in case summary is missing
  const stats = {
    valid: summary.valid || 0,
    warning: summary.warning || 0,
    error: summary.error || 0
  };
  
  // Update stats
  document.getElementById('stat-valid').textContent = stats.valid;
  document.getElementById('stat-warning').textContent = stats.warning;
  document.getElementById('stat-error').textContent = stats.error;
  document.getElementById('stat-total').textContent = preview.length;

  // Show warning if needed
  if (stats.warning > 0 || stats.error > 0) {
    document.getElementById('warning-banner').hidden = false;
  }

  // Update submit button state
  const submitBtn = document.getElementById('submit-btn');
  const canSubmit = stats.valid > 0 && stats.error === 0;
  submitBtn.disabled = !canSubmit;
  if (!canSubmit) {
    if (stats.error > 0) {
      submitBtn.textContent = '❌ Fix errors to submit';
    } else {
      submitBtn.textContent = '⚠️  Warnings present (will skip)';
    }
  }

  // Render table
  const tbody = document.getElementById('preview-body');
  tbody.innerHTML = preview.map(row => {
    let statusIcon = '';
    let statusClass = '';
    if (row.status === 'valid') {
      statusIcon = '✅';
      statusClass = 'status-valid';
    } else if (row.status === 'warning') {
      statusIcon = '⚠️';
      statusClass = 'status-warning';
    } else if (row.status === 'error') {
      statusIcon = '❌';
      statusClass = 'status-error';
    }
    
    return `
      <tr class="${statusClass}">
        <td class="status-icon">${statusIcon}</td>
        <td class="status-message">${escapeHtml(row.statusMessage)}</td>
        <td>${escapeHtml(row.f_name)}</td>
        <td>${escapeHtml(row.m_name)}</td>
        <td>${escapeHtml(row.l_name)}</td>
        <td><strong>${escapeHtml(row.student_id)}</strong></td>
        <td>${escapeHtml(row.birthday)}</td>
        <td>${escapeHtml(row.department)}</td>
        <td>${escapeHtml(row.year_level)}</td>
      </tr>
    `;
  }).join('');
}

async function submitUpload() {
  if (!batchFile) {
    showError('No file selected');
    return;
  }

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Uploading...';

  try {
    const formData = new FormData();
    formData.append('file', batchFile);

    const response = await fetch(API_BASE + '/users/batch/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() },
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      showError(result.error || 'Upload failed');
      submitBtn.disabled = false;
      submitBtn.textContent = '💾 Submit Upload';
      return;
    }

    // Show success message
    let successMsg = `✅ Upload completed!\n\n`;
    successMsg += `📝 Results:\n`;
    successMsg += `  • ${result.successful} student${result.successful !== 1 ? 's' : ''} created successfully\n`;
    
    if (result.skipped > 0) {
      successMsg += `  • ${result.skipped} skipped (warnings)\n`;
    }
    
    if (result.failed > 0) {
      successMsg += `  • ${result.failed} failed (errors)\n`;
    }

    showSuccess(successMsg);

    // Clear session and redirect
    sessionStorage.removeItem('batchUploadFile');
    setTimeout(() => {
      window.location.href = 'dashboard-users.html';
    }, 2500);
  } catch (err) {
    console.error('Upload error:', err);
    showError('Error: ' + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Submit Upload';
  }
}

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.hidden = false;
  document.getElementById('success-message').hidden = true;
}

function showSuccess(message) {
  const successDiv = document.getElementById('success-message');
  successDiv.textContent = message;
  successDiv.hidden = false;
  document.getElementById('error-message').hidden = true;
}

function goBack() {
  sessionStorage.removeItem('batchUploadFile');
  window.location.href = 'dashboard-users.html';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
