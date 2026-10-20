import Url from '../models/Url.js';
import ClickEvent from '../models/ClickEvent.js';
import { env } from '../config/env.js';
import {
  sanitizeReferrer,
  parseDeviceType,
  parseBrowserFamily,
} from '../utils/analyticsHelper.js';

// Regex for valid short codes (4 to 32 characters: alphanumeric, hyphens, underscores)
const SHORT_CODE_REGEX = /^[a-zA-Z0-9_-]{4,32}$/;

// Reserved system paths that should never be queried as short links
const RESERVED_PATHS = new Set([
  'api',
  'health',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

/**
 * Controller to handle public short URL redirections.
 *
 * Flow:
 * 1. Validate format of :shortCode parameter.
 * 2. Look up URL document in MongoDB by shortCode.
 * 3. Return 404 if not found.
 * 4. Return 403 if link is deactivated (isActive === false).
 * 5. Return 410 if link has expired (expiresAt <= now).
 * 6. Atomically increment clickCount via $inc on Url model.
 * 7. Persist ClickEvent with sanitized referrer and user-agent classifications.
 *    Failure Policy: Event persistence failures are logged without throwing,
 *    ensuring the primary redirect SLA remains unaffected and avoiding double-counting.
 * 8. Redirect to originalUrl with HTTP 302.
 */
export const handleRedirect = async (req, res, next) => {
  try {
    const { shortCode } = req.params;

    // Check reserved paths
    if (!shortCode || RESERVED_PATHS.has(shortCode.toLowerCase())) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Short link not found.',
          statusCode: 404,
        },
      });
    }

    // Validate short code format
    if (!SHORT_CODE_REGEX.test(shortCode)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid short code format. Short codes must be 4–32 alphanumeric characters, hyphens, or underscores.',
          statusCode: 400,
        },
      });
    }

    // Lookup matching URL in database (case-sensitive)
    const urlDoc = await Url.findOne({ shortCode }).exec();

    // 1. Not found
    if (!urlDoc) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Short link not found.',
          statusCode: 404,
        },
      });
    }

    // 2. Deactivated link check
    if (!urlDoc.isActive) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'This short link has been deactivated.',
          statusCode: 403,
        },
      });
    }

    // 3. Expiration check
    if (urlDoc.expiresAt && new Date(urlDoc.expiresAt).getTime() <= Date.now()) {
      return res.status(410).json({
        success: false,
        error: {
          message: 'This short link has expired.',
          statusCode: 410,
        },
      });
    }

    // 4. Prevent redirect loops (where destination points back to this short URL)
    const currentHost = req.get('host');
    const reqUrl = `${req.protocol}://${currentHost}${req.originalUrl}`;
    const configuredShortUrl = `${env.baseUrl}/${shortCode}`;

    if (urlDoc.originalUrl === reqUrl || urlDoc.originalUrl === configuredShortUrl) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Redirect loop detected. Destination cannot be the short link itself.',
          statusCode: 400,
        },
      });
    }

    // 5. Ensure destination protocol is valid HTTP/HTTPS before redirecting
    try {
      const parsedDestination = new URL(urlDoc.originalUrl);
      if (!['http:', 'https:'].includes(parsedDestination.protocol)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Destination URL contains an unsupported protocol.',
            statusCode: 400,
          },
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Stored destination URL is malformed.',
          statusCode: 400,
        },
      });
    }

    // 6. Atomically increment clickCount using MongoDB $inc before redirecting
    await Url.updateOne({ _id: urlDoc._id }, { $inc: { clickCount: 1 } });

    // 7. Record ClickEvent for analytics
    // Failure Policy: If ClickEvent write fails, log the error safely but do NOT block redirect
    try {
      const rawReferrer = req.get('referrer') || req.get('referer');
      const userAgent = req.get('user-agent');

      await ClickEvent.create({
        shortCode: urlDoc.shortCode,
        urlId: urlDoc._id,
        clickedAt: new Date(),
        referrer: sanitizeReferrer(rawReferrer),
        device: parseDeviceType(userAgent),
        browser: parseBrowserFamily(userAgent),
      });
    } catch (eventErr) {
      console.error(`⚠️ Non-fatal: Failed to record ClickEvent for ${urlDoc.shortCode}:`, eventErr.message);
    }

    // 8. Perform HTTP 302 Temporary Redirect to the original URL
    return res.redirect(302, urlDoc.originalUrl);
  } catch (error) {
    // Log internal error without exposing sensitive database or query details to client
    console.error('💥 Error handling short URL redirect:', error.message);
    return next(error);
  }
};
