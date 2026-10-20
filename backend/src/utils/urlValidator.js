const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Validates a destination URL against security and format criteria.
 *
 * Requirements:
 * - Must be a non-empty string <= 2048 characters.
 * - Must parse successfully using WHATWG URL parser.
 * - Protocol must be strictly http: or https:.
 * - Rejects javascript:, data:, file:, etc.
 * - Does not make external network requests.
 *
 * @param {string} candidate - The URL string to validate.
 * @returns {{ isValid: boolean, error: string | null, normalizedUrl: string | null }}
 */
export const validateUrl = (candidate) => {
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return {
      isValid: false,
      error: 'Destination URL is required and must be a non-empty string.',
      normalizedUrl: null,
    };
  }

  const trimmed = candidate.trim();

  // Defense-in-depth: Reject unencoded control characters, newlines, and carriage returns
  if (/[\x00-\x1F\x7F]/.test(candidate)) {
    return {
      isValid: false,
      error: 'URL cannot contain newline, carriage return, or unencoded control characters.',
      normalizedUrl: null,
    };
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return {
      isValid: false,
      error: `URL exceeds maximum allowed length of ${MAX_URL_LENGTH} characters.`,
      normalizedUrl: null,
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      error: 'Invalid or malformed URL format. Please provide a complete URL including http:// or https://.',
      normalizedUrl: null,
    };
  }

  // Ensure protocol is strictly http or https
  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    return {
      isValid: false,
      error: `Unsupported protocol "${parsedUrl.protocol}". Only HTTP and HTTPS destination URLs are allowed.`,
      normalizedUrl: null,
    };
  }

  // Ensure valid hostname exists
  if (!parsedUrl.hostname || parsedUrl.hostname.trim() === '') {
    return {
      isValid: false,
      error: 'URL must contain a valid domain name or hostname.',
      normalizedUrl: null,
    };
  }

  return {
    isValid: true,
    error: null,
    normalizedUrl: parsedUrl.href,
  };
};
