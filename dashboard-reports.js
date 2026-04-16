import { api, escapeHtml } from './dashboard-utils.js';

// Store data globally for filter access
window.smsReportData = null;
window.emailReportData = null;

// Helper functions
const formatDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const statusBadge = (status) => {
  const colors = {
    'Sent': '#10b981',
    'Failed': '#ef4444',
    'Pending': '#f59e0b',
    'PartiallyFailed': '#f59e0b'
  };
  return `<span style="background:${colors[status] || '#6b7280'};color:white;padding:0.25rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;font-weight:500;">${status}</span>`;
};

// Filter helper
const filterLogs = (logs, filters) => {
  return logs.filter(log => {
    if (filters.startDate && new Date(log.date_sent) < new Date(filters.startDate)) return false;
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      if (new Date(log.date_sent) > endDate) return false;
    }
    if (filters.department && log.department !== filters.department) return false;
    if (filters.year_level && log.year_level !== filters.year_level) return false;
    return true;
  });
};

// Build summary view: group by announcement, count recipients
const buildSmsSummary = (logs) => {
  if (!logs.length) return '<div class="notice">No SMS records found.</div>';
  
  const grouped = {};
  logs.forEach(log => {
    const key = log.announcement_id;
    if (!grouped[key]) {
      grouped[key] = {
        title: log.announcement_title,
        date: log.date_sent,
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0
      };
    }
    grouped[key].total++;
    if (log.status === 'Sent') grouped[key].sent++;
    else if (log.status === 'Failed') grouped[key].failed++;
    else if (log.status === 'Pending') grouped[key].pending++;
  });
  
  return `<div class="data-table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th>Announcement</th>
          <th>Date Sent</th>
          <th>Total Recipients</th>
          <th>Sent</th>
          <th>Failed</th>
          <th>Pending</th>
        </tr>
      </thead>
      <tbody>
        ${Object.values(grouped).map(ann => `
          <tr>
            <td style="max-width:250px;">${escapeHtml(ann.title)}</td>
            <td>${formatDate(ann.date)}</td>
            <td><strong>${ann.total}</strong></td>
            <td style="color:#10b981;"><strong>${ann.sent}</strong></td>
            <td style="color:#ef4444;"><strong>${ann.failed}</strong></td>
            <td style="color:#f59e0b;"><strong>${ann.pending}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
};

const buildSmsDetailed = (logs) => {
  if (!logs.length) return '<div class="notice">No SMS records found.</div>';
  
  return `<div class="data-table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Announcement</th>
          <th>Recipient</th>
          <th>Phone</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(log => `
          <tr>
            <td>${formatDate(log.date_sent)}</td>
            <td style="max-width:200px;">
              <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(log.announcement_title)}">
                ${escapeHtml(log.announcement_title)}
              </div>
            </td>
            <td>
              <div>${escapeHtml(log.recipient_name)}</div>
              <div style="font-size:0.8rem;color:#666;">${escapeHtml(log.recipient_role)}${log.department ? ` • ${escapeHtml(log.department)}` : ''}</div>
            </td>
            <td>${escapeHtml(log.phone_num_masked || '—')}</td>
            <td>${statusBadge(log.status)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
};

const buildEmailSummary = (logs) => {
  if (!logs.length) return '<div class="notice">No email records found.</div>';
  
  const grouped = {};
  logs.forEach(log => {
    const key = log.announcement_id;
    if (!grouped[key]) {
      grouped[key] = {
        title: log.announcement_title,
        date: log.date_sent,
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0
      };
    }
    grouped[key].total++;
    if (log.status === 'Sent') grouped[key].sent++;
    else if (log.status === 'Failed') grouped[key].failed++;
    else if (log.status === 'Pending') grouped[key].pending++;
  });
  
  return `<div class="data-table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th>Announcement</th>
          <th>Date Sent</th>
          <th>Total Recipients</th>
          <th>Sent</th>
          <th>Failed</th>
          <th>Pending</th>
        </tr>
      </thead>
      <tbody>
        ${Object.values(grouped).map(ann => `
          <tr>
            <td style="max-width:250px;">${escapeHtml(ann.title)}</td>
            <td>${formatDate(ann.date)}</td>
            <td><strong>${ann.total}</strong></td>
            <td style="color:#10b981;"><strong>${ann.sent}</strong></td>
            <td style="color:#ef4444;"><strong>${ann.failed}</strong></td>
            <td style="color:#f59e0b;"><strong>${ann.pending}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
};

