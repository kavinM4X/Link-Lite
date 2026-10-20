/**
 * Sanitizes and extracts the hostname from an HTTP Referer/Referrer header.
 * Strips path, query parameters, and auth credentials to preserve privacy.
 *
 * @param {string} [rawReferrer]
 * @returns {string} Sanitized hostname (e.g. "google.com") or "direct"
 */
export const sanitizeReferrer = (rawReferrer) => {
  if (!rawReferrer || typeof rawReferrer !== 'string' || !rawReferrer.trim()) {
    return 'direct';
  }

  try {
    const parsed = new URL(rawReferrer.trim());
    if (!parsed.hostname) {
      return 'other';
    }
    // Remove leading "www." for cleaner grouping
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'other';
  }
};

/**
 * Extracts a coarse, privacy-preserving device classification from the User-Agent.
 *
 * @param {string} [userAgent='']
 * @returns {'desktop' | 'mobile' | 'tablet' | 'bot' | 'other'}
 */
export const parseDeviceType = (userAgent = '') => {
  if (!userAgent || typeof userAgent !== 'string') {
    return 'other';
  }

  const ua = userAgent.toLowerCase();

  if (/(bot|spider|crawler|slurp|curl|wget|python|postman)/i.test(ua)) {
    return 'bot';
  }

  if (/(ipad|tablet|(android(?!.*mobile)))/i.test(ua)) {
    return 'tablet';
  }

  if (/(mobile|iphone|ipod|android.*mobile|blackberry|windows phone)/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
};

/**
 * Categorizes the browser family from the User-Agent string.
 *
 * @param {string} [userAgent='']
 * @returns {'chrome' | 'safari' | 'firefox' | 'edge' | 'opera' | 'bot' | 'other'}
 */
export const parseBrowserFamily = (userAgent = '') => {
  if (!userAgent || typeof userAgent !== 'string') {
    return 'other';
  }

  const ua = userAgent.toLowerCase();

  if (/(bot|spider|crawler|slurp|curl|wget|python)/i.test(ua)) {
    return 'bot';
  }

  if (/edg([ea]|ios)?\//i.test(ua)) {
    return 'edge';
  }

  if (/(opera|opr)\//i.test(ua)) {
    return 'opera';
  }

  if (/(firefox|fxios)/i.test(ua)) {
    return 'firefox';
  }

  if (/(chrome|crios)/i.test(ua)) {
    return 'chrome';
  }

  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    return 'safari';
  }

  return 'other';
};
