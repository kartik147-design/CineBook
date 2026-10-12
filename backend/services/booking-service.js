const crypto = require('node:crypto');
const express = require('express');
const movies = require('../../frontend/src/data/movies.json');
const { createJsonStore } = require('../lib/json-store');
const { errorResponse, readPrincipal, requestJson } = require('../lib/http');

const app = express();
const PORT = Number(process.env.BOOKING_SERVICE_PORT || 5103);
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL || `http://127.0.0.1:${process.env.INVENTORY_SERVICE_PORT || 5102}`;
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || `http://127.0.0.1:${process.env.PAYMENT_SERVICE_PORT || 5104}`;
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || `http://127.0.0.1:${process.env.NOTIFICATION_SERVICE_PORT || 5106}`;
const TICKET_SECRET = process.env.TICKET_SECRET || process.env.CINEBOOK_AUTH_SECRET || 'local-development-ticket-secret';
const store = createJsonStore('bookings.json', { bookings: [] });
const data = store.get();

app.use(express.json({ limit: '24kb' }));

function ticketCode(bookingId) {
  const signature = crypto.createHmac('sha256', TICKET_SECRET).update(bookingId).digest('base64url');
  return `CINEBOOK:${bookingId}:${signature}`;
}

function verifyTicketCode(code) {
  if (typeof code !== 'string') return null;
  const match = /^CINEBOOK:([a-f0-9-]{36}):([A-Za-z0-9_-]+)$/.exec(code);
  if (!match) return null;
  const expected = crypto.createHmac('sha256', TICKET_SECRET).update(match[1]).digest();
  const actual = Buffer.from(match[2], 'base64url');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
    ? match[1]
    : null;
}

function findShowtime(id) {
  for (const movie of movies) {
    const showtime = movie.showtimes.find((item) => item.id === id);
    if (showtime) return { movie, showtime };
  }
  return null;
}

async function releaseInventory(showtimeId, options) {
  return requestJson(`${INVENTORY_URL}/internal/release`, {
    method: 'POST',
    body: JSON.stringify({ showtimeId, ...options }),
  });
}

app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'booking' }));

app.get('/internal/bookings', (req, res) => {
  const user = readPrincipal(req, res);
  if (!user) return;
  if (user.role !== 'customer') return errorResponse(res, 403, 'Customer account required.');
  const bookings = data.bookings
    .filter((booking) => booking.userId === user.id)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  return res.json({ success: true, bookings });
});

app.post('/internal/bookings', async (req, res) => {
  const user = readPrincipal(req, res);
  if (!user) return;
  if (user.role !== 'customer') return errorResponse(res, 403, 'Customer account required.');

  const { showtimeId, seats, paymentMethod, paymentDetails } = req.body || {};
  if (typeof showtimeId !== 'string' || !Array.isArray(seats) || seats.length < 1 || seats.length > 8) {
    return errorResponse(res, 400, 'Booking details are incomplete.');
  }
  const listing = findShowtime(showtimeId);
  if (!listing) return errorResponse(res, 404, 'Showtime was not found.');

  const holdResult = await requestJson(`${INVENTORY_URL}/internal/hold`, {
    method: 'POST',
    body: JSON.stringify({ showtimeId, seats }),
  });
  if (holdResult.status !== 201) return res.status(holdResult.status).json(holdResult.payload);
  const { holdToken } = holdResult.payload;

  const paymentResult = await requestJson(`${PAYMENT_URL}/internal/authorize`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod, paymentDetails }),
  });
  if (paymentResult.status !== 200) {
    await releaseInventory(showtimeId, { holdToken });
    return res.status(paymentResult.status).json(paymentResult.payload);
  }

  const payment = paymentResult.payload;
  const booking = {
    id: crypto.randomUUID(),
    userId: user.id,
    showtimeId,
    movieId: listing.movie.id,
    movieTitle: listing.movie.title,
    city: listing.showtime.city,
    cinema: listing.showtime.cinema,
    screen: listing.showtime.screen,
    date: listing.showtime.date,
    time: listing.showtime.time,
    seats,
    total: seats.length * listing.showtime.price +
      Math.round(seats.length * listing.showtime.price * 0.05),
    paymentMethod,
    paymentStatus: payment.status,
    transactionId: payment.transactionId,
    contact: payment.contact,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };
  booking.ticketCode = ticketCode(booking.id);
  booking.ticketStatus = payment.status === 'reserved' ? 'reserved' : 'valid';
  try {
    const commitResult = await requestJson(`${INVENTORY_URL}/internal/commit`, {
      method: 'POST',
      body: JSON.stringify({ showtimeId, holdToken }),
    });
    if (commitResult.status !== 200) {
      await releaseInventory(showtimeId, { holdToken });
      return res.status(commitResult.status).json(commitResult.payload);
    }
    data.bookings.push(booking);
    store.save();
  } catch (error) {
    data.bookings = data.bookings.filter((item) => item.id !== booking.id);
    await releaseInventory(showtimeId, { holdToken, seats });
    throw error;
  }

  try {
    await requestJson(`${NOTIFICATION_URL}/internal/notifications`, {
      method: 'POST',
      body: JSON.stringify({
        userId: user.id,
        email: payment.contact.email,
        type: 'booking-confirmed',
        bookingId: booking.id,
        message: `${booking.movieTitle} tickets are ready. Your seats: ${booking.seats.join(', ')}.`,
      }),
    });
  } catch (error) {
    console.error(`Notification delivery failed for booking ${booking.id}:`, error);
  }

  return res.status(201).json({ success: true, booking });
});

