const crypto = require('node:crypto');
const express = require('express');
const { createStore } = require('../lib/store');
const { errorResponse, startService } = require('../lib/http');

const app = express();
const PORT = Number(process.env.NOTIFICATION_SERVICE_PORT || 5106);
const store = createStore('notifications.json', { messages: [] });
const data = store.get();

app.use(express.json({ limit: '12kb' }));

app.get('/health', async (_req, res) => {
  await store.health();
  return res.json({ status: 'healthy', service: 'notifications' });
});

app.post('/internal/notifications', async (req, res) => {
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
  await store.save();
  return res.status(201).json({ success: true, notification });
});

app.get('/internal/notifications/:userId', (req, res) => {
  const messages = data.messages.filter((message) => message.userId === req.params.userId);
  return res.json({ success: true, notifications: messages });
});

startService(app, PORT, 'notifications', [store.ready]);
