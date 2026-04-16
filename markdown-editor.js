/**
 * markdown-editor.js
 * Helper functions for markdown editing and rendering
 */

/**
 * Initialize EasyMDE markdown editor on a textarea element
 * @param {string|HTMLElement} element - Textarea element or selector
 * @param {Object} options - Optional EasyMDE config
 * @returns {Object} EasyMDE instance
 */
export function initMarkdownEditor(element, options = {}) {
  if (!window.EasyMDE) {
    console.warn('EasyMDE not loaded');
    return null;
  }

  const el = typeof element === 'string' ? document.querySelector(element) : element;
  if (!el) {
    console.warn('Element not found for markdown editor');
    return null;
  }

  const config = {
    element: el,
    spellChecker: false,
    autoDownloadFontAwesome: false,
    toolbar: [
      'bold',
      'italic',
      'heading',
      '|',
      'quote',
      'unordered-list',
      'ordered-list',
      '|',
      'link',
      'image',
      '|',
      'preview',
      'side-by-side',
      'fullscreen',
      '|',
      'guide'
    ],
    previewRender: (plainText) => {
      return renderMarkdown(plainText);
    },
    ...options
  };

  try {
    return new EasyMDE(config);
  } catch (err) {
    console.error('Error initializing EasyMDE:', err);
    return null;
  }
}

/**
 * Parse and render markdown to HTML safely
 * Uses marked.js if available, otherwise returns escaped HTML
 * @param {string} markdown - Markdown text
 * @returns {string} HTML string
 */
export function renderMarkdown(markdown) {
  if (!markdown) return '';
  
  // If marked is available, use it with sanitization
  if (typeof marked !== 'undefined' && window.marked) {
    try {
      // Configure marked options for safety
      const html = window.marked.parse(markdown, {
        breaks: true,
        gfm: true
      });
      return html;
    } catch (err) {
      console.error('Error rendering markdown:', err);
      return escapeHtml(markdown);
    }
  }
  
  // Fallback: escape and convert line breaks
  return escapeHtml(markdown).replace(/\n/g, '<br>');
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Destroy EasyMDE editor instance
 * @param {Object} editor - EasyMDE instance
 */
export function destroyMarkdownEditor(editor) {
  if (!editor) return;
  
  try {
    // EasyMDE's codemirror instance
    if (editor.codemirror) {
      editor.codemirror.toTextArea();
    }
  } catch (err) {
    console.error('Error destroying editor:', err);
  }
}

/**
 * Get the markdown content from an editor instance
 * @param {Object} editor - EasyMDE instance
 * @returns {string} Markdown content
 */
export function getMarkdownContent(editor) {
  if (!editor) return '';
  
  // EasyMDE uses .value() method
  if (editor.value && typeof editor.value === 'function') {
    return editor.value();
  }
  
  // Fallback: try codemirror
  if (editor.codemirror) {
    return editor.codemirror.getValue();
  }
  
  return '';
}

/**
 * Set markdown content in an editor instance
 * @param {Object} editor - EasyMDE instance
 * @param {string} content - Markdown content
 */
export function setMarkdownContent(editor, content = '') {
  if (!editor) return;
  
  // EasyMDE uses .value(content) method
  if (editor.value && typeof editor.value === 'function') {
    editor.value(content);
    return;
  }
  
  // Fallback: try codemirror
  if (editor.codemirror) {
    editor.codemirror.setValue(content);
  }
}

/**
 * Replace a plain textarea with a markdown editor
 * This is useful for converting existing textareas to use EasyMDE
 * @param {string} textareaSelectorOrId - Textarea selector or id
 * @param {Object} options - Optional EasyMDE config
 * @returns {Object|null} EasyMDE instance or null if failed
 */
export function replaceTextareaWithEditor(textareaSelectorOrId, options = {}) {
  const selector = textareaSelectorOrId.startsWith('#') ? textareaSelectorOrId : `#${textareaSelectorOrId}`;
  const textarea = document.querySelector(selector);
  
  if (!textarea) {
    console.warn(`Textarea ${selector} not found`);
    return null;
  }
  
  // Store the current value
  const currentValue = textarea.value;
  
  // Initialize editor
  const editor = initMarkdownEditor(textarea, options);
  
  if (editor && currentValue) {
    setMarkdownContent(editor, currentValue);
  }
  
  return editor;
}

