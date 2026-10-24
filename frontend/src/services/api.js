/**
 * API Client for Baaki Frontend
 * Dynamically resolves base URL via `import.meta.env.VITE_API_URL`.
 * Stores Bearer token in memory and sessionStorage.
 * On 401, requests a new token via POST /api/auth/demo-login once and retries the request once.
 */

const RAW_API_URL = import.meta.env.VITE_API_URL;
const isProd = import.meta.env.PROD;

let normalizedApiUrl = RAW_API_URL ? RAW_API_URL.trim().replace(/\/+$/, '') : null;
if (normalizedApiUrl && !normalizedApiUrl.endsWith('/api') && !normalizedApiUrl.startsWith('/api')) {
  normalizedApiUrl += '/api';
}

// In production, fallback to live Render backend; in local dev, fallback to '/api'
export const API_BASE_URL = normalizedApiUrl || (isProd ? 'https://smart-receivables-cash-flow.onrender.com/api' : '/api');

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.code = data?.code || (typeof data?.error === 'string' ? data.error : null);
    this.params = data?.params || {};
  }
}

// In-memory token reference initialized from sessionStorage
let inMemoryToken = typeof window !== 'undefined'
  ? (sessionStorage.getItem('baaki_auth_token') || localStorage.getItem('baaki_auth_token'))
  : null;

export function setAuthToken(token) {
  inMemoryToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('baaki_auth_token', token);
    } else {
      sessionStorage.removeItem('baaki_auth_token');
      localStorage.removeItem('baaki_auth_token');
    }
  }
}

export function getAuthToken() {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window !== 'undefined') {
    const s = sessionStorage.getItem('baaki_auth_token') || localStorage.getItem('baaki_auth_token');
    if (s) {
      inMemoryToken = s;
      return s;
    }
  }
  return null;
}

export function clearAuthToken() {
  inMemoryToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('baaki_auth_token');
    localStorage.removeItem('baaki_auth_token');
  }
}

// Global promise lock to prevent multiple concurrent refresh calls
let refreshSessionPromise = null;

export async function requestSilentDemoToken() {
  if (refreshSessionPromise) {
    return refreshSessionPromise;
  }

  refreshSessionPromise = (async () => {
    try {
      const url = `${API_BASE_URL || '/api'}/auth/demo-login`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`Demo login failed with status ${res.status}`);
      }

      const data = await res.json();
      if (data && data.token) {
        setAuthToken(data.token);
        return data.token;
      }
      throw new Error('No token returned from demo login');
    } finally {
      refreshSessionPromise = null;
    }
  })();

  return refreshSessionPromise;
}

async function request(endpoint, options = {}, isRetry = false) {
  if (isProd && !API_BASE_URL) {
    throw new ApiError(
      'Missing VITE_API_URL: This production build was created without the VITE_API_URL environment variable. Vite embeds env variables into client JavaScript bundles at build time. Please set VITE_API_URL in your hosting platform (e.g. Vercel) and trigger a redeploy.',
      500,
      { code: 'MISSING_VITE_API_URL' }
    );
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    credentials: 'include',
    ...options,
    headers
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    throw new ApiError(
      `Unable to connect to Baaki server. Please check your network connection. (${networkError.message})`,
      0,
      null
    );
  }

  // Handle 401: Auto-refresh silent demo token once and retry original request
  const isAuthRoute = endpoint.includes('/auth/demo-login') || endpoint.includes('/public/pay');
  if (response.status === 401 && !isRetry && !isAuthRoute) {
    try {
      const newToken = await requestSilentDemoToken();
      if (newToken) {
        return await request(endpoint, options, true);
      }
    } catch (refreshErr) {
      console.error('Silent demo session refresh failed:', refreshErr);
      // Fall through to throw standard ApiError
    }
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, data);
  }

  return data;
}

export const api = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body, ...options }),
  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body, ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options })
};

export default api;