const buildEmailDetailed = (logs) => {
  if (!logs.length) return '<div class="notice">No email records found.</div>';
  
  return `<div class="data-table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Announcement</th>
          <th>Recipient</th>
          <th>Email</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(log => `
          <tr>
            <td>${formatDate(log.date_sent)}</td>
            <td style="max-width:200px;">
              <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(log.announcement_title)}">
                ${escapeHtml(log.announcement_title)}
              </div>
            </td>
            <td>
              <div>${escapeHtml(log.recipient_name)}</div>
              <div style="font-size:0.8rem;color:#666;">${escapeHtml(log.recipient_role)}${log.department ? ` • ${escapeHtml(log.department)}` : ''}</div>
            </td>
            <td>${escapeHtml(log.email_masked || '—')}</td>
            <td>${statusBadge(log.status)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
};

// Main render function
export async function renderSmsReports() {
  const smsRes = await api('/announcements/sms-reports');
  const emailRes = await api('/announcements/email-reports');
  
  if (!smsRes.ok && !emailRes.ok) {
    return `<main class="main-content single-col"><div class="notice error">Failed to load reports</div></main>`;
  }

  const smsData = smsRes.ok ? smsRes.data : { logs: [], stats: { total_sent: 0, successful: 0, failed: 0, pending: 0 } };
  const emailData = emailRes.ok ? emailRes.data : { logs: [], stats: { total_sent: 0, successful: 0, failed: 0, pending: 0 } };

  // Store raw data for filtering
  window.reportData = { sms: smsData, email: emailData };
  window.smsReportData = smsData;
  window.emailReportData = emailData;

  const smsStatsCards = `<div style="display:flex; gap:0.75rem; flex-wrap:wrap; font-size:0.85rem; color:#6b7280; margin-left:1rem;">
    <span>📊 <strong style="color:#10b981;">${smsData.stats.successful || 0}</strong> Sent</span>
    <span>❌ <strong style="color:#ef4444;">${smsData.stats.failed || 0}</strong> Failed</span>
    <span>⏳ <strong style="color:#f59e0b;">${smsData.stats.pending || 0}</strong> Pending</span>
  </div>`;

  const emailStatsCards = `<div style="display:flex; gap:0.75rem; flex-wrap:wrap; font-size:0.85rem; color:#6b7280; margin-left:1rem;">
    <span>📧 <strong style="color:#10b981;">${emailData.stats.successful || 0}</strong> Sent</span>
    <span>❌ <strong style="color:#ef4444;">${emailData.stats.failed || 0}</strong> Failed</span>
    <span>⏳ <strong style="color:#f59e0b;">${emailData.stats.pending || 0}</strong> Pending</span>
  </div>`;

  const smsSummary = buildSmsSummary(smsData.logs);
  const smsDetailedTable = buildSmsDetailed(smsData.logs);
  const emailSummary = buildEmailSummary(emailData.logs);
  const emailDetailedTable = buildEmailDetailed(emailData.logs);

  return `
    <style>
      @media print {
        .no-print { display: none; }
        body { background: white; }
        .main-content { width: 100%; margin: 0; padding: 1rem; }
        .stats-grid { page-break-inside: avoid; }
        .data-table-container { page-break-inside: avoid; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
        .data-table th { background: #f3f4f6; font-weight: bold; }
        button { display: none; }
      }
      .filter-panel { background:#f9fafb; border:1px solid #e5e7eb; border-radius:0.5rem; padding:0.75rem 1rem; margin-bottom:1rem; }
      .filter-group { display:inline-block; margin-right:1rem; margin-bottom:0.5rem; vertical-align:top; }
      .filter-label { display:block; font-size:0.75rem; font-weight:500; color:#6b7280; margin-bottom:0.2rem; text-transform:uppercase; letter-spacing:0.03em; }
      .filter-input { padding:0.375rem 0.5rem; border:1px solid #d1d5db; border-radius:0.375rem; font-size:0.85rem; width:130px; }
      .filter-input select { width:130px; }
      .filter-btn { padding:0.375rem 0.75rem; background:#4b5563; color:white; border:none; border-radius:0.375rem; cursor:pointer; font-weight:500; transition:background 0.2s; font-size:0.85rem; }
      .filter-btn:hover { background:#3a4250; }
      .filter-count { display:inline-block; background:#3b82f6; color:white; padding:0.2rem 0.5rem; border-radius:0.25rem; font-size:0.7rem; margin-left:0.35rem; }
      .view-toggle-btn { padding:0.4rem 0.85rem; border:1px solid #d1d5db; background:white; border-radius:0.375rem; cursor:pointer; font-weight:500; font-size:0.9rem; transition:all 0.15s; }
      .view-toggle-btn.active { color:#3b82f6; border-color:#3b82f6; }
      .export-excel-btn { padding:0.4rem 0.85rem; background:#10b981; color:white; border:none; border-radius:0.375rem; cursor:pointer; font-size:0.85rem; font-weight:500; transition:background 0.2s; }
      .export-excel-btn:hover { background:#059669; }
    </style>
    <main class="main-content">
      <div class="page-header" style="margin-bottom:1rem; padding:0.5rem 0;">
        <h1 class="page-title" style="font-size:1.5rem; margin:0;">Delivery Reports</h1>
        <div style="display:flex; gap:0.5rem;">
          <button class="export-excel-btn no-print" data-type="sms">📊 Export SMS</button>
          <button class="export-excel-btn no-print" data-type="email">📊 Export Email</button>
        </div>
      </div>
      
      <div class="card" style="margin-bottom:1.5rem;">
        <div style="display:flex; border-bottom:2px solid #e5e7eb; margin-bottom:1rem; gap:0;" class="report-tabs-container">
          <button class="report-tab-btn active no-print" data-tab="sms" style="padding:0.6rem 1.2rem; border:none; background:none; font-size:0.95rem; font-weight:500; color:#3b82f6; cursor:pointer; border-bottom:3px solid #3b82f6; margin-bottom:-2px;">SMS</button>
          <button class="report-tab-btn no-print" data-tab="email" style="padding:0.6rem 1.2rem; border:none; background:none; font-size:0.95rem; font-weight:500; color:#6b7280; cursor:pointer;">Email</button>
        </div>
        
        <!-- SMS Tab -->
        <div id="sms-tab-content">
          <div style="display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 0.75rem; margin-bottom: 1.5rem; padding: 1rem; background: #f9f9f9; border-radius: 0.5rem; align-items: center;" class="no-print">
            <div class="form-field" style="margin: 0;">
              <label class="login-label" style="font-size: 0.85rem;">Start Date</label>
              <input type="date" class="login-input sms-date-filter" id="sms-start-date" style="font-size: 0.9rem;">
            </div>
            <div class="form-field" style="margin: 0;">
              <label class="login-label" style="font-size: 0.85rem;">End Date</label>
              <input type="date" class="login-input sms-date-filter" id="sms-end-date" style="font-size: 0.9rem;">
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <span style="font-size:0.75rem; color:#6b7280; font-weight:500;">View:</span>
              <button class="view-toggle-btn active" data-view="summary">Summary</button>
              <button class="view-toggle-btn" data-view="detailed">Detailed</button>
            </div>
            <button class="btn-primary" id="sms-clear-filters">Reset</button>
          </div>
          <div id="sms-summary-view">
            <div class="card">
              <h2 style="margin-bottom:1rem;">SMS Summary</h2>
              ${smsSummary}
            </div>
          </div>
          <div id="sms-detailed-view" style="display:none;">
            <div class="card">
              <h2 style="margin-bottom:1rem;">SMS Log</h2>
              ${smsDetailedTable}
            </div>
          </div>
        </div>
        
        <!-- Email Tab -->
        <div id="email-tab-content" style="display:none;">
          <div style="display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 0.75rem; margin-bottom: 1.5rem; padding: 1rem; background: #f9f9f9; border-radius: 0.5rem; align-items: center;" class="no-print">
            <div class="form-field" style="margin: 0;">
              <label class="login-label" style="font-size: 0.85rem;">Start Date</label>
              <input type="date" class="login-input email-date-filter" id="email-start-date" style="font-size: 0.9rem;">
            </div>
            <div class="form-field" style="margin: 0;">
              <label class="login-label" style="font-size: 0.85rem;">End Date</label>
              <input type="date" class="login-input email-date-filter" id="email-end-date" style="font-size: 0.9rem;">
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <span style="font-size:0.75rem; color:#6b7280; font-weight:500;">View:</span>
              <button class="view-toggle-btn active" data-view="summary">Summary</button>
              <button class="view-toggle-btn" data-view="detailed">Detailed</button>
            </div>
            <button class="btn-primary" id="email-clear-filters">Reset</button>
          </div>
          <div id="email-summary-view">
            <div class="card">
              <h2 style="margin-bottom:1rem;">Email Summary</h2>
              ${emailSummary}
            </div>
          </div>
          <div id="email-detailed-view" style="display:none;">
            <div class="card">
              <h2 style="margin-bottom:1rem;">Email Log</h2>
              ${emailDetailedTable}
            </div>
          </div>
        </div>
      </div>
    </main>`;
}

// Initialize report tabs and event handlers
export function initReportTabs() {
  // Tab switching
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('report-tab-btn')) {
      const tab = e.target.dataset.tab;
      document.querySelectorAll('.report-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.color = '#6b7280';
        b.style.borderBottom = 'none';
        b.style.marginBottom = '0';
      });
      e.target.classList.add('active');
      e.target.style.color = '#3b82f6';
      e.target.style.borderBottom = '3px solid #3b82f6';
      e.target.style.marginBottom = '-2px';
      
      document.querySelectorAll('[id$="-tab-content"]').forEach(el => el.style.display = 'none');
      document.getElementById(tab + '-tab-content').style.display = 'block';
    }

    // View toggle (Summary/Detailed)
    if (e.target.classList.contains('view-toggle-btn')) {
      const view = e.target.dataset.view;
      const container = e.target.closest('[id$="-tab-content"]');
      const summaryView = container.querySelector('[id$="-summary-view"]');
      const detailedView = container.querySelector('[id$="-detailed-view"]');
      
      container.querySelectorAll('.view-toggle-btn').forEach(b => {
        b.classList.remove('active');
        b.style.color = '#6b7280';
        b.style.borderColor = '#d1d5db';
      });
      e.target.classList.add('active');
      e.target.style.color = '#3b82f6';
      e.target.style.borderColor = '#3b82f6';
      
      if (view === 'summary') {
        summaryView.style.display = 'block';
        detailedView.style.display = 'none';
      } else {
        summaryView.style.display = 'none';
        detailedView.style.display = 'block';
      }
    }

    // Excel export
    if (e.target.classList.contains('export-excel-btn')) {
      const type = e.target.dataset.type;
      const container = document.getElementById(type + '-tab-content');
      const summaryView = container.querySelector('[id$="-summary-view"]');
      const isDetailedVisible = !summaryView.style.display || summaryView.style.display !== 'none' ? false : true;
      
      if (type === 'sms') {
        isDetailedVisible ? exportSmsDetailedToExcel() : exportSmsSummaryToExcel();
      } else {
        isDetailedVisible ? exportEmailDetailedToExcel() : exportEmailSummaryToExcel();
      }
    }

    // Filters
    if (e.target.id && (e.target.id.endsWith('-clear-filters'))) {
      const prefix = e.target.id.split('-')[0];
      document.querySelectorAll(`#${prefix}-tab-content input, #${prefix}-tab-content select`).forEach(el => {
        if (el.type === 'date') el.value = '';
        else if (el.tagName === 'SELECT') el.value = '';
      });
      applyFilters(prefix);
    }

    // Apply filters on input change
    if (e.target.classList.contains('sms-date-filter') || e.target.classList.contains('sms-other-filter') || 
        e.target.classList.contains('email-date-filter') || e.target.classList.contains('email-other-filter')) {
      const prefix = e.target.closest('[id$="-tab-content"]').id.split('-')[0];
      applyFilters(prefix);
    }
  });
}

