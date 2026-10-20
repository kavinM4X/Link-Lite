import crypto from 'crypto';
import Url from '../models/Url.js';

// Base62 alphabet (URL-safe, alphanumeric, no punctuation ambiguity)
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHABET_LENGTH = ALPHABET.length;
const DEFAULT_CODE_LENGTH = 7;
const MAX_COLLISION_RETRIES = 5;

// Custom alias validation rules
const ALIAS_MIN_LENGTH = 4;
const ALIAS_MAX_LENGTH = 32;
const ALIAS_REGEX = /^[a-zA-Z0-9_-]+$/;

// Reserved route names that cannot be used as short codes or custom aliases
const RESERVED_WORDS = new Set([
  'api',
  'health',
  'login',
  'register',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'admin',
  'auth',
  'urls',
  'dashboard',
  'static',
  'public',
  'app',
  'help',
]);

/**
 * Generates a cryptographically secure random short code using Node.js crypto.
 *
 * @param {number} [length=7]
 * @returns {string}
 */
export const generateCryptographicCode = (length = DEFAULT_CODE_LENGTH) => {
  // Generate random bytes and map to ALPHABET to prevent modulo bias
  const randomBytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomBytes[i] % ALPHABET_LENGTH];
  }
  return code;
};

/**
 * Validates a user-supplied custom alias.
 *
 * NOTE: Short codes and custom aliases are treated CASE-SENSITIVELY.
 * "Product-A" and "product-a" are considered distinct identifiers.
 *
 * @param {string} alias
 * @returns {{ isValid: boolean, error: string | null }}
 */
export const validateCustomAlias = (alias) => {
  if (typeof alias !== 'string') {
    return {
      isValid: false,
      error: 'Custom alias must be a string.',
    };
  }

  const trimmed = alias.trim();

  // Check against reserved words first (case-insensitive check for reserved words)
  if (RESERVED_WORDS.has(trimmed.toLowerCase())) {
    return {
      isValid: false,
      error: `The alias "${trimmed}" is a reserved system route and cannot be used.`,
    };
  }

  if (trimmed.length < ALIAS_MIN_LENGTH || trimmed.length > ALIAS_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Custom alias must be between ${ALIAS_MIN_LENGTH} and ${ALIAS_MAX_LENGTH} characters in length.`,
    };
  }

  if (!ALIAS_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Custom alias may only contain alphanumeric characters, hyphens (-), and underscores (_).',
    };
  }

  return {
    isValid: true,
    error: null,
  };
};

/**
 * Resolves a unique short code for a URL document.
 * If a custom alias is provided, validates format and ensures no conflict exists in MongoDB.
 * If no custom alias is provided, generates a cryptographically random code with retry logic.
 *
 * @param {string} [customAlias] - Optional user-provided alias.
 * @returns {Promise<{ shortCode: string, isCustom: boolean }>}
 * @throws {Error} - Throws 400 validation error, 409 conflict error, or 500 collision failure.
 */
export const resolveShortCode = async (customAlias) => {
  if (customAlias !== undefined && customAlias !== null) {
    const trimmedAlias = String(customAlias).trim();
    const validation = validateCustomAlias(trimmedAlias);

    if (!validation.isValid) {
      const err = new Error(validation.error);
      err.statusCode = 400;
      throw err;
    }

    // Check if alias already exists in database (case-sensitive)
    const existing = await Url.findOne({ shortCode: trimmedAlias }).lean();
    if (existing) {
      const conflictError = new Error(`The custom alias "${trimmedAlias}" is already taken.`);
      conflictError.statusCode = 409;
      throw conflictError;
    }

    return { shortCode: trimmedAlias, isCustom: true };
  }

  // Generate unique random code with bounded retries
  for (let attempt = 1; attempt <= MAX_COLLISION_RETRIES; attempt++) {
    const candidate = generateCryptographicCode(DEFAULT_CODE_LENGTH);

    // Reserved check for generated code just in case
    if (RESERVED_WORDS.has(candidate.toLowerCase())) {
      continue;
    }

    const exists = await Url.exists({ shortCode: candidate });
    if (!exists) {
      return { shortCode: candidate, isCustom: false };
    }
  }

  const collisionError = new Error('Unable to generate a unique short code after multiple attempts. Please try again.');
  collisionError.statusCode = 500;
  throw collisionError;
};
