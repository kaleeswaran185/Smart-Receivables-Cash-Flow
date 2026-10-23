/**
 * API Client for Baaki Frontend
 * Dynamically resolves base URL via `import.meta.env.VITE_API_URL`.
 * No localhost or port numbers are hardcoded.
 */

const RAW_API_URL = import.meta.env.VITE_API_URL;
const isProd = import.meta.env.PROD;

if (isProd && (!RAW_API_URL || !RAW_API_URL.trim())) {
  console.error(
    '[CRITICAL CONFIGURATION ERROR] VITE_API_URL environment variable is missing in production!\n' +
    'Vite embeds environment variables at build time. To point to your live Render backend, configure VITE_API_URL and trigger a redeploy.'
  );
}

// In production, refuse silent fallback; in development, allow relative '/api'
export const API_BASE_URL = RAW_API_URL
  ? RAW_API_URL.replace(/\/+$/, '')
  : (isProd ? null : '/api');

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  if (isProd && !API_BASE_URL) {
    throw new ApiError(
      'Missing VITE_API_URL: This production build was created without the VITE_API_URL environment variable. Vite embeds env variables into client JavaScript bundles at build time. Please set VITE_API_URL in your hosting platform (e.g. Vercel) and trigger a redeploy.',
      500,
      { code: 'MISSING_VITE_API_URL' }
    );
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('baaki_auth_token') : null;
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
