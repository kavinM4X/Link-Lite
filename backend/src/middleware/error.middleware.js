import { env } from '../config/env.js';

/**
 * Global centralized error handling middleware.
 * Returns consistent JSON response for any unhandled exceptions.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  // Log error details for server diagnostics
  console.error(`💥 [Error] ${req.method} ${req.originalUrl}:`, err);

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      statusCode,
      ...(env.isDevelopment && { stack: err.stack }),
    },
  });
};
