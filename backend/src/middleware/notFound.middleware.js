/**
 * 404 Not Found Middleware
 * Catches all requests that didn't match any route and returns a standard JSON error response.
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
      statusCode: 404,
    },
  });
};
