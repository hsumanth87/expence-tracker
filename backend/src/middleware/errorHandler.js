function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);

  const errMsg = String(err.message || '');

  // SQLite UNIQUE constraint violation
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || errMsg.includes('UNIQUE constraint failed')) {
    return res.status(409).json({
      success: false,
      error: 'A record with this identifier already exists.',
    });
  }

  // SQLite CHECK constraint violation
  if (errMsg.includes('CHECK constraint failed')) {
    return res.status(400).json({
      success: false,
      error: `Input violates database constraint: ${errMsg}`,
    });
  }

  if (err.code && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(400).json({
      success: false,
      error: `Database constraint violation: ${errMsg}`,
    });
  }

  // General server error
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'An unexpected internal server error occurred.',
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
