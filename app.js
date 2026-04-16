/* Global API and auth helpers for Announcement Management and SMS Broadcasting System */
// Use backend on port 3000 when opened from another port (e.g. Live Server) so login works
const API_BASE = (function () {
  const o = window.location.origin;
  // When opened as file:// or from another port, always use Node server on 3000
  if (!o || o === 'null' || o.startsWith('file:')) return 'http://localhost:3000/api';
  if (o.startsWith('http://localhost:') && o !== 'http://localhost:3000') return 'http://localhost:3000/api';
  if (o.startsWith('https://localhost:') && o !== 'https://localhost:3000') return 'https://localhost:3000/api';
  return o + '/api';
})();

function getToken() {
  return localStorage.getItem('token');
}
function setToken(token) {
  localStorage.setItem('token', token);
}
function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (_) {
    return null;
  }
}
function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user || null));
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json().catch(() => ({}))
    : null;
  if (res.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login.html' && !window.location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
    }
    return { error: 'Unauthorized', data };
  }
  return { ok: res.ok, status: res.status, data };
}

// --- Authentication helpers ---
function _safeBase64Decode(str) {
  // add padding if necessary
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch (e) {
    return null;
  }
}

function parseJwtPayload(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = _safeBase64Decode(parts[1]);
  if (!payload) return null;
  try { return JSON.parse(payload); } catch (e) { return null; }
}

function isTokenExpired(token) {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp === 'undefined') return false; // can't determine -> treat as valid
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
}

function handleLogoutIfExpired() {
  const token = getToken();
  if (!token) return;
  if (isTokenExpired(token)) {
    clearToken();
    // If not on login page, redirect
    if (!window.location.pathname.endsWith('/login.html') && window.location.pathname !== '/login.html') {
      window.location.href = 'login.html';
    }
  }
}

function requireValidToken() {
  // Check if token exists and is valid before performing any API calls
  const token = getToken();
  if (!token) return false;
  if (isTokenExpired(token)) {
    clearToken();
    return false;
  }
  return true;
}

// Check on load and when the page becomes visible
window.addEventListener('load', handleLogoutIfExpired);
window.addEventListener('focus', handleLogoutIfExpired);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') handleLogoutIfExpired(); });

// Also check token expiration before each API call to catch edge cases
if (!window._apiWrapped) {
  const originalApi = api;
  async function wrappedApi(path, options = {}) {
    if (!requireValidToken() && path !== '/auth/login' && path !== '/auth/dev-admin') {
      // Non-auth endpoints must have a valid token
      if (!window.location.pathname.endsWith('/login.html') && window.location.pathname !== '/login.html') {
        window.location.href = 'login.html';
      }
      return { error: 'Token expired', status: 401 };
    }
    return await originalApi(path, options);
  }
  window.api = wrappedApi;
  window._apiWrapped = true;
}
