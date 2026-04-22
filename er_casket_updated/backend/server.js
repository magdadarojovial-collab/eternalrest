// backend/server.js
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const authRoutes        = require('./routes/auth');
const casketRoutes      = require('./routes/caskets');
const reservationRoutes = require('./routes/reservations');
const memorialRoutes    = require('./routes/memorials');
const userRoutes        = require('./routes/users');
const dashboardRoutes   = require('./routes/dashboard');
const branchRoutes      = require('./routes/branches');
const clientRoutes      = require('./routes/clients');
const messageRoutes     = require('./routes/messages');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Ensure uploads folder exists ──────────────────────────────
const uploadsDir = path.join(__dirname, '../public/uploads/caskets');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5500')
  .split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman)
    // Also allow null origin which happens when opening HTML files directly via file://
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // In development, log but don't block unknown origins
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[CORS] Unrecognised origin: ${origin} — allowing in development mode.`);
      return cb(null, true);
    }
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files (public + uploads) ──────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/caskets',      casketRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/memorials',    memorialRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/branches',     branchRoutes);
app.use('/api/clients',      clientRoutes);
app.use('/api/messages',     messageRoutes);

// ── Friendly URL shortcuts ────────────────────────────────────
// These allow clean URLs like yourdomain.com/admin or /superadmin
// instead of requiring the full .html extension
app.get('/login',      (_, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/admin',      (_, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));
app.get('/superadmin', (_, res) => res.sendFile(path.join(__dirname, '../public/superadmin.html')));
app.get('/memorial',   (_, res) => res.sendFile(path.join(__dirname, '../public/memorial.html')));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// ── 404 handler ───────────────────────────────────────────────
// API routes return JSON 404; all other routes serve index.html (public site)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Route not found.' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Eternal Rest API running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Uploads     : ${uploadsDir}\n`);
});