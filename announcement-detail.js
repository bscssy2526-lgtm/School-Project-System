/**
 * Announcement Detail Page
 * Full-page view for announcements with better space for discussion
 */

// Helper function to escape HTML (from dashboard-utils.js)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Get announcement ID from URL query params
function getAnnouncementId() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id || isNaN(parseInt(id, 10))) {
    showError('Invalid announcement ID');
    return null;
  }
  return parseInt(id, 10);
}

// Check authentication
async function checkAuth() {
  const user = getUser();
  if (!user) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Load announcement data
async function loadAnnouncement(id) {
  try {
    const res = await api(`/announcements/${id}`);
    if (!res.ok) {
      showError(res.data?.error || 'Failed to load announcement');
      return null;
    }
    return res.data;
  } catch (err) {
    console.error('Error loading announcement:', err);
    showError('Failed to load announcement');
    return null;
  }
}

// Render announcement content
function renderAnnouncement(ann) {
  const container = document.getElementById('announcement-content');
  const currentUser = getUser();

  // Render announcement header
  const authorName = escapeHtml(ann.author_name || 'Unknown');
  const authorRole = escapeHtml(ann.author_role || '');
  const datePosted = ann.date_posted ? new Date(ann.date_posted).toLocaleString() : '';
  const avatarUrl = ann.author_profile_path || '/uploads/default-profile.svg';
  
  const header = document.createElement('div');
  header.className = 'announcement-header';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'flex-start';
  header.style.gap = '1rem';

  // Left section: title and author info
  const leftSection = document.createElement('div');
  leftSection.style.flex = '1';
  
  const title = document.createElement('h1');
  title.className = 'announcement-title';
  title.textContent = escapeHtml(ann.title || '');
  title.style.marginTop = '0';
  leftSection.appendChild(title);
  
  const metaDiv = document.createElement('div');
  metaDiv.className = 'announcement-meta';
  metaDiv.style.display = 'flex';
  metaDiv.style.alignItems = 'center';
  metaDiv.style.gap = '0.75rem';
  metaDiv.style.marginTop = '0.5rem';
  
  const avatar = document.createElement('div');
  avatar.className = 'announcement-avatar';
  avatar.style.backgroundImage = `url('${avatarUrl}')`;
  metaDiv.appendChild(avatar);
  
  const info = document.createElement('div');
  info.className = 'announcement-info';
  info.innerHTML = `
    <span class="announcement-author">${authorName}</span>
    <span class="announcement-meta-text">${authorRole} • ${datePosted}</span>
  `;
  metaDiv.appendChild(info);
  leftSection.appendChild(metaDiv);
  
  header.appendChild(leftSection);
  
  // Right section: target audience for admin
  if (currentUser && currentUser.role === 'Admin') {
    const rightSection = document.createElement('div');
    rightSection.style.fontSize = '0.85rem';
    rightSection.style.color = '#6b7280';
    rightSection.style.textAlign = 'right';
    rightSection.style.whiteSpace = 'nowrap';
    rightSection.style.paddingTop = '2.5rem';
    
    let targetText = 'School-wide';
    let icon = '📢';
    
    if (ann.class_id && ann.class_name) {
      targetText = `Class: ${escapeHtml(ann.class_name)}`;
      icon = '🎓';
    } else if (ann.target_department && ann.target_year_level) {
      targetText = `${ann.target_department} - ${ann.target_year_level} Year`;
      icon = '👥';
    } else if (ann.target_department) {
      targetText = `Department: ${ann.target_department}`;
      icon = '🏢';
    } else if (ann.target_year_level) {
      targetText = `${ann.target_year_level} Year Students`;
      icon = '📚';
    }
    
    rightSection.innerHTML = `${icon} <strong>Sent to:</strong> ${targetText}`;
    header.appendChild(rightSection);
  }

  // Render announcement body
  const body = document.createElement('div');
  body.className = 'announcement-body';
  body.innerHTML = renderMarkdown(ann.content || '');

  // Action buttons for author/admin
  let actionButtons = '';
  const isAuthor = currentUser && (currentUser.user_id === ann.author_id || currentUser.role === 'Admin');
  if (isAuthor) {
    actionButtons = `
      <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
        <button onclick="editAnnouncement(${ann.announcement_id})" class="comment-submit-btn">
          Edit Announcement
        </button>
        <button onclick="deleteAnnouncement(${ann.announcement_id})" 
                style="background: #ef4444;" 
                onmouseover="this.style.background='#dc2626'" 
                onmouseout="this.style.background='#ef4444'"
                class="comment-submit-btn">
          Delete Announcement
        </button>
      </div>
    `;
  }

  container.innerHTML = '';
  container.appendChild(header);
  container.appendChild(body);
  if (actionButtons) {
    const actions = document.createElement('div');
    actions.innerHTML = actionButtons;
    container.appendChild(actions);
  }

  // Store announcement ID for later use
  window.currentAnnouncementId = ann.announcement_id;
}

// Render attachments
function renderAttachments(ann) {
  if (!ann.attachments || ann.attachments.length === 0) {
    document.getElementById('attachments-section').style.display = 'none';
    return;
  }

  const section = document.getElementById('attachments-section');
  const list = document.getElementById('attachments-list');
  list.innerHTML = '';

  ann.attachments.forEach(att => {
    const filePath = att.file_path ? `/${att.file_path}` : '#';
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.filename);
    const icon = getFileIcon(att.filename);

    const item = document.createElement('a');
    item.href = filePath;
    item.download = att.filename || '';
    item.className = 'attachment-item';

    if (isImage) {
      item.innerHTML = `
        <img src="${filePath}" alt="${escapeHtml(att.filename)}" class="attachment-image">
        <span class="attachment-name">${escapeHtml(att.filename)}</span>
      `;
    } else {
      item.innerHTML = `
        <div class="attachment-icon">${icon}</div>
        <span class="attachment-name">${escapeHtml(att.filename)}</span>
      `;
    }

    list.appendChild(item);
  });

  section.style.display = 'block';
}

