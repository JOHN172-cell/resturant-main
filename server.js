const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4173;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000;
const adminSessions = new Map();

// Keep credentials and all provider secrets out of frontend JavaScript.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin123';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const hasMailConfig = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
const hasSmsConfig = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
const mailer = hasMailConfig ? require('nodemailer').createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;
const twilioClient = hasSmsConfig
  ? require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Ensure data directory and db.json exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultData = {
  menu: [
    { id: 'carrots', name: 'Charred carrots', category: 'Starter', cuisine: 'Continental', price: 12, description: 'whipped feta, sumac, pistachio', image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=400&q=80' },
    { id: 'oysters', name: 'Ember oysters', category: 'Starter', cuisine: 'Continental', price: 18, description: 'cider mignonette, smoked chili', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80' },
    { id: 'chicken', name: 'Coal-roasted chicken', category: 'Main', cuisine: 'Continental', price: 28, description: 'preserved lemon, chicken jus', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80' },
    { id: 'steak', name: 'Hanger steak', category: 'Main', cuisine: 'Continental', price: 34, description: 'green peppercorn, crispy potato', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80' },
    { id: 'panna', name: 'Burnt honey panna cotta', category: 'Dessert', cuisine: 'Continental', price: 11, description: 'rhubarb, oat crumble', image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=400&q=80' },
    { id: 'spritz', name: 'Salted grapefruit spritz', category: 'Drink', cuisine: 'Local drinks', price: 14, description: 'grapefruit, fino sherry, bubbles', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=400&q=80' }
  ],
  availability: {
    carrots: true,
    oysters: true,
    chicken: true,
    steak: true,
    panna: true,
    spritz: true
  },
  // This is deliberately stored in the database file, not in a session or
  // process variable, so it survives restarts, logouts and reboots.
  kitchenActive: true,
  orders: [],
  reservations: []
};

function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      // One-time migration for installations created before the kitchen
      // setting was introduced. Keep the legacy field in sync for now.
      if (typeof parsed.kitchenActive !== 'boolean') {
        parsed.kitchenActive = parsed.serviceActive !== false;
        parsed.serviceActive = parsed.kitchenActive;
        writeDB(parsed);
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading DB file:', err);
  }
  writeDB(defaultData);
  return defaultData;
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing DB file:', err);
  }
}

function getAdminToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function requireAdmin(req, res, next) {
  const token = getAdminToken(req);
  const session = token && adminSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) adminSessions.delete(token);
    return res.status(401).json({ error: 'Admin authentication is required.' });
  }
  session.expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  req.adminSession = { token, ...session };
  next();
}

function reservationMessage(reservation) {
  return `Hello ${reservation.name}, your Taste Africa reservation for ${reservation.party || 'your party'} on ${reservation.date} at ${reservation.time} is confirmed. We look forward to welcoming you!`;
}

function reservationReceivedMessage(reservation) {
  return `Hello ${reservation.name}, we received your Taste Africa reservation request for ${reservation.date} at ${reservation.time}. Your reservation will be confirmed soon.`;
}

async function sendReservationReceivedSms(reservation) {
  if (!reservation.phone) return 'not-requested';
  if (!twilioClient) return 'not-configured';
  try {
    await twilioClient.messages.create({
      body: reservationReceivedMessage(reservation),
      from: process.env.TWILIO_FROM_NUMBER,
      to: reservation.phone
    });
    return 'sent';
  } catch (error) {
    console.error('Reservation request SMS failed:', error.message);
    return 'failed';
  }
}

async function sendConfirmationNotifications(reservation) {
  const message = reservationMessage(reservation);
  const results = { email: 'not-requested', sms: 'not-requested' };
  const tasks = [];
  if (reservation.email) {
    if (!mailer) results.email = 'not-configured';
    else tasks.push(mailer.sendMail({ from: process.env.SMTP_FROM, to: reservation.email, subject: 'Your Taste Africa reservation is confirmed', text: message })
      .then(() => { results.email = 'sent'; })
      .catch(error => { results.email = `failed: ${error.message}`; }));
  }
  if (reservation.phone) {
    if (!twilioClient) results.sms = 'not-configured';
    else tasks.push(twilioClient.messages.create({ body: message, from: process.env.TWILIO_FROM_NUMBER, to: reservation.phone })
      .then(() => { results.sms = 'sent'; })
      .catch(error => { results.sms = `failed: ${error.message}`; }));
  }
  await Promise.all(tasks);
  return results;
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve the same public frontend directory used by Vercel's CDN.
app.use(express.static(path.join(__dirname, 'public')));

// --- API ENDPOINTS ---

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'Taste Africa Node Backend', timestamp: new Date().toISOString() });
});

// Sessions exist only in server memory: restarting the server invalidates every
// session. The browser stores the token in sessionStorage, never localStorage.
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  const token = crypto.randomUUID();
  adminSessions.set(token, { username, expiresAt: Date.now() + ADMIN_SESSION_TTL_MS });
  res.json({ token, expiresIn: ADMIN_SESSION_TTL_MS });
});

app.post('/api/auth/logout', requireAdmin, (req, res) => {
  adminSessions.delete(req.adminSession.token);
  res.status(204).end();
});

// GET Menu Items
app.get('/api/menu', (req, res) => {
  const db = readDB();
  res.json(db.menu || []);
});

