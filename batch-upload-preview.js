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

    const response = await fetch(API_BASE + '/users/batch/preview?page=all', {
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
  
  // Store stats for use in submitUpload
  window.batchStats = stats;
  
  // Update stats
  document.getElementById('stat-valid').textContent = stats.valid;
  document.getElementById('stat-warning').textContent = stats.warning;
  document.getElementById('stat-error').textContent = stats.error;
  document.getElementById('stat-total').textContent = preview.length;

  // Show warning if needed
  if (stats.warning > 0 || stats.error > 0) {
    document.getElementById('warning-banner').hidden = false;
  }

  // Update submit button state - enable if there are valid entries
  const submitBtn = document.getElementById('submit-btn');
  const hasValidEntries = stats.valid > 0;
  submitBtn.disabled = !hasValidEntries;
  
  if (hasValidEntries) {
    if (stats.error > 0) {
      submitBtn.textContent = '⚠️  Submit (errors will be skipped)';
    } else if (stats.warning > 0) {
      submitBtn.textContent = '💾 Submit Upload (warnings will be skipped)';
    } else {
      submitBtn.textContent = '✅ Submit Upload';
    }
  } else {
    submitBtn.textContent = '❌ No valid entries to submit';
  }
  console.log('Button state:', { hasValidEntries, valid: stats.valid, error: stats.error, disabled: submitBtn.disabled }); // Debug

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
  console.log('Rendered', preview.length, 'rows in table'); // Debug
}

async function submitUpload() {
  if (!batchFile) {
    showError('No file selected');
    return;
  }

  // Check if there are errors and ask for confirmation
  if (window.batchStats && window.batchStats.error > 0) {
    const confirmMsg = `You have ${window.batchStats.error} entry(ies) with errors and ${window.batchStats.warning} with warnings.\n\nThese entries will NOT be imported.\n\nOnly the ${window.batchStats.valid} valid entry(ies) will be saved.\n\nDo you want to continue?`;
    document.getElementById('confirm-message').textContent = confirmMsg;
    document.getElementById('confirm-modal').hidden = false;
    return; // Wait for user to confirm
  }

  // If no errors, proceed directly
  performUpload();
}

async function proceedWithSubmit() {
  document.getElementById('confirm-modal').hidden = true;
  performUpload();
}

function cancelConfirm() {
  document.getElementById('confirm-modal').hidden = true;
}

async function performUpload() {
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

async function submitUploadHandler() {
  await submitUpload();
}

// Expose functions to global scope for onclick handlers
window.goBack = goBack;
window.submitUpload = submitUploadHandler;
window.proceedWithSubmit = proceedWithSubmit;
window.cancelConfirm = cancelConfirm;

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
