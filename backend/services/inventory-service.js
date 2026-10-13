const express = require('express');
const crypto = require('node:crypto');
const movies = require('../../frontend/src/data/movies.json');
const { createStore } = require('../lib/store');
const { errorResponse, startService } = require('../lib/http');

const app = express();
const PORT = Number(process.env.INVENTORY_SERVICE_PORT || 5102);
const store = createStore('inventory.json', { holds: {}, bookings: {} });
const inventory = store.get();
const validSeats = new Set(
  Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 10 }, (_, column) => `${String.fromCharCode(65 + row)}${column + 1}`),
  ).flat(),
);

app.use(express.json({ limit: '16kb' }));

function knownShowtime(showtimeId) {
  return movies.some((movie) => movie.showtimes.some((showtime) => showtime.id === showtimeId));
}

function cleanExpiredHolds(showtimeId) {
  const now = Date.now();
  inventory.holds[showtimeId] = (inventory.holds[showtimeId] || []).filter((hold) => hold.expiresAt > now);
}

app.get('/health', async (_req, res) => {
  await store.health();
  return res.json({ status: 'healthy', service: 'inventory' });
});

app.get('/availability/:showtimeId', async (req, res) => {
  const showtimeId = req.params.showtimeId;
  if (!knownShowtime(showtimeId)) return errorResponse(res, 404, 'Showtime was not found.');
  cleanExpiredHolds(showtimeId);
  const booked = inventory.bookings[showtimeId] || [];
  const held = (inventory.holds[showtimeId] || []).flatMap((hold) => hold.seats);
  await store.save();
  return res.json({ success: true, bookedSeats: [...new Set([...booked, ...held])] });
});

app.post('/internal/hold', async (req, res) => {
  const { showtimeId, seats } = req.body || {};
  if (!knownShowtime(showtimeId)) return errorResponse(res, 404, 'Showtime was not found.');
  if (!Array.isArray(seats) || seats.length < 1 || seats.length > 8 ||
      seats.some((seat) => typeof seat !== 'string' || !validSeats.has(seat)) ||
      new Set(seats).size !== seats.length) {
    return errorResponse(res, 400, 'Choose 1 to 8 unique valid seats.');
  }
  cleanExpiredHolds(showtimeId);
  const booked = inventory.bookings[showtimeId] || [];
  const held = (inventory.holds[showtimeId] || []).flatMap((hold) => hold.seats);
  const conflicts = seats.filter((seat) => booked.includes(seat) || held.includes(seat));
  if (conflicts.length) return errorResponse(res, 409, `Seats are no longer available: ${conflicts.join(', ')}.`);

  const hold = {
    token: crypto.randomUUID(),
    seats,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  inventory.holds[showtimeId] = [...(inventory.holds[showtimeId] || []), hold];
  await store.save();
  return res.status(201).json({ success: true, holdToken: hold.token, expiresAt: hold.expiresAt });
});

app.post('/internal/commit', async (req, res) => {
  const { showtimeId, holdToken } = req.body || {};
  cleanExpiredHolds(showtimeId);
  const holds = inventory.holds[showtimeId] || [];
  const hold = holds.find((item) => item.token === holdToken);
  if (!hold) return errorResponse(res, 409, 'Seat hold expired. Please select your seats again.');
  inventory.bookings[showtimeId] = [...(inventory.bookings[showtimeId] || []), ...hold.seats];
  inventory.holds[showtimeId] = holds.filter((item) => item.token !== holdToken);
  await store.save();
  return res.json({ success: true, seats: hold.seats });
});

app.post('/internal/release', async (req, res) => {
  const { showtimeId, holdToken, seats } = req.body || {};
  if (holdToken && Array.isArray(inventory.holds[showtimeId])) {
    inventory.holds[showtimeId] = inventory.holds[showtimeId].filter((hold) => hold.token !== holdToken);
  }
  if (Array.isArray(seats) && Array.isArray(inventory.bookings[showtimeId])) {
    inventory.bookings[showtimeId] = inventory.bookings[showtimeId].filter((seat) => !seats.includes(seat));
  }
  await store.save();
  return res.json({ success: true });
});

app.use((error, _req, res, _next) => {
  console.error('Inventory service error:', error);
  return errorResponse(res, 500, 'Seat inventory service failed.');
});

startService(app, PORT, 'inventory', [store.ready]);