// POST Add or Update Menu Item
app.post('/api/menu', requireAdmin, (req, res) => {
  const db = readDB();
  const newItem = req.body;
  if (!newItem || !newItem.id || !newItem.name) {
    return res.status(400).json({ error: 'Item must contain at least an id and a name' });
  }

  const existingIndex = db.menu.findIndex(item => item.id === newItem.id);
  if (existingIndex >= 0) {
    db.menu[existingIndex] = { ...db.menu[existingIndex], ...newItem };
  } else {
    db.menu.push(newItem);
  }
  if (db.availability[newItem.id] === undefined) {
    db.availability[newItem.id] = true;
  }
  writeDB(db);
  res.json({ success: true, item: newItem, menu: db.menu });
});

// DELETE Menu Item
app.delete('/api/menu/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDB();
  db.menu = db.menu.filter(item => item.id !== id);
  delete db.availability[id];
  writeDB(db);
  res.json({ success: true, id, menu: db.menu });
});

// GET Availability Map
app.get('/api/availability', (req, res) => {
  const db = readDB();
  res.json(db.availability || {});
});

// POST Toggle/Update Availability
app.post('/api/availability', requireAdmin, (req, res) => {
  const db = readDB();
  const { id, available } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  db.availability[id] = available !== undefined ? Boolean(available) : !db.availability[id];
  writeDB(db);
  res.json({ success: true, availability: db.availability });
});

function kitchenIsOpen(db) {
  return db.kitchenActive !== false;
}

function setKitchenActivity(db, open) {
  db.kitchenActive = open;
  // Kept for existing customer pages that use /api/service.
  db.serviceActive = open;
  writeDB(db);
}

// Kitchen activity is shared by staff and customers, so a closed kitchen
// blocks orders even when the customer is using another device.
app.get('/api/kitchen-activity', (req, res) => {
  const db = readDB();
  res.json({ open: kitchenIsOpen(db) });
});

app.put('/api/kitchen-activity', requireAdmin, (req, res) => {
  if (typeof req.body?.open !== 'boolean') {
    return res.status(400).json({ error: 'Kitchen activity must be true or false.' });
  }
  const db = readDB();
  setKitchenActivity(db, req.body.open);
  res.json({ success: true, open: db.kitchenActive });
});

// Compatibility API used by the existing customer ordering pages.
app.get('/api/service', (req, res) => {
  const db = readDB();
  res.json({ active: kitchenIsOpen(db) });
});

app.post('/api/service', requireAdmin, (req, res) => {
  if (typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ error: 'Service status must be true or false.' });
  }
  const db = readDB();
  setKitchenActivity(db, req.body.active);
  res.json({ success: true, active: db.kitchenActive });
});

// GET Orders
app.get('/api/orders', (req, res) => {
  const db = readDB();
  res.json(db.orders || []);
});

// POST New Order
app.post('/api/orders', (req, res) => {
  const db = readDB();
  if (!kitchenIsOpen(db)) {
    return res.status(503).json({
      error: 'We are currently closed for orders. Please try again between 9:00 AM and 10:00 PM.'
    });
  }
  const customer = req.body?.customer;
  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: 'Customer name and phone number are required.' });
  }
  const newOrder = {
    id: `order-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'new',
    ...req.body
  };
  db.orders.push(newOrder);
  writeDB(db);
  res.json({ success: true, order: newOrder });
});

// PUT Update Order Status
app.put('/api/orders/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const db = readDB();
  const order = db.orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  
  order.status = status || order.status;
  writeDB(db);
  res.json({ success: true, order });
});

// DELETE Order
app.delete('/api/orders/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDB();
  db.orders = db.orders.filter(o => o.id !== id);
  writeDB(db);
  res.json({ success: true, id });
});

// GET Reservations
app.get('/api/reservations', requireAdmin, (req, res) => {
  const db = readDB();
  res.json(db.reservations || []);
});

// POST New Reservation
app.post('/api/reservations', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').replace(/[\s()-]/g, '');
  const date = String(req.body?.date || '').trim();
  const time = String(req.body?.time || '').trim();
  if (!name || !date || !time || !phone) {
    return res.status(400).json({ error: 'Name, phone number, date, and time are required.' });
  }
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    return res.status(400).json({ error: 'Use an international phone number, for example +233503658302.' });
  }
  const db = readDB();
  const newReservation = {
    id: `reservation-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...req.body,
    name,
    phone,
    date,
    time,
    status: 'pending'
  };
  const sms = await sendReservationReceivedSms(newReservation);
  newReservation.notificationStatus = { reservationReceivedSms: sms };
  db.reservations.push(newReservation);
  writeDB(db);
  res.status(201).json({ success: true, reservation: newReservation, sms });
});

// PUT Update Reservation Status
app.put('/api/reservations/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const db = readDB();
  const reservation = db.reservations.find(r => r.id === id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  reservation.status = status || reservation.status;
  writeDB(db);
  res.json({ success: true, reservation });
});

app.delete('/api/reservations/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const before = db.reservations.length;
  db.reservations = db.reservations.filter(item => item.id !== req.params.id);
  if (db.reservations.length === before) return res.status(404).json({ error: 'Reservation not found.' });
  writeDB(db);
  res.json({ success: true, id: req.params.id });
});

// Confirmation is intentionally separate from a generic status update so the
// notification dispatch always happens from a single, auditable admin action.
app.post('/api/reservations/:id/confirm', requireAdmin, async (req, res) => {
  const db = readDB();
  const reservation = db.reservations.find(item => item.id === req.params.id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found.' });

  reservation.status = 'confirmed';
  const notifications = await sendConfirmationNotifications(reservation);
  reservation.confirmedAt = new Date().toISOString();
  reservation.notificationStatus = notifications;
  writeDB(db);
  res.json({ success: true, reservation, notifications });
});

// Fallback to the public homepage for unknown SPA routes.
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Taste Africa Express Backend server running on http://localhost:${PORT}`);
});
