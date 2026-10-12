const crypto = require('node:crypto');
const express = require('express');
const { errorResponse } = require('../lib/http');

const app = express();
const PORT = Number(process.env.PAYMENT_SERVICE_PORT || 5104);
const methods = new Set(['Demo card', 'Demo UPI', 'Demo net banking', 'Pay at venue']);

app.use(express.json({ limit: '16kb' }));

app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'payment-simulator' }));

app.post('/internal/authorize', (req, res) => {
  const { paymentMethod, paymentDetails } = req.body || {};
  const { fullName, email, phone, demoInput } = paymentDetails || {};
  if (!methods.has(paymentMethod)) return errorResponse(res, 400, 'Choose a valid demo payment method.');
  if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 80) {
    return errorResponse(res, 400, 'Enter the ticket holder name.');
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(res, 400, 'Enter a valid ticket delivery email.');
  }
  const digits = typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
  if (digits.length < 10 || digits.length > 15) return errorResponse(res, 400, 'Enter a valid phone number.');

  if (paymentMethod === 'Demo card' && demoInput !== '4242 4242 4242 4242') {
    return errorResponse(res, 400, 'Use the displayed demo-only test card number.');
  }
  if (paymentMethod === 'Demo UPI' && (typeof demoInput !== 'string' || !/^[\w.-]+@demo$/.test(demoInput))) {
    return errorResponse(res, 400, 'Use a demo UPI handle ending in @demo.');
  }
  if (paymentMethod === 'Demo net banking' && !['Demo National Bank', 'Demo City Bank', 'Demo Union Bank'].includes(demoInput)) {
    return errorResponse(res, 400, 'Select one of the listed demo banks.');
  }
  if (paymentMethod === 'Pay at venue') {
    return res.json({
      success: true,
      status: 'reserved',
      transactionId: `VENUE-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
      contact: { fullName: fullName.trim(), email: email.toLowerCase(), phone: digits },
    });
  }
  return res.json({
    success: true,
    status: 'demo-paid',
    transactionId: `DEMO-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
    contact: { fullName: fullName.trim(), email: email.toLowerCase(), phone: digits },
  });
});

app.use((error, _req, res, _next) => {
  console.error('Payment simulator error:', error);
  return errorResponse(res, 500, 'Demo payment service failed.');
});

app.listen(PORT, '127.0.0.1', () => console.log(`payment simulator listening on ${PORT}`));
