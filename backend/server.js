if (process.env.CINEBOOK_SERVICE_RUNNER !== '1') {
  require('./service-runner');
} else {
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || 5001);
const AUTH_URL = process.env.AUTH_SERVICE_URL || `http://127.0.0.1:${process.env.AUTH_SERVICE_PORT || 5101}`;
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL || `http://127.0.0.1:${process.env.INVENTORY_SERVICE_PORT || 5102}`;
const BOOKING_URL = process.env.BOOKING_SERVICE_URL || `http://127.0.0.1:${process.env.BOOKING_SERVICE_PORT || 5103}`;
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || `http://127.0.0.1:${process.env.PAYMENT_SERVICE_PORT || 5104}`;
const RECOMMENDATION_URL = process.env.RECOMMENDATION_SERVICE_URL || `http://127.0.0.1:${process.env.RECOMMENDATION_SERVICE_PORT || 5105}`;

app.use(cors());
app.use(express.json({ limit: '32kb' }));

async function callService(url, route, options = {}) {
  const response = await fetch(`${url}${route}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

function relay(res, result) {
  return res.status(result.status).json(result.payload);
}

async function getPrincipal(req, res, allowedRole) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ success: false, message: 'Please sign in to continue.' });
    return null;
  }
  const result = await callService(AUTH_URL, '/internal/validate', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  if (result.status !== 200) {
    res.status(401).json({ success: false, message: 'Your session expired. Please sign in again.' });
    return null;
  }
  if (allowedRole && result.payload.user.role !== allowedRole) {
    res.status(403).json({ success: false, message: 'This action is not allowed for your account.' });
    return null;
  }
  return { ...result.payload.user, token };
}

app.get('/api/health', async (_req, res) => {
  const serviceUrls = {
    auth: AUTH_URL,
    inventory: INVENTORY_URL,
    bookings: BOOKING_URL,
    payments: PAYMENT_URL,
    recommendations: RECOMMENDATION_URL,
  };
  const health = await Promise.all(
    Object.entries(serviceUrls).map(async ([name, url]) => {
      try {
        const result = await callService(url, '/health');
        return [name, result.status === 200 ? 'healthy' : 'unhealthy'];
      } catch {
        return [name, 'unavailable'];
      }
    }),
  );
  const services = Object.fromEntries(health);
  const healthy = Object.values(services).every((status) => status === 'healthy');
  return res.status(healthy ? 200 : 503).json({ status: healthy ? 'healthy' : 'degraded', services });
});

for (const route of ['/auth/signup', '/auth/login', '/auth/admin']) {
  app.post(`/api${route}`, async (req, res) => {
    const result = await callService(AUTH_URL, route, {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    return relay(res, result);
  });
}

app.post('/api/auth/logout', async (req, res) => {
  const principal = await getPrincipal(req, res);
  if (!principal) return;
  return relay(
    res,
    await callService(AUTH_URL, '/internal/logout', {
      method: 'POST',
      body: JSON.stringify({ token: principal.token }),
    }),
  );
});

app.get('/api/availability/:showtimeId', async (req, res) => {
  const result = await callService(
    INVENTORY_URL,
    `/availability/${encodeURIComponent(req.params.showtimeId)}`,
  );
  return relay(res, result);
});

app.post('/api/bookings', async (req, res) => {
  const principal = await getPrincipal(req, res, 'customer');
  if (!principal) return;
  const result = await callService(BOOKING_URL, '/internal/bookings', {
    method: 'POST',
    headers: { 'X-CineBook-User': Buffer.from(JSON.stringify(principal)).toString('base64url') },
    body: JSON.stringify(req.body),
  });
  return relay(res, result);
});

app.get('/api/bookings', async (req, res) => {
  const principal = await getPrincipal(req, res, 'customer');
  if (!principal) return;
  const result = await callService(BOOKING_URL, '/internal/bookings', {
    headers: { 'X-CineBook-User': Buffer.from(JSON.stringify(principal)).toString('base64url') },
  });
  return relay(res, result);
});

app.delete('/api/bookings/:bookingId', async (req, res) => {
  const principal = await getPrincipal(req, res);
  if (!principal) return;
  const result = await callService(
    BOOKING_URL,
    `/internal/bookings/${encodeURIComponent(req.params.bookingId)}`,
    {
      method: 'DELETE',
      headers: { 'X-CineBook-User': Buffer.from(JSON.stringify(principal)).toString('base64url') },
    },
  );
  return relay(res, result);
});

app.get('/api/admin/summary', async (req, res) => {
  const principal = await getPrincipal(req, res, 'admin');
  if (!principal) return;
  const [bookings, accounts] = await Promise.all([
    callService(BOOKING_URL, '/internal/admin/summary'),
    callService(AUTH_URL, '/internal/admin/summary'),
  ]);
  if (bookings.status !== 200) return relay(res, bookings);
  if (accounts.status !== 200) return relay(res, accounts);
  return res.json({ ...bookings.payload, users: accounts.payload.users });
});

app.get('/api/notifications', async (req, res) => {
  const principal = await getPrincipal(req, res, 'customer');
  if (!principal) return;
  return relay(
    res,
    await callService(
      process.env.NOTIFICATION_SERVICE_URL || `http://127.0.0.1:${process.env.NOTIFICATION_SERVICE_PORT || 5106}`,
      `/internal/notifications/${encodeURIComponent(principal.id)}`,
    ),
  );
});

app.post('/api/recommendations', async (req, res) => {
  const result = await callService(RECOMMENDATION_URL, '/recommendations', {
    method: 'POST',
    body: JSON.stringify(req.body),
  });
  return relay(res, result);
});

app.get('/api/tickets/verify', async (req, res) => {
  const principal = await getPrincipal(req, res, 'admin');
  if (!principal) return;
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  return relay(
    res,
    await callService(BOOKING_URL, `/internal/tickets/verify?code=${encodeURIComponent(code)}`),
  );
});

app.use((error, _req, res, _next) => {
  console.error('API gateway request failed:', error);
  return res.status(503).json({ success: false, message: 'A CineBook service is temporarily unavailable.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CineBook API gateway listening on port ${PORT}`);
});
}
