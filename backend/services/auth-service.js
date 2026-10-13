const crypto = require('node:crypto');
const { promisify } = require('node:util');
const express = require('express');
const { createStore } = require('../lib/store');
const { errorResponse, startService } = require('../lib/http');

const app = express();
const PORT = Number(process.env.AUTH_SERVICE_PORT || 5101);
const store = createStore('users.json', { users: [], revokedTokens: [] });
const data = store.get();
const scrypt = promisify(crypto.scrypt);
const secret = process.env.CINEBOOK_AUTH_SECRET || 'local-development-only-change-this-secret';

app.use(express.json({ limit: '16kb' }));

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verify(token) {
  if (typeof token !== 'string') return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload.sub || payload.exp <= Date.now() || data.revokedTokens.includes(token)) return null;
  const user = payload.role === 'admin'
    ? { id: payload.sub, fullName: payload.name, email: payload.email, role: 'admin' }
    : data.users.find((item) => item.id === payload.sub);
  return user || null;
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, 64);
  return { salt, hash: hash.toString('hex') };
}

async function matchesPassword(password, user) {
  const candidate = await scrypt(password, user.salt, 64);
  const actual = Buffer.from(user.passwordHash, 'hex');
  return candidate.length === actual.length && crypto.timingSafeEqual(candidate, actual);
}

function createAuthResponse(res, user, status = 200) {
  const publicUser = { id: user.id, fullName: user.fullName, email: user.email, role: user.role };
  const token = sign({
    sub: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  });
  return res.status(status).json({ success: true, token, user: publicUser });
}

app.get('/health', async (_req, res) => {
  await store.health();
  return res.json({ status: 'healthy', service: 'auth' });
});

app.post('/auth/signup', async (req, res) => {
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (fullName.length < 2 || fullName.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(res, 400, 'Enter a valid name and email address.');
  }
  if (password.length < 8 || password.length > 128) {
    return errorResponse(res, 400, 'Password must be between 8 and 128 characters.');
  }
  if (data.users.some((user) => user.email === email)) {
    return errorResponse(res, 409, 'An account already exists for this email.');
  }
  const user = {
    id: crypto.randomUUID(),
    fullName,
    email,
    role: 'customer',
    passwordHash: '',
    salt: '',
    createdAt: new Date().toISOString(),
  };
  Object.assign(user, await hashPassword(password));
  user.passwordHash = user.hash;
  delete user.hash;
  if (data.users.some((item) => item.email === email)) {
    return errorResponse(res, 409, 'An account already exists for this email.');
  }
  data.users.push(user);
  await store.save();
  return createAuthResponse(res, user, 201);
});

app.post('/auth/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = data.users.find((item) => item.email === email);
  if (!user || !(await matchesPassword(password, user))) {
    return errorResponse(res, 401, 'Email or password is incorrect.');
  }
  return createAuthResponse(res, user);
});

app.post('/auth/admin', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) {
    return errorResponse(res, 503, 'Admin sign-in is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.');
  }
  if (!safeEqual(email, expectedEmail) || !safeEqual(password, expectedPassword)) {
    return errorResponse(res, 401, 'Admin email or password is incorrect.');
  }
  return createAuthResponse(res, {
    id: 'cinebook-admin',
    fullName: 'CineBook Admin',
    email: expectedEmail,
    role: 'admin',
  });
});

app.post('/internal/validate', (req, res) => {
  const user = verify(req.body?.token);
  if (!user) return errorResponse(res, 401, 'Session is invalid or expired.');
  return res.json({ success: true, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } });
});

app.get('/internal/admin/summary', (_req, res) => {
  return res.json({ success: true, users: data.users.length });
});

app.post('/internal/logout', async (req, res) => {
  const token = req.body?.token;
  if (typeof token === 'string' && verify(token)) {
    data.revokedTokens.push(token);
    await store.save();
  }
  return res.json({ success: true });
});

app.use((error, _req, res, _next) => {
  console.error('Auth service error:', error);
  return errorResponse(res, 500, 'Authentication service failed.');
});

startService(app, PORT, 'auth', [store.ready]);

function safeEqual(first, second) {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
