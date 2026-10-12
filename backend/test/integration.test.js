const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const temporaryData = fs.mkdtempSync(path.join(os.tmpdir(), 'cinebook-services-'));
const ports = {};
let runner;
let api;

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function request(route, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${api}${route}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  const portKeys = ['gateway', 'auth', 'inventory', 'booking', 'payment', 'recommendation', 'notification'];
  for (const key of portKeys) ports[key] = await getFreePort();
  api = `http://127.0.0.1:${ports.gateway}/api`;
  const env = {
    ...process.env,
    PORT: String(ports.gateway),
    AUTH_SERVICE_PORT: String(ports.auth),
    INVENTORY_SERVICE_PORT: String(ports.inventory),
    BOOKING_SERVICE_PORT: String(ports.booking),
    PAYMENT_SERVICE_PORT: String(ports.payment),
    RECOMMENDATION_SERVICE_PORT: String(ports.recommendation),
    NOTIFICATION_SERVICE_PORT: String(ports.notification),
    ADMIN_EMAIL: 'admin@cinebook.test',
    ADMIN_PASSWORD: 'integration-admin-secret',
    CINEBOOK_AUTH_SECRET: crypto.randomBytes(32).toString('hex'),
    TICKET_SECRET: crypto.randomBytes(32).toString('hex'),
    CINEBOOK_DATA_DIR: temporaryData,
  };
  runner = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: 'ignore',
  });

  let healthy = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (runner.exitCode !== null) throw new Error(`Service runner exited with code ${runner.exitCode}.`);
    try {
      const result = await request('/health');
      if (result.status === 200 && result.body.status === 'healthy') {
        healthy = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(healthy, true, 'all local microservices should start healthy');
});

after(async () => {
  if (runner && runner.exitCode === null) {
    runner.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => runner.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  }
  fs.rmSync(temporaryData, { recursive: true, force: true });
});

test('demo checkout, seat locking, tickets, notifications, cancellations, and local recommendations work end to end', async () => {
  const signupOne = await request('/auth/signup', {
    method: 'POST',
    body: { fullName: 'First Test User', email: 'first@example.test', password: 'first-password-8' },
  });
  const signupTwo = await request('/auth/signup', {
    method: 'POST',
    body: { fullName: 'Second Test User', email: 'second@example.test', password: 'second-password-8' },
  });
  assert.equal(signupOne.status, 201);
  assert.equal(signupTwo.status, 201);

  const showtimeId = 'interstellar-delhi-pvr-1015';
  const ticketResponse = await request('/bookings', {
    method: 'POST',
    token: signupOne.body.token,
    body: {
      showtimeId,
      seats: ['A1', 'A2'],
      paymentMethod: 'Pay at venue',
      paymentDetails: {
        fullName: 'First Test User',
        email: 'first@example.test',
        phone: '9876543210',
        demoInput: '',
      },
    },
  });
  assert.equal(ticketResponse.status, 201);
  assert.equal(ticketResponse.body.booking.total, 672);
  assert.equal(ticketResponse.body.booking.paymentStatus, 'reserved');
  assert.match(ticketResponse.body.booking.ticketCode, /^CINEBOOK:/);
  assert.equal(JSON.stringify(ticketResponse.body).includes('4242 4242'), false, 'demo payment details must not be returned with the ticket');

  const conflict = await request('/bookings', {
    method: 'POST',
    token: signupTwo.body.token,
    body: {
      showtimeId,
      seats: ['A1'],
      paymentMethod: 'Pay at venue',
      paymentDetails: {
        fullName: 'Second Test User',
        email: 'second@example.test',
        phone: '9876543211',
      },
    },
  });
  assert.equal(conflict.status, 409, 'another user cannot reserve the same seat');

  const notifications = await request('/notifications', { token: signupOne.body.token });
  assert.equal(notifications.status, 200);
  assert.equal(notifications.body.notifications.length, 1);

  const adminLogin = await request('/auth/admin', {
    method: 'POST',
    body: { email: 'admin@cinebook.test', password: 'integration-admin-secret' },
  });
  assert.equal(adminLogin.status, 200);
  const verified = await request(`/tickets/verify?code=${encodeURIComponent(ticketResponse.body.booking.ticketCode)}`, {
    token: adminLogin.body.token,
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.ticket.status, 'reserved');

  const wrongOwnerCancel = await request(`/bookings/${ticketResponse.body.booking.id}`, {
    method: 'DELETE',
    token: signupTwo.body.token,
  });
  assert.equal(wrongOwnerCancel.status, 403);

  const cancelled = await request(`/bookings/${ticketResponse.body.booking.id}`, {
    method: 'DELETE',
    token: signupOne.body.token,
  });
  assert.equal(cancelled.status, 200);
  const afterCancel = await request(`/availability/${showtimeId}`);
  assert.equal(afterCancel.body.bookedSeats.includes('A1'), false);
  const cancelledTicket = await request(`/tickets/verify?code=${encodeURIComponent(ticketResponse.body.booking.ticketCode)}`, {
    token: adminLogin.body.token,
  });
  assert.equal(cancelledTicket.status, 410);

  const paidBooking = await request('/bookings', {
    method: 'POST',
    token: signupTwo.body.token,
    body: {
      showtimeId,
      seats: ['A1'],
      paymentMethod: 'Demo card',
      paymentDetails: {
        fullName: 'Second Test User',
        email: 'second@example.test',
        phone: '9876543211',
        demoInput: '4242 4242 4242 4242',
      },
    },
  });
  assert.equal(paidBooking.status, 201);
  assert.equal(paidBooking.body.booking.paymentStatus, 'demo-paid');
  assert.equal(paidBooking.body.booking.total, 336);
  assert.equal(JSON.stringify(paidBooking.body).includes('4242 4242'), false, 'test card number must not be stored in the booking');

  const recommendations = await request('/recommendations', {
    method: 'POST',
    body: { city: 'Delhi', favoriteIds: ['interstellar'], watchedIds: [] },
  });
  assert.equal(recommendations.status, 200);
  assert.equal(recommendations.body.algorithm, 'local-content-tfidf-cosine');
  assert.equal(recommendations.body.recommendations.some((item) => item.id === 'interstellar'), false);
});