// Filter application logic
function applyFilters(prefix) {
  const data = prefix === 'sms' ? window.smsReportData : window.emailReportData;
  if (!data) return;
  
  const startDate = document.querySelector(`#${prefix}-start-date`)?.value || '';
  const endDate = document.querySelector(`#${prefix}-end-date`)?.value || '';
  
  let filtered = [...data.logs];
  
  if (startDate) {
    filtered = filtered.filter(log => new Date(log.date_sent) >= new Date(startDate));
  }
  if (endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59);
    filtered = filtered.filter(log => new Date(log.date_sent) <= endOfDay);
  }
  
  const summaryView = document.querySelector(`#${prefix}-summary-view`);
  const detailedView = document.querySelector(`#${prefix}-detailed-view`);
  
  // Check which view is currently visible
  const isSummaryVisible = summaryView.style.display !== 'none';
  
  if (prefix === 'sms') {
    const summaryContainer = summaryView.querySelector('.data-table-container');
    if (summaryContainer) summaryContainer.outerHTML = buildSmsSummaryHTML(filtered);
    
    const detailedContainer = detailedView.querySelector('.data-table-container');
    if (detailedContainer) detailedContainer.outerHTML = buildSmsDetailedHTML(filtered);
  } else {
    const summaryContainer = summaryView.querySelector('.data-table-container');
    if (summaryContainer) summaryContainer.outerHTML = buildEmailSummaryHTML(filtered);
    
    const detailedContainer = detailedView.querySelector('.data-table-container');
    if (detailedContainer) detailedContainer.outerHTML = buildEmailDetailedHTML(filtered);
  }
  
  // Keep the current view visible
  summaryView.style.display = isSummaryVisible ? 'block' : 'none';
  detailedView.style.display = isSummaryVisible ? 'none' : 'block';
}

