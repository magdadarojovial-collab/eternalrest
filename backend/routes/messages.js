// backend/routes/messages.js
// Inventory Communication – Admin ↔ Super Admin chatbox
// FIX: SA replies now tagged with target branch_id so admins can see them
const router = require('express').Router();
const db     = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);
router.use(requireRole('admin', 'superadmin'));

// ── GET /api/messages  ────────────────────────────────────────
// Admin: sees all messages for their branch (both sent by them AND SA replies to their branch)
// SuperAdmin: sees all messages, optionally filtered by branch_id
router.get('/', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    const { branch_id } = req.query;

    let sql = `
      SELECT m.*,
             u.fname, u.lname, u.username, u.role AS user_role,
             b.name AS branch_name
      FROM inventory_messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN branches b ON b.id = m.branch_id
      WHERE 1=1
    `;
    const vals = [];

    if (!isSuperAdmin) {
      // Admin sees: messages from their branch AND superadmin replies to their branch
      sql += ' AND m.branch_id = ?';
      vals.push(req.user.branch_id);
    } else if (branch_id) {
      // SuperAdmin filtered by specific branch
      sql += ' AND m.branch_id = ?';
      vals.push(branch_id);
    }
    // SuperAdmin with no filter sees all messages

    sql += ' ORDER BY m.created_at ASC';
    const [rows] = await db.query(sql, vals);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/messages/unread-count  ──────────────────────────
router.get('/unread-count', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    let sql, vals;

    if (isSuperAdmin) {
      // SA counts unread messages sent BY admins
      sql  = "SELECT COUNT(*) AS cnt FROM inventory_messages WHERE status='unread' AND sender_role='admin'";
      vals = [];
    } else {
      // Admin counts unread SA replies addressed to their branch
      sql  = "SELECT COUNT(*) AS cnt FROM inventory_messages WHERE status='unread' AND sender_role='superadmin' AND branch_id=?";
      vals = [req.user.branch_id];
    }

    const [[{ cnt }]] = await db.query(sql, vals);
    res.json({ success: true, unread: cnt });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/messages  ───────────────────────────────────────
// KEY FIX: SuperAdmin must pass target_branch_id so the reply appears in the correct branch thread.
// Admin sends: branch_id = their branch (automatic)
// SA replies:  branch_id = target_branch_id from request body
router.post('/', async (req, res) => {
  const { message, msg_type, target_branch_id } = req.body;
  if (!message || !message.trim())
    return res.status(400).json({ success: false, message: 'Message cannot be empty.' });

  const sender_id   = req.user.id;
  const sender_role = req.user.role;
  const type        = ['request','reply','info'].includes(msg_type) ? msg_type : 'info';

  // For admin: use their own branch_id
  // For superadmin: use the target_branch_id they pass (which branch they are replying to)
  let branch_id;
  if (sender_role === 'superadmin') {
    if (!target_branch_id || ![1, 2].includes(Number(target_branch_id))) {
      return res.status(400).json({ success: false, message: 'SuperAdmin must specify a valid target_branch_id (1 or 2) when sending a message.' });
    }
    branch_id = Number(target_branch_id);
  } else {
    branch_id = req.user.branch_id || null;
  }

  try {
    const [result] = await db.query(
      `INSERT INTO inventory_messages (sender_id, sender_role, branch_id, message, msg_type)
       VALUES (?, ?, ?, ?, ?)`,
      [sender_id, sender_role, branch_id, message.trim(), type]
    );
    const [rows] = await db.query(
      `SELECT m.*, u.fname, u.lname, u.username, u.role AS user_role, b.name AS branch_name
       FROM inventory_messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN branches b ON b.id = m.branch_id
       WHERE m.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/messages/mark-read  ─────────────────────────────
router.put('/mark-read', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    const { branch_id } = req.body;
    let sql, vals;

    if (isSuperAdmin) {
      if (branch_id) {
        sql  = "UPDATE inventory_messages SET status='read' WHERE sender_role='admin' AND branch_id=? AND status='unread'";
        vals = [branch_id];
      } else {
        sql  = "UPDATE inventory_messages SET status='read' WHERE sender_role='admin' AND status='unread'";
        vals = [];
      }
    } else {
      // Admin marks SA replies for their branch as read
      sql  = "UPDATE inventory_messages SET status='read' WHERE sender_role='superadmin' AND branch_id=? AND status='unread'";
      vals = [req.user.branch_id];
    }

    await db.query(sql, vals);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