// Render comments
async function renderComments(ann) {
  const list = document.getElementById('comments-list');
  const currentUser = getUser();

  if (!ann.comments || ann.comments.length === 0) {
    list.innerHTML = '<div class="comments-empty">No comments yet. Be the first!</div>';
    setupCommentForm(ann.announcement_id, currentUser);
    return;
  }

  list.innerHTML = '';
  ann.comments.forEach(comment => {
    const commentDate = comment.comment_date ? new Date(comment.comment_date).toLocaleString() : '';
    const userName = escapeHtml(comment.user_name || 'Unknown');
    const avatarUrl = comment.user_profile_path || '/uploads/default-profile.svg';
    const commentText = escapeHtml(comment.comment_text || '');

    const item = document.createElement('div');
    item.className = 'comment-item';
    item.id = `comment-${comment.comment_id}`;

    let deleteBtn = '';
    if (currentUser && (currentUser.user_id === comment.user_id || currentUser.role === 'Admin')) {
      deleteBtn = `
        <button class="comment-delete-btn" onclick="deleteComment(${ann.announcement_id}, ${comment.comment_id})">
          ✕
        </button>
      `;
    }

    item.innerHTML = `
      <div class="comment-avatar" style="background-image: url('${avatarUrl}')"></div>
      <div class="comment-body">
        <div class="comment-header">
          <div>
            <span class="comment-author">${userName}</span>
            <span class="comment-date">${commentDate}</span>
          </div>
          <div class="comment-actions">
            ${deleteBtn}
          </div>
        </div>
        <div class="comment-text">${commentText}</div>
      </div>
    `;

    list.appendChild(item);
  });

  setupCommentForm(ann.announcement_id, currentUser);
}

