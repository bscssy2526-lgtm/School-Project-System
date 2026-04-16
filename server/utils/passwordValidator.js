/**
 * Password validation utility
 * Enforces strong password requirements
 */

const PASSWORD_RULES = {
  minLength: 8,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true
};

/**
 * Validate password against security requirements
 * @param {string} password - Password to validate
 * @returns {object} { isValid: boolean, errors: string[] }
 */
function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters long`);
  }

  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }

  if (PASSWORD_RULES.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }

  if (PASSWORD_RULES.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)')
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get password requirements as HTML string for display
 * @returns {string} HTML checklist
 */
function getPasswordRequirementsHTML() {
  return `
    <div class="password-requirements" style="font-size: 0.875rem; margin: 1rem 0; padding: 1rem; background: #f0f9ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
      <p style="margin: 0 0 0.5rem 0; font-weight: 500; color: #1e40af;">Password Requirements:</p>
      <ul style="margin: 0; padding-left: 1.5rem; color: #475569;">
        <li>Minimum 8 characters</li>
        <li>At least one lowercase letter (a-z)</li>
        <li>At least one number (0-9)</li>
        <li>At least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)</li>
      </ul>
    </div>
  `;
}

module.exports = {
  validatePassword,
  getPasswordRequirementsHTML,
  PASSWORD_RULES
};
