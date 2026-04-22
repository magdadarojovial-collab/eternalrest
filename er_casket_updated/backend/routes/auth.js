// backend/routes/auth.js
const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Username and password required.' });

  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND status = "active" LIMIT 1',
      [username, username]
    );
    if (!rows.length)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Fetch branch name if assigned
    let branch_name = null;
    if (user.branch_id) {
      const [[br]] = await db.query('SELECT name FROM branches WHERE id = ?', [user.branch_id]);
      if (br) branch_name = br.name;
    }

    await db.query(
      'INSERT INTO audit_log (branch_id, user, action, details, ip) VALUES (?,?,?,?,?)',
      [user.branch_id || null, user.username, 'LOGIN', 'Successful login', req.ip]
    );

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fname: user.fname, branch_id: user.branch_id || null },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fname: user.fname,
        lname: user.lname,
        username: user.username,
        role: user.role,
        branch_id: user.branch_id || null,
        branch_name
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.fname, u.lname, u.username, u.email, u.role, u.status, u.last_login,
              u.branch_id, b.name AS branch_name
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
