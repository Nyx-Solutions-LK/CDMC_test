class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || 'ERROR';
  }
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Multer's own errors (e.g. LIMIT_FILE_SIZE) don't set `.status`, but are always client errors.
  const isMulterLimitError = typeof err.code === 'string' && err.code.startsWith('LIMIT_');
  // body-parser's JSON parse failures don't set `.status` consistently across
  // versions either, and their message is Node's raw SyntaxError text — fine
  // to know it's "bad request," not useful (or intended) to leak verbatim.
  const isBodyParseError = err.type === 'entity.parse.failed';
  const status = err.status || (isMulterLimitError || isBodyParseError ? 400 : 500);
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({
    error: {
      message: isBodyParseError ? 'Invalid JSON in request body' : err.message || 'Internal server error',
      code: isBodyParseError ? 'BAD_REQUEST' : err.code || 'ERROR',
    },
  });
}

module.exports = { HttpError, errorHandler };
