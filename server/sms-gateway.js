/**
 * SMS gateway client using TextBee API.
 * Sends announcement notifications to students via SMS.
 */

const { decryptPhoneNumber } = require('./utils/encryption');

// TextBee API configuration
const TEXTBEE_DEVICE_ID = '69a0dbf01a154aafc2de6984';
const TEXTBEE_API_KEY = 'a03df44d-26ad-4f2c-9f57-beaa04b3dd27';
const TEXTBEE_GATEWAY_URL = 'https://api.textbee.dev/api/v1/gateway/devices/' + TEXTBEE_DEVICE_ID + '/send-sms';

function normalizePhone(num) {
  if (!num || typeof num !== 'string') return null;
  const digits = num.replace(/\D/g, '');
  // Philippines: 09XXXXXXXXX (11 digits) -> +639XXXXXXXXX
  if (digits.startsWith('09') && digits.length === 11) {
    return '+63' + digits.slice(1);
  }
  if (digits.startsWith('9') && digits.length === 10) {
    return '+63' + digits;
  }
  if (num.startsWith('+')) return num;
  return digits.length > 0 ? '+' + digits : null;
}

/**
 * Decrypt and normalize an encrypted phone number
 * @param {string} encryptedPhone - The encrypted phone number from database
 * @returns {string|null} - Normalized phone number (e.g., +639XXXXXXXXX) or null if decryption fails
 */
function decryptAndNormalizePhone(encryptedPhone) {
  if (!encryptedPhone) return null;
  try {
    const decrypted = decryptPhoneNumber(encryptedPhone);
    if (!decrypted) return null;
    return normalizePhone(decrypted);
  } catch (error) {
    console.error('Failed to decrypt phone number:', error.message);
    return null;
  }
}

/**
 * Send SMS to multiple numbers via TextBee.
 * @param {string[]} phoneNumbers - e.g. ['+639162255887']
 * @param {string} text - message body (typically announcement title)
 * @returns {Promise<{ ok: boolean, status?: number, error?: string }>}
 */
async function sendSms(phoneNumbers, text) {
  const numbers = phoneNumbers.map(normalizePhone).filter(Boolean);
  if (numbers.length === 0) {
    return { ok: false, error: 'No valid phone numbers' };
  }
  // Format message: announcement title + "open the system to read full details"
  const fullMessage = text;
  
  try {
    const res = await fetch(TEXTBEE_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEXTBEE_API_KEY,
      },
      body: JSON.stringify({
        recipients: numbers,
        message: fullMessage,
      }),
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error('TextBee SMS error:', res.status, errText);
      return { ok: false, status: res.status, error: errText || res.statusText };
    }
    
    const data = await res.json();
    console.log('TextBee SMS sent successfully:', data);
    return { ok: true };
  } catch (err) {
    console.error('TextBee SMS fetch error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send SMS to multiple numbers in batches to avoid API timeouts.
 * @param {string[]} phoneNumbers - e.g. ['+639162255887', '+639123456789']
 * @param {string} text - message body
 * @param {number} batchSize - how many recipients per API call (default: 150)
 * @param {number} delayMs - milliseconds to wait between batches (default: 500)
 * @returns {Promise<{ succeeded: number, failed: number, errors: string[] }>}
 */
async function sendSmsBatch(phoneNumbers, text, batchSize = 150, delayMs = 500) {
  const batches = [];
  
  // Split phone numbers into chunks
  for (let i = 0; i < phoneNumbers.length; i += batchSize) {
    batches.push(phoneNumbers.slice(i, i + batchSize));
  }
  
  console.log(`Processing SMS batch: ${phoneNumbers.length} recipients in ${batches.length} batches`);
  
  let results = { succeeded: 0, failed: 0, errors: [] };
  
  for (let i = 0; i < batches.length; i++) {
    try {
      const result = await sendSms(batches[i], text);
      
      if (result.ok) {
        results.succeeded += batches[i].length;
        console.log(`✓ Batch ${i + 1}/${batches.length} sent (${batches[i].length} recipients)`);
      } else {
        results.failed += batches[i].length;
        const error = `Batch ${i + 1}: ${result.error || result.status}`;
        results.errors.push(error);
        console.error(`✗ ${error}`);
      }
      
      // Delay between batches to respect API rate limits
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      results.failed += batches[i].length;
      const errMsg = `Batch ${i + 1} exception: ${error.message}`;
      results.errors.push(errMsg);
      console.error(`✗ ${errMsg}`);
    }
  }
  
  console.log(`SMS batch complete: ${results.succeeded} succeeded, ${results.failed} failed`);
  return results;
}

module.exports = { sendSms, sendSmsBatch, normalizePhone, decryptAndNormalizePhone };
