const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-256-bit-key-must-be-32-chars';
const IV_LENGTH = 16;

// Ensure key is exactly 32 bytes for AES-256
function getEncryptionKey() {
  let key = ENCRYPTION_KEY;
  if (key.length < 32) {
    key = key.padEnd(32, '0');
  } else if (key.length > 32) {
    key = key.substring(0, 32);
  }
  return Buffer.from(key);
}

/**
 * Encrypt a phone number
 * @param {string} phoneNumber - The phone number to encrypt
 * @returns {string} - Encrypted phone number with IV prepended (hex format)
 */
function encryptPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return null;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(phoneNumber.trim(), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return IV + encrypted data separated by ':'
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a phone number
 * @param {string} encryptedPhoneNumber - The encrypted phone number with IV prepended
 * @returns {string} - Decrypted phone number
 */
function decryptPhoneNumber(encryptedPhoneNumber) {
  if (!encryptedPhoneNumber || typeof encryptedPhoneNumber !== 'string') {
    return null;
  }

  try {
    const parts = encryptedPhoneNumber.split(':');
    
    // If no ':' found, it's plain text (not encrypted yet)
    if (parts.length !== 2) {
      // Check if it looks like a phone number (digits only, not hex)
      if (/^[0-9+\-\s()]+$/.test(encryptedPhoneNumber)) {
        return encryptedPhoneNumber;
      }
      console.warn('Invalid encrypted phone number format');
      return null;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('Decryption error:', err.message);
    return null;
  }
}

/**
 * Mask a phone number for display (e.g., 09*****05)
 * @param {string} phoneNumber - The decrypted phone number or plain text
 * @returns {string} - Masked phone number
 */
function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return '***';
  }

  const phone = phoneNumber.trim();
  if (phone.length < 4) {
    return '*';
  }

  // Show first 2 and last 2 digits, mask the rest
  const visibleStart = phone.substring(0, 2);
  const visibleEnd = phone.substring(phone.length - 2);
  const maskedLength = phone.length - 4;
  const masked = '*'.repeat(maskedLength);

  return `${visibleStart}${masked}${visibleEnd}`;
}

/**
 * Mask an encrypted phone number for display
 * @param {string} encryptedPhoneNumber - The encrypted phone number
 * @returns {string} - Masked phone number
 */
function maskEncryptedPhoneNumber(encryptedPhoneNumber) {
  const decrypted = decryptPhoneNumber(encryptedPhoneNumber);
  if (!decrypted) return '***';
  return maskPhoneNumber(decrypted);
}

module.exports = {
  encryptPhoneNumber,
  decryptPhoneNumber,
  maskPhoneNumber,
  maskEncryptedPhoneNumber,
};
