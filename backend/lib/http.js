async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

function errorResponse(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function readPrincipal(req, res) {
  const encoded = req.get('x-cinebook-user');
  if (!encoded) {
    errorResponse(res, 401, 'Authenticated user context is required.');
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    errorResponse(res, 401, 'Authenticated user context is invalid.');
    return null;
  }
}

module.exports = { errorResponse, readPrincipal, requestJson };
