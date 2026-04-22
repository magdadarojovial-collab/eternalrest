// backend/routes/clients.js
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

// ── Client auth middleware (separate from staff JWT) ──────────
function clientAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'No token provided.' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'client')
      return res.status(403).json({ success: false, message: 'Client access only.' });
    req.client = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
}

// ── POST /api/clients/register ────────────────────────────────
router.post('/register', async (req, res) => {
  const { fname, lname, email, phone, password, address } = req.body;
  if (!fname || !lname || !email || !phone || !password)
    return res.status(400).json({ success: false, message: 'First name, last name, email, phone and password are required.' });
  if (password.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO clients (fname, lname, email, phone, password, address) VALUES (?,?,?,?,?,?)',
      [fname, lname, email, phone, hash, address || null]
    );

    const token = jwt.sign(
      { id: result.insertId, email, fname, lname, role: 'client' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      client: { id: result.insertId, fname, lname, email, phone }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in instead.' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/clients/login ───────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required.' });

  try {
    const [rows] = await db.query(
      'SELECT * FROM clients WHERE email = ? AND status = "active" LIMIT 1',
      [email]
    );
    if (!rows.length)
      return res.status(401).json({ success: false, message: 'No account found with this email.' });

    const client = rows[0];
    const match  = await bcrypt.compare(password, client.password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Incorrect password.' });

    await db.query('UPDATE clients SET last_login = NOW() WHERE id = ?', [client.id]);

    const token = jwt.sign(
      { id: client.id, email: client.email, fname: client.fname, lname: client.lname, role: 'client' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      client: {
        id:    client.id,
        fname: client.fname,
        lname: client.lname,
        email: client.email,
        phone: client.phone,
        address: client.address
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/clients/me ───────────────────────────────────────
router.get('/me', clientAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, fname, lname, email, phone, address, created_at FROM clients WHERE id = ?',
      [req.client.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Client not found.' });
    res.json({ success: true, client: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/clients/reservations ─────────────────────────────
router.get('/reservations', clientAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, casket_name, service_date, service_type, deceased_name,
              payment_method, payment_reference, payment_status,
              status, price_total, price_advance, price_balance,
              installment_plan, installment_months, installment_monthly,
              created_at, branch_id
       FROM reservations
       WHERE client_id = ?
       ORDER BY created_at DESC`,
      [req.client.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/clients/profile ──────────────────────────────────
router.put('/profile', clientAuth, async (req, res) => {
  const { fname, lname, email, phone, address } = req.body;
  if (!fname || !lname || !email || !phone)
    return res.status(400).json({ success: false, message: 'First name, last name, email and phone are required.' });

  try {
    // Check if email is taken by another client
    const [existing] = await db.query(
      'SELECT id FROM clients WHERE email = ? AND id != ?',
      [email.toLowerCase(), req.client.id]
    );
    if (existing.length)
      return res.status(409).json({ success: false, message: 'This email is already used by another account.' });

    await db.query(
      'UPDATE clients SET fname=?, lname=?, email=?, phone=?, address=? WHERE id=?',
      [fname, lname, email.toLowerCase(), phone, address || null, req.client.id]
    );
    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/clients/change-password ─────────────────────────
router.put('/change-password', clientAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
  if (newPassword.length < 6)
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });

  try {
    const [rows] = await db.query('SELECT password FROM clients WHERE id = ?', [req.client.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Client not found.' });

    const match = await bcrypt.compare(currentPassword, rows[0].password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE clients SET password = ? WHERE id = ?', [hash, req.client.id]);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;