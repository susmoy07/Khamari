export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) {
    console.error('[ServerError]', err);
  }

  res.status(statusCode).json({
    success: false,
    code: err.code || 'INTERNAL_ERROR',
    error: err.message || 'An unexpected server error occurred.',
  });
}
