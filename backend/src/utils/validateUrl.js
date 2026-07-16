const { HttpError } = require('./errors');

/**
 * Validates that `value` is a well-formed http(s) URL. Returns the string
 * unchanged, or null if `value` is empty/undefined. Throws HttpError(400) if
 * it's present but invalid — used for any field (notice link, message link,
 * slot external URL) that gets rendered straight into an href/src, so
 * javascript:/data: and similar schemes must be rejected up front.
 */
function validateHttpUrl(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError(400, `${fieldName} must be a valid http(s) URL`, 'BAD_REQUEST');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, `${fieldName} must use http or https`, 'BAD_REQUEST');
  }
  return value;
}

module.exports = { validateHttpUrl };
