/**
 * Base API configuration service for LinkLite frontend.
 * Reads environment configuration with safe local development fallback.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') || 'http://localhost:5000/api';

/**
 * Optional public short link base URL.
 * When defined, overrides the default domain returned in item.shortUrl from backend.
 */
export const PUBLIC_SHORT_URL_BASE =
  import.meta.env.VITE_PUBLIC_SHORT_URL_BASE?.trim().replace(/\/$/, '') || '';

/**
 * Safely constructs or retrieves the short URL for a link object.
 *
 * @param {object} item
 * @param {string} [item.shortUrl]
 * @param {string} [item.shortCode]
 * @returns {string}
 */
export function getLinkShortUrl(item) {
  if (!item) return '';
  if (PUBLIC_SHORT_URL_BASE && item.shortCode) {
    return `${PUBLIC_SHORT_URL_BASE}/${item.shortCode}`;
  }
  if (item.shortUrl) {
    return item.shortUrl;
  }
  return item.shortCode ? `http://localhost:5000/${item.shortCode}` : '';
}

/**
 * Checks backend health and database connectivity status.
 * Endpoint: GET /api/health
 *
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   name: string,
 *   status: 'healthy' | 'degraded',
 *   uptimeSeconds: number,
 *   timestamp: string,
 *   environment: string,
 *   services: {
 *     server: { status: string },
 *     database: { status: string, readyState: number }
 *   }
 * }>}
 */
export async function checkApiHealth({ signal } = {}) {
  const result = await apiRequest('/health', { signal });
  if (!result || typeof result !== 'object') {
    throw new ApiError('Unexpected or malformed response from health endpoint.', 500);
  }
  return result;
}


/**
 * Custom error class for API request failures.
 */
export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Core HTTP fetch wrapper with structured error extraction and network fault protection.
 *
 * @param {string} endpoint - API path (e.g. '/analytics/overview' or '/urls')
 * @param {object} [options]
 * @param {'GET' | 'POST' | 'PATCH' | 'DELETE'} [options.method='GET']
 * @param {object} [options.body]
 * @param {Record<string, string>} [options.headers]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, { method = 'GET', body, headers = {}, signal } = {}) {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    signal,
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    if (networkError.name === 'AbortError') {
      throw networkError;
    }
    throw new ApiError(
      'Unable to connect to the LinkLite API server. Please check your network connection and verify the backend is running.',
      0
    );
  }

  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      (typeof data === 'string' && data.length < 200 ? data : null) ||
      `Request failed with status ${response.status} (${response.statusText})`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

/**
 * Fetches high-level metrics for LinkLite dashboard.
 * Endpoint: GET /api/analytics/overview
 *
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ totalLinks: number, activeLinks: number, expiredLinks: number, totalClicks: number, clicksToday: number, clicksPrevious7Days: number }>}
 */
export async function getOverviewAnalytics({ signal } = {}) {
  const result = await apiRequest('/analytics/overview', { signal });
  if (!result || !result.success || typeof result.data !== 'object') {
    throw new ApiError('Unexpected or malformed response from overview analytics endpoint.', 500);
  }

  const { totalLinks, activeLinks, expiredLinks, totalClicks } = result.data;
  if (
    typeof totalLinks !== 'number' ||
    typeof activeLinks !== 'number' ||
    typeof expiredLinks !== 'number' ||
    typeof totalClicks !== 'number'
  ) {
    throw new ApiError('Analytics response is missing expected numeric metric fields.', 500);
  }

  return result.data;
}

/**
 * Fetches time-series daily clicks for 7d, 30d, or 90d.
 * Endpoint: GET /api/analytics/clicks?period=7d|30d|90d
 *
 * @param {'7d' | '30d' | '90d'} [period='7d']
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ period: string, startDate: string, endDate: string, totalClicks: number, data: Array<{ date: string, clicks: number }> }>}
 */
export async function getClicksTimeseries(period = '7d', { signal } = {}) {
  const validPeriods = ['7d', '30d', '90d'];
  const safePeriod = validPeriods.includes(period) ? period : '7d';

  const result = await apiRequest(`/analytics/clicks?period=${safePeriod}`, { signal });
  if (!result || !result.success || !Array.isArray(result.data)) {
    throw new ApiError('Unexpected or malformed response from click timeseries endpoint.', 500);
  }

  return result;
}

/**
 * Fetches top 10 shortened links ranked by click count.
 * Endpoint: GET /api/analytics/top-links
 *
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array<{ shortCode: string, originalUrl: string, shortUrl: string, clickCount: number, createdAt: string }>>}
 */
export async function getTopLinks({ signal } = {}) {
  const result = await apiRequest('/analytics/top-links', { signal });
  if (!result || !result.success || !Array.isArray(result.data)) {
    throw new ApiError('Unexpected or malformed response from top links endpoint.', 500);
  }

  return result.data;
}

/**
 * Fetches detailed analytics breakdown for a specific short link.
 * Endpoint: GET /api/analytics/urls/:code
 *
 * @param {string} code - Short code or custom alias
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   shortCode: string,
 *   originalUrl: string | null,
 *   shortUrl: string,
 *   isDeleted: boolean,
 *   totalClicks: number,
 *   dailyClicks: Array<{ date: string, clicks: number }>,
 *   referrers: Array<{ referrer: string, count: number }>,
 *   devices: Array<{ device: string, count: number }>,
 *   browsers: Array<{ browser: string, count: number }>
 * }>}
 */
