const crypto = require('node:crypto');
const express = require('express');
const { createJsonStore } = require('../lib/json-store');
const { errorResponse } = require('../lib/http');

const app = express();
const PORT = Number(process.env.NOTIFICATION_SERVICE_PORT || 5106);
const store = createJsonStore('notifications.json', { messages: [] });
const data = store.get();

app.use(express.json({ limit: '12kb' }));

app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'notifications' }));

app.post('/internal/notifications', (req, res) => {
  const { userId, email, type, bookingId, message } = req.body || {};
  if (![userId, email, type, bookingId, message].every((value) => typeof value === 'string' && value.length)) {
    return errorResponse(res, 400, 'Notification details are incomplete.');
  }
  const notification = {
    id: crypto.randomUUID(),
    userId,
    email,
    type,
    bookingId,
    message,
    delivery: 'in-app-demo',
    createdAt: new Date().toISOString(),
  };
  data.messages.push(notification);
  store.save();
  return res.status(201).json({ success: true, notification });
});

app.get('/internal/notifications/:userId', (req, res) => {
  const messages = data.messages.filter((message) => message.userId === req.params.userId);
  return res.json({ success: true, notifications: messages });
});

app.listen(PORT, '127.0.0.1', () => console.log(`notification service listening on ${PORT}`));