// Add comment handler
async function setupCommentForm(announcementId, currentUser) {
  const form = document.getElementById('add-comment-form');

  if (!currentUser) {
    form.style.display = 'none';
    return;
  }

  // Remove previous listeners by cloning and replacing
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const textarea = document.getElementById('comment-input');
    const text = textarea.value.trim();
    if (!text) return;

    const errorDiv = document.getElementById('comment-error');
    const loadingDiv = document.getElementById('comment-loading');

    errorDiv.style.display = 'none';
    loadingDiv.style.display = 'block';

    try {
      const res = await api(`/announcements/${announcementId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_text: text })
      });

      if (!res.ok) {
        throw new Error(res.data?.error || 'Failed to post comment');
      }

      textarea.value = '';
      loadingDiv.style.display = 'none';

      // Reload announcement to get new comment
      const ann = await loadAnnouncement(announcementId);
      if (ann) {
        await renderComments(ann);
      }
    } catch (err) {
      console.error('Error posting comment:', err);
      errorDiv.textContent = err.message || 'Failed to post comment';
      errorDiv.style.display = 'block';
      loadingDiv.style.display = 'none';
    }
  });
}

// Helper: Show confirmation modal
function showConfirmModal(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.5)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10001';

  const modal = document.createElement('div');
  modal.style.background = 'white';
  modal.style.borderRadius = '8px';
  modal.style.padding = '2rem';
  modal.style.width = 'min(400px, 90%)';
  modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';

  const text = document.createElement('p');
  text.textContent = message;
  text.style.margin = '0 0 1.5rem 0';
  text.style.fontSize = '1rem';
  text.style.color = '#333';

  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '0.75rem';
  buttonContainer.style.justifyContent = 'flex-end';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.background = '#f3f4f6';
  cancelBtn.style.color = '#374151';
  cancelBtn.style.border = '1px solid #d1d5db';
  cancelBtn.style.padding = '0.625rem 1.25rem';
  cancelBtn.style.borderRadius = '6px';
  cancelBtn.style.fontWeight = '600';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.style.transition = 'all 0.2s ease';
  cancelBtn.addEventListener('click', () => overlay.remove());
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = '#e5e7eb';
  });
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = '#f3f4f6';
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Delete';
  confirmBtn.style.background = '#ef4444';
  confirmBtn.style.color = 'white';
  confirmBtn.style.border = 'none';
  confirmBtn.style.padding = '0.625rem 1.25rem';
  confirmBtn.style.borderRadius = '6px';
  confirmBtn.style.fontWeight = '600';
  confirmBtn.style.cursor = 'pointer';
  confirmBtn.style.transition = 'all 0.2s ease';
  confirmBtn.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
  confirmBtn.addEventListener('mouseenter', () => {
    confirmBtn.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
  });
  confirmBtn.addEventListener('mouseleave', () => {
    confirmBtn.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
  });
  confirmBtn.addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });

  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(confirmBtn);

  modal.appendChild(text);
  modal.appendChild(buttonContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// Delete comment handler (global function for inline onclick)
window.deleteComment = async function(announcementId, commentId) {
  showConfirmModal('Delete this comment?', async () => {
    const errorDiv = document.getElementById('comment-error');
    errorDiv.style.display = 'none';

    try {
      const res = await api(`/announcements/${announcementId}/comments/${commentId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        errorDiv.textContent = res.data?.error || 'Failed to delete comment';
        errorDiv.style.display = 'block';
        return;
      }

      const element = document.getElementById(`comment-${commentId}`);
      if (element) {
        element.remove();
      }

      // Check if no more comments
      const list = document.getElementById('comments-list');
      if (list.querySelectorAll('.comment-item').length === 0) {
        list.innerHTML = '<div class="comments-empty">No comments yet. Be the first to comment!</div>';
      }

      // Show success message
      errorDiv.textContent = 'Comment deleted successfully';
      errorDiv.style.color = '#10b981';
      errorDiv.style.display = 'block';
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        errorDiv.style.display = 'none';
        errorDiv.style.color = '#ef4444';
        errorDiv.textContent = '';
      }, 3000);
    } catch (err) {
      console.error('Error deleting comment:', err);
      errorDiv.textContent = 'An error occurred while deleting the comment';
      errorDiv.style.display = 'block';
    }
  });
};

// Edit announcement (global function for inline onclick)
window.editAnnouncement = async function(id) {
  const ann = await loadAnnouncement(id);
  if (!ann) return;
  showEditModal(ann);
};