function buildSmsSummaryHTML(logs) {
  if (!logs.length) return '<div class="notice">No SMS records found.</div>';
  const grouped = {};
  logs.forEach(log => {
    const key = log.announcement_id;
    if (!grouped[key]) {
      grouped[key] = {
        title: log.announcement_title,
        date: log.date_sent,
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0
      };
    }
    grouped[key].total++;
    if (log.status === 'Sent') grouped[key].sent++;
    else if (log.status === 'Failed') grouped[key].failed++;
    else if (log.status === 'Pending') grouped[key].pending++;
  });
  return `<div class="data-table-container">${buildTableHTML(Object.values(grouped), ['title', 'date', 'total', 'sent', 'failed', 'pending'])}</div>`;
}

function buildSmsDetailedHTML(logs) {
  if (!logs.length) return '<div class="notice">No SMS records found.</div>';
  return `<div class="data-table-container">${buildLogTableHTML(logs, ['date_sent', 'announcement_title', 'recipient_name', 'phone_num_masked', 'status'], ['Date', 'Announcement', 'Recipient', 'Phone', 'Status'])}</div>`;
}

function buildEmailSummaryHTML(logs) {
  if (!logs.length) return '<div class="notice">No email records found.</div>';
  const grouped = {};
  logs.forEach(log => {
    const key = log.announcement_id;
    if (!grouped[key]) {
      grouped[key] = {
        title: log.announcement_title,
        date: log.date_sent,
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0
      };
    }
    grouped[key].total++;
    if (log.status === 'Sent') grouped[key].sent++;
    else if (log.status === 'Failed') grouped[key].failed++;
    else if (log.status === 'Pending') grouped[key].pending++;
  });
  return `<div class="data-table-container">${buildTableHTML(Object.values(grouped), ['title', 'date', 'total', 'sent', 'failed', 'pending'])}</div>`;
}

function buildEmailDetailedHTML(logs) {
  if (!logs.length) return '<div class="notice">No email records found.</div>';
  return `<div class="data-table-container">${buildLogTableHTML(logs, ['date_sent', 'announcement_title', 'recipient_name', 'email_masked', 'status'], ['Date', 'Announcement', 'Recipient', 'Email', 'Status'])}</div>`;
}

