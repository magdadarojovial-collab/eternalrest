// backend/routes/users.js
const router = require('express').Router();
const bcrypt = require('bcrypt');
const db     = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);

// ── GET /api/users  ───────────────────────────────────────────
// Superadmin → all users; Admin → users in their branch only
router.get('/', requireRole('admin','superadmin'), async (req, res) => {
  try {
    let sql    = `SELECT u.id, u.fname, u.lname, u.username, u.email, u.role,
                         u.branch_id, b.name AS branch_name,
                         u.status, u.last_login, u.created_at
                  FROM users u
                  LEFT JOIN branches b ON b.id = u.branch_id`;
    const vals = [];

    if (req.user.role !== 'superadmin') {
      sql += ' WHERE u.branch_id = ?';
      vals.push(req.user.branch_id);
    }
    sql += ' ORDER BY u.id';

    const [rows] = await db.query(sql, vals);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/users  (superadmin only) ───────────────────────
router.post('/', requireRole('superadmin'), async (req, res) => {
  const { fname, lname, username, email, password, role, branch_id } = req.body;
  if (!fname || !username || !email || !password)
    return res.status(400).json({ success: false, message: 'All fields required.' });

  // Superadmin must not have a branch_id; admins/staff must have one
  const assignedBranch = (role === 'superadmin') ? null : (branch_id || null);

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (fname, lname, username, email, password, role, branch_id) VALUES (?,?,?,?,?,?,?)',
      [fname, lname || '', username, email, hash, role || 'staff', assignedBranch]
    );
    await db.query(
      'INSERT INTO audit_log (user, action, details, ip) VALUES (?,?,?,?)',
      [req.user.username, 'USER_CREATE', `Created user: @${username} (${role}) branch#${assignedBranch || 'none'}`, req.ip]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Username or email already exists.' });
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/users/:id  (superadmin only) ─────────────────────
router.put('/:id', requireRole('superadmin'), async (req, res) => {
  const { fname, lname, email, role, branch_id, status } = req.body;
  try {
    await db.query(
      'UPDATE users SET fname=?, lname=?, email=?, role=?, branch_id=?, status=? WHERE id=?',
      [fname, lname, email, role, branch_id || null, status || 'active', req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/users/:id/status  (superadmin only) ─────────────
router.put('/:id/status', requireRole('superadmin'), async (req, res) => {
  const { status } = req.body;
  if (!['active','inactive'].includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  try {
    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/users/:id/password  (superadmin only) ───────────
router.put('/:id/password', requireRole('superadmin'), async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.params.id]);
    await db.query(
      'INSERT INTO audit_log (user, action, details, ip) VALUES (?,?,?,?)',
      [req.user.username, 'PASSWORD_RESET', `Reset password for user #${req.params.id}`, req.ip]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/users/:id  (superadmin only) ─────────────────
router.delete('/:id', requireRole('superadmin'), async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
  try {
    const [rows] = await db.query('SELECT username, role FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    if (rows[0].role === 'superadmin')
      return res.status(403).json({ success: false, message: 'Cannot delete system administrators.' });

    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    await db.query(
      'INSERT INTO audit_log (user, action, details, ip) VALUES (?,?,?,?)',
      [req.user.username, 'USER_DELETE', `Deleted user: @${rows[0].username}`, req.ip]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