// Show edit modal (full-featured with file attachments)
function showEditModal(ann) {
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
  titleInput.value = ann.title || '';
  titleInput.required = true;
  titleInput.style.marginBottom = '1rem';

  const contentLabel = document.createElement('label');
  contentLabel.className = 'login-label';
  contentLabel.textContent = 'Content';
  
  const contentInput = document.createElement('textarea');
  contentInput.className = 'login-input';
  contentInput.value = ann.content || '';
  contentInput.required = true;
  contentInput.rows = '6';
  contentInput.style.marginBottom = '1rem';

  // Existing attachments section
  const existingAttachments = ann.attachments || [];
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
      const response = await fetch(`/api/announcements/${ann.announcement_id}`, {
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
      // Reload announcement to show updates
      const updated = await loadAnnouncement(ann.announcement_id);
      if (updated) {
        renderAnnouncement(updated);
        renderAttachments(updated);
      }
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

// Delete announcement (global function for inline onclick)
window.deleteAnnouncement = async function(id) {
  showConfirmModal('Delete this announcement? This action cannot be undone.', async () => {
    const errorDiv = document.getElementById('comment-error');
    errorDiv.style.display = 'none';

    try {
      const res = await api(`/announcements/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        errorDiv.textContent = res.data?.error || 'Failed to delete announcement';
        errorDiv.style.color = '#ef4444';
        errorDiv.style.display = 'block';
        return;
      }

      errorDiv.textContent = 'Announcement deleted successfully. Redirecting...';
      errorDiv.style.color = '#10b981';
      errorDiv.style.display = 'block';
      
      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
    } catch (err) {
      console.error('Error deleting announcement:', err);
      errorDiv.textContent = 'An error occurred while deleting the announcement';
      errorDiv.style.color = '#ef4444';
      errorDiv.style.display = 'block';
    }
  });
};

// Helper: Get file icon based on extension
function getFileIcon(filename) {
  if (!filename) return '📄';
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    ppt: '🎯',
    pptx: '🎯',
    txt: '📄',
    zip: '📦',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️'
  };
  return icons[ext] || '📎';
}

// Helper: Render markdown (from dashboard-announcements.js)
function renderMarkdown(markdown) {
  if (!markdown) return '';
  try {
    // Check if marked exists (loaded from CDN)
    if (typeof marked !== 'undefined') {
      const html = marked.parse(markdown);
      // Basic HTML sanitization without external library
      return sanitizeHtml(html);
    } else {
      // Fallback if marked not available
      return escapeHtml(markdown);
    }
  } catch (err) {
    console.error('Markdown rendering error:', err);
    return escapeHtml(markdown);
  }
}

// Note: Since we can't import DOMPurify easily, we'll use escapeHtml for safety
function sanitizeHtml(html) {
  // Basic HTML sanitization - remove dangerous content
  const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                       'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'hr'];
  
  // Use a temporary container div instead of creating a full document
  const container = document.createElement('div');
  container.innerHTML = html;
  
  // Remove script tags and potentially dangerous attributes
  const scripts = container.querySelectorAll('script, iframe, style, link, meta, object, embed');
  scripts.forEach(el => el.remove());
  
  // Process all elements and collect those to unwrap
  const allElements = Array.from(container.querySelectorAll('*'));
  
  // Process elements in reverse order to avoid node list mutation issues
  for (let i = allElements.length - 1; i >= 0; i--) {
    const el = allElements[i];
    
    // Only keep allowed tags - unwrap disallowed ones (keep content)
    if (!allowedTags.includes(el.tagName.toLowerCase())) {
      // Get all child nodes and insert them before the element
      while (el.firstChild) {
        el.parentNode.insertBefore(el.firstChild, el);
      }
      el.parentNode.removeChild(el);
      continue;
    }
    
    // Remove event handlers and dangerous attributes
    const attrsToRemove = [];
    for (let attr of el.attributes) {
      if (attr.name.startsWith('on') || 
          ['javascript:', 'data:'].some(prefix => attr.value.includes(prefix))) {
        attrsToRemove.push(attr.name);
      }
    }
    attrsToRemove.forEach(name => el.removeAttribute(name));
    
    // Only allow safe links
    if (el.tagName === 'A') {
      if (!el.href.startsWith('http') && !el.href.startsWith('mailto:') && !el.href.startsWith('#')) {
        el.removeAttribute('href');
      }
    }
  }
  
  return container.innerHTML;
}

// Show error message
function showError(message) {
  const container = document.getElementById('announcement-content');
  if (container) {
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #dc2626;">
        <p style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Error</p>
        <p style="color: #991b1b;">${escapeHtml(message)}</p>
        <button class="comment-submit-btn" onclick="history.back()" style="margin-top: 1rem;">
          Go Back
        </button>
      </div>
    `;
  }
}

// Initialize page
async function init() {
  // Check authentication
  if (!(await checkAuth())) return;

  // Get announcement ID from URL
  const id = getAnnouncementId();
  if (!id) return;

  // Load announcement
  const ann = await loadAnnouncement(id);
  if (!ann) return;

  // Render announcement
  renderAnnouncement(ann);
  renderAttachments(ann);

  // Render comments
  const currentUser = getUser();
  await renderComments(ann);
}

// Run on page load
document.addEventListener('DOMContentLoaded', init);
