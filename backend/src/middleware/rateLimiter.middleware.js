import rateLimit from 'express-rate-limit';

/**
 * Rate limiting middleware for short link creation.
 * Protects the API against abuse, spam, and DoS attacks.
 */
export const urlCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 60 create requests per 15-minute window
  standardHeaders: true, // Return standard rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many URL shortening requests from this IP address. Please try again later.',
        statusCode: 429,
      },
    });
  },
});

/**
 * Rate limiting middleware for public short link redirections.
 * Protects against click-count manipulation and volumetric redirection flooding.
 */
export const redirectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // Generous limit: 3000 redirects per IP per 15-minute window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many redirection requests from this IP address. Please try again later.',
        statusCode: 429,
      },
    });
  },
});