export async function getUrlAnalytics(code, { signal } = {}) {
  if (!code || typeof code !== 'string') {
    throw new ApiError('Short code is required to retrieve link analytics.', 400);
  }

  const result = await apiRequest(`/analytics/urls/${encodeURIComponent(code.trim())}`, { signal });
  if (!result || !result.success || !result.data) {
    throw new ApiError('Detailed analytics not found for the requested link.', 404);
  }

  return result.data;
}

/**
 * Fetches short URLs with pagination, search, status filtering, and sorting.
 * Endpoint: GET /api/urls
 *
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @param {string} [params.search='']
 * @param {'active' | 'expired' | 'inactive' | 'all' | ''} [params.status='']
 * @param {'createdAt' | 'oldest' | 'createdAtAsc' | 'clicks' | 'clickCount'} [params.sort='createdAt']
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ data: Array<any>, pagination: { page: number, limit: number, totalRecords: number, totalPages: number } }>}
 */
export async function listUrls(
  { page = 1, limit = 10, search = '', status = '', sort = 'createdAt' } = {},
  { signal } = {}
) {
  const query = new URLSearchParams();
  if (page) query.set('page', String(page));
  if (limit) query.set('limit', String(limit));
  if (sort) query.set('sort', String(sort));
  if (search && search.trim()) query.set('search', search.trim());
  if (status && status !== 'all') query.set('status', status);

  const queryString = query.toString();
  const endpoint = queryString ? `/urls?${queryString}` : '/urls';

  const result = await apiRequest(endpoint, { signal });
  if (!result || !result.success || !Array.isArray(result.data)) {
    throw new ApiError('Unexpected or malformed response from URLs listing endpoint.', 500);
  }

  return result;
}

/**
 * Fetches recent shortened URLs (convenience wrapper over listUrls).
 *
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=5]
 * @param {string} [params.sort='createdAt']
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ data: Array<any>, pagination: object }>}
 */
export async function getRecentUrls(params = {}, options = {}) {
  return listUrls(
    {
      page: params.page ?? 1,
      limit: params.limit ?? 5,
      sort: params.sort ?? 'createdAt',
    },
    options
  );
}

/**
 * Fetches a single short link details by code.
 * Endpoint: GET /api/urls/:code
 *
 * @param {string} code - Short code or custom alias
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<any>}
 */
export async function getUrlByCode(code, { signal } = {}) {
  if (!code || typeof code !== 'string') {
    throw new ApiError('Short code is required to retrieve a link.', 400);
  }

  const result = await apiRequest(`/urls/${encodeURIComponent(code.trim())}`, { signal });
  if (!result || !result.success || !result.data) {
    throw new ApiError('Short link record not found.', 404);
  }

  return result.data;
}

/**
 * Creates a new shortened URL.
 * Endpoint: POST /api/urls
 *
 * @param {object} params
 * @param {string} params.originalUrl - Required destination URL
 * @param {string} [params.customAlias] - Optional 4-32 char alias
 * @param {string | null} [params.expiresAt] - Optional ISO date string
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<any>}
 */
export async function createUrl({ originalUrl, customAlias, expiresAt }, { signal } = {}) {
  const body = {
    originalUrl: originalUrl?.trim(),
  };

  if (customAlias && customAlias.trim()) {
    body.customAlias = customAlias.trim();
  }

  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '') {
    body.expiresAt = expiresAt;
  }

  const result = await apiRequest('/urls', {
    method: 'POST',
    body,
    signal,
  });

  return result.data;
}

/**
 * Updates an existing short link's editable fields: originalUrl, expiresAt, isActive.
 * Endpoint: PATCH /api/urls/:code
 *
 * @param {string} code - Short code or custom alias
 * @param {object} updates
 * @param {string} [updates.originalUrl]
 * @param {string | null} [updates.expiresAt]
 * @param {boolean} [updates.isActive]
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<any>}
 */
export async function updateUrl(code, updates = {}, { signal } = {}) {
  if (!code || typeof code !== 'string') {
    throw new ApiError('Short code is required to update a link.', 400);
  }

  const body = {};

  if (updates.originalUrl !== undefined) {
    body.originalUrl = updates.originalUrl?.trim();
  }

  if (updates.expiresAt !== undefined) {
    body.expiresAt = updates.expiresAt;
  }

  if (updates.isActive !== undefined) {
    body.isActive = Boolean(updates.isActive);
  }

  const result = await apiRequest(`/urls/${encodeURIComponent(code.trim())}`, {
    method: 'PATCH',
    body,
    signal,
  });

  return result.data;
}

/**
 * Permanently deletes a short link by code.
 * Endpoint: DELETE /api/urls/:code
 *
 * @param {string} code - Short code or custom alias
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function deleteUrl(code, { signal } = {}) {
  if (!code || typeof code !== 'string') {
    throw new ApiError('Short code is required to delete a link.', 400);
  }

  const result = await apiRequest(`/urls/${encodeURIComponent(code.trim())}`, {
    method: 'DELETE',
    signal,
  });

  return result;
}