app.delete('/internal/bookings/:bookingId', async (req, res) => {
  const user = readPrincipal(req, res);
  if (!user) return;
  const booking = data.bookings.find((item) => item.id === req.params.bookingId);
  if (!booking) return errorResponse(res, 404, 'Ticket was not found.');
  if (user.role !== 'admin' && booking.userId !== user.id) {
    return errorResponse(res, 403, 'You can only cancel your own ticket.');
  }
  if (booking.status === 'cancelled') return errorResponse(res, 409, 'This ticket is already cancelled.');

  const release = await releaseInventory(booking.showtimeId, { seats: booking.seats });
  if (release.status !== 200) return res.status(503).json({ success: false, message: 'Could not release the seats. Please retry.' });
  booking.status = 'cancelled';
  booking.ticketStatus = 'cancelled';
  booking.cancelledAt = new Date().toISOString();
  store.save();
  return res.json({ success: true, booking });
});

app.get('/internal/tickets/verify', (req, res) => {
  const bookingId = verifyTicketCode(req.query.code);
  if (!bookingId) return errorResponse(res, 400, 'Ticket QR code is invalid.');
  const booking = data.bookings.find((item) => item.id === bookingId);
  if (!booking) return errorResponse(res, 404, 'Ticket was not found.');
  if (booking.status === 'cancelled') return errorResponse(res, 410, 'This ticket has been cancelled.');
  return res.json({
    success: true,
    ticket: {
      movieTitle: booking.movieTitle,
      cinema: booking.cinema,
      screen: booking.screen,
      date: booking.date,
      time: booking.time,
      seats: booking.seats,
      status: booking.ticketStatus,
      ticketId: booking.id,
    },
  });
});

app.get('/internal/admin/summary', (_req, res) => {
  const activeBookings = data.bookings.filter((booking) => booking.status === 'confirmed');
  const recentBookings = [...data.bookings]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 30)
    .map(({ ticketCode: _ticketCode, contact: _contact, ...booking }) => booking);
  return res.json({
    success: true,
    bookings: data.bookings.length,
    seatsReserved: activeBookings.reduce((total, booking) => total + booking.seats.length, 0),
    demoSales: activeBookings
      .filter((booking) => booking.paymentStatus === 'demo-paid')
      .reduce((total, booking) => total + booking.total, 0),
    recentBookings,
  });
});

app.use((error, _req, res, _next) => {
  console.error('Booking service error:', error);
  return errorResponse(res, 500, 'Booking service failed. Please try again.');
});

app.listen(PORT, '127.0.0.1', () => console.log(`booking service listening on ${PORT}`));