function buildTableHTML(data, columns) {
  const headers = {
    'title': 'Announcement',
    'date': 'Date Sent',
    'total': 'Total Recipients',
    'sent': 'Sent',
    'failed': 'Failed',
    'pending': 'Pending'
  };
  
  return `<table class="data-table">
    <thead><tr>${columns.map(col => `<th>${headers[col] || col}</th>`).join('')}</tr></thead>
    <tbody>${data.map(row => `<tr>${columns.map(col => {
      const val = row[col];
      if (col === 'title') return `<td style="max-width:250px;">${escapeHtml(val)}</td>`;
      if (col === 'date') return `<td>${formatDate(val)}</td>`;
      if (col === 'sent') return `<td style="color:#10b981;"><strong>${val}</strong></td>`;
      if (col === 'failed') return `<td style="color:#ef4444;"><strong>${val}</strong></td>`;
      if (col === 'pending') return `<td style="color:#f59e0b;"><strong>${val}</strong></td>`;
      return `<td><strong>${val}</strong></td>`;
    }).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function buildLogTableHTML(logs, columns, headers) {
  return `<table class="data-table">
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${logs.map(log => `<tr>${columns.map(col => {
      const val = log[col];
      if (col === 'date_sent') return `<td>${formatDate(val)}</td>`;
      if (col === 'announcement_title') return `<td style="max-width:200px;"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(val)}">${escapeHtml(val)}</div></td>`;
      if (col === 'recipient_name') return `<td><div>${escapeHtml(val)}</div><div style="font-size:0.8rem;color:#666;">${escapeHtml(log.recipient_role)}${log.department ? ` • ${escapeHtml(log.department)}` : ''}</div></td>`;
      if (col === 'phone_num_masked' || col === 'email_masked') return `<td>${escapeHtml(val || '—')}</td>`;
      if (col === 'status') return `<td>${statusBadge(val)}</td>`;
      return `<td>${escapeHtml(val || '—')}</td>`;
    }).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function exportSmsSummaryToExcel() {
  const data = window.smsReportData?.logs || [];
  const grouped = {};
  data.forEach(log => {
    const key = log.announcement_id;
    if (!grouped[key]) {
      grouped[key] = { title: log.announcement_title, date: log.date_sent, total: 0, sent: 0, failed: 0, pending: 0 };
    }
    grouped[key].total++;
    if (log.status === 'Sent') grouped[key].sent++;
    else if (log.status === 'Failed') grouped[key].failed++;
    else if (log.status === 'Pending') grouped[key].pending++;
  });
  
  const rows = Object.values(grouped).map(ann => ({
    'Announcement': ann.title,
    'Date Sent': formatDate(ann.date),
    'Total Recipients': ann.total,
    'Sent': ann.sent,
    'Failed': ann.failed,
    'Pending': ann.pending
  }));
  
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SMS Summary');
  XLSX.writeFile(wb, `SMS_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportSmsDetailedToExcel() {
  const data = window.smsReportData?.logs || [];
  const rows = data.map(log => ({
    'Date': formatDate(log.date_sent),
    'Announcement': log.announcement_title,
    'Recipient': log.recipient_name,
    'Phone': log.phone_num_masked || '—',
    'Status': log.status,
    'Department': log.department || '—',
    'Year Level': log.year_level || '—'
  }));
  
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SMS Detailed');
  XLSX.writeFile(wb, `SMS_Detailed_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportEmailSummaryToExcel() {
  const data = window.emailReportData?.logs || [];
  const grouped = {};
  data.forEach(log => {
    const key = log.announcement_id;
    if (!grouped[key]) {
      grouped[key] = { title: log.announcement_title, date: log.date_sent, total: 0, sent: 0, failed: 0, pending: 0 };
    }
    grouped[key].total++;
    if (log.status === 'Sent') grouped[key].sent++;
    else if (log.status === 'Failed') grouped[key].failed++;
    else if (log.status === 'Pending') grouped[key].pending++;
  });
  
  const rows = Object.values(grouped).map(ann => ({
    'Announcement': ann.title,
    'Date Sent': formatDate(ann.date),
    'Total Recipients': ann.total,
    'Sent': ann.sent,
    'Failed': ann.failed,
    'Pending': ann.pending
  }));
  
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Email Summary');
  XLSX.writeFile(wb, `Email_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportEmailDetailedToExcel() {
  const data = window.emailReportData?.logs || [];
  const rows = data.map(log => ({
    'Date': formatDate(log.date_sent),
    'Announcement': log.announcement_title,
    'Recipient': log.recipient_name,
    'Email': log.email_masked || '—',
    'Status': log.status,
    'Department': log.department || '—',
    'Year Level': log.year_level || '—'
  }));
  
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Email Detailed');
  XLSX.writeFile(wb, `Email_Detailed_${new Date().toISOString().split('T')[0]}.xlsx`);
}
