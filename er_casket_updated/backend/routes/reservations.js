// backend/routes/reservations.js
const router = require('express').Router();
const db     = require('../config/db');
const { authMiddleware, requireRole, clientAuthOptional } = require('../middleware/auth');

// ── Sanitize helper ───────────────────────────────────────────
function sanitizeStr(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/<[^>]*>/g, '').replace(/['"`;]/g, '').trim().substring(0, 500);
}

// ── POST /api/reservations  – public (index.html form) ───────
router.post('/', clientAuthOptional, async (req, res) => {
  const {
    fname, lname, email, phone,
    client_address, deceased_name, deceased_age, deceased_address,
    burial_time, burial_place,
    casket_id, casket_name, service_date, service_type, notes,
    payment_method, payment_reference, branch_id, client_id,
    price_coffin, price_funeral_car, price_funeral_services,
    price_embalming, price_other, price_advance, price_total, price_balance,
    installment_plan, installment_months, installment_monthly
  } = req.body;

  if (!fname || !lname || !email || !phone)
    return res.status(400).json({ success: false, message: 'Name, email and phone are required.' });

  // Email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });

  // Phone validation (PH format)
  if (!/^\d{10,12}$/.test(phone.replace(/\D/g, '')))
    return res.status(400).json({ success: false, message: 'Please enter a valid phone number.' });

  // Walk-in does not require payment reference
  const isWalkIn = payment_method === 'walkin';
  if (!payment_method)
    return res.status(400).json({ success: false, message: 'Payment method is required.' });
  if (!isWalkIn && (!payment_reference || payment_reference.trim().length < 4))
    return res.status(400).json({ success: false, message: 'Payment reference number is required for online payments.' });

  try {
    const resolvedClientId = req.client?.id || client_id || null;

    const [result] = await db.query(
      `INSERT INTO reservations
       (branch_id, client_id, fname, lname, email, phone,
        client_address, deceased_name, deceased_age, deceased_address,
        burial_time, burial_place,
        casket_id, casket_name, service_date, service_type, notes,
        payment_method, payment_reference, payment_status,
        price_coffin, price_funeral_car, price_funeral_services,
        price_embalming, price_other, price_advance, price_total, price_balance,
        installment_plan, installment_months, installment_monthly)
       VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?, ?,?,?,?,?, ?,?,'pending_verification', ?,?,?, ?,?,?,?,?, ?,?,?)`,
      [
        branch_id || 1, resolvedClientId,
        sanitizeStr(fname), sanitizeStr(lname), email.trim().toLowerCase(), phone.replace(/\D/g,''),
        sanitizeStr(client_address) || null,
        sanitizeStr(deceased_name) || null,
        parseInt(deceased_age) || null,
        sanitizeStr(deceased_address) || null,
        burial_time || null,
        sanitizeStr(burial_place) || null,
        casket_id || null,
        sanitizeStr(casket_name) || null,
        service_date || null,
        service_type || null,
        sanitizeStr(notes) || null,
        payment_method,
        isWalkIn ? 'WALK-IN' : (payment_reference || '').trim(),
        price_coffin || 0, price_funeral_car || 0, price_funeral_services || 0,
        price_embalming || 0, price_other || 0, price_advance || 0,
        price_total || 0, price_balance || 0,
        installment_plan ? 1 : 0,
        installment_months || null,
        installment_monthly || null
      ]
    );

    if (casket_id) {
      await db.query(
        `UPDATE caskets
         SET stock  = GREATEST(stock - 1, 0),
             status = IF(stock - 1 <= 0, 'reserved', IF(stock - 1 = 1, 'limited', 'available'))
         WHERE id = ?`,
        [casket_id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Reservation submitted! Please wait for admin verification. You will be contacted shortly.',
      id: result.insertId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/reservations  (admin) ────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;
    const isSuperAdmin       = req.user.role === 'superadmin';
    let sql    = 'SELECT * FROM reservations WHERE 1=1';
    const vals = [];

    if (!isSuperAdmin) {
      sql += ' AND branch_id = ?';
      vals.push(req.user.branch_id);
    }

    if (status) { sql += ' AND status = ?'; vals.push(status); }
    if (search) {
      sql += ' AND (fname LIKE ? OR lname LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const like = `%${search}%`;
      vals.push(like, like, like, like);
    }
    sql += ' ORDER BY created_at DESC';

    const [rows] = await db.query(sql, vals);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/reservations/analytics (admin/superadmin) ───────
router.get('/analytics', authMiddleware, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    const bid          = req.user.branch_id;

    const branchCond = isSuperAdmin ? '1=1' : `branch_id = ${db.escape(bid)}`;

    // Monthly revenue (last 6 months)
    const [monthly] = await db.query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
             COUNT(*) AS count,
             COALESCE(SUM(price_total),0) AS revenue,
             COALESCE(SUM(price_advance),0) AS collected
      FROM reservations
      WHERE ${branchCond}
        AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month ASC`);

    // By service type
    const [byType] = await db.query(`
      SELECT service_type, COUNT(*) AS count
      FROM reservations WHERE ${branchCond}
      GROUP BY service_type ORDER BY count DESC`);

    // By payment method
    const [byPayment] = await db.query(`
      SELECT payment_method, COUNT(*) AS count
      FROM reservations WHERE ${branchCond}
      GROUP BY payment_method ORDER BY count DESC`);

    // Status breakdown
    const [byStatus] = await db.query(`
      SELECT status, COUNT(*) AS count
      FROM reservations WHERE ${branchCond}
      GROUP BY status`);

    // Total revenue
    const [[totals]] = await db.query(`
      SELECT COALESCE(SUM(price_total),0) AS total_revenue,
             COALESCE(SUM(price_advance),0) AS total_collected,
             COALESCE(SUM(price_balance),0) AS total_outstanding,
             COUNT(*) AS total_reservations
      FROM reservations WHERE ${branchCond}`);

    // Per branch (superadmin only)
    let perBranch = [];
    if (isSuperAdmin) {
      const [pbRows] = await db.query(`
        SELECT b.name AS branch_name, b.id AS branch_id,
               COUNT(r.id) AS reservations,
               COALESCE(SUM(r.price_total),0) AS revenue,
               COALESCE(SUM(r.price_advance),0) AS collected
        FROM branches b
        LEFT JOIN reservations r ON r.branch_id = b.id
        GROUP BY b.id ORDER BY revenue DESC`);
      perBranch = pbRows;
    }

    res.json({ success: true, data: { monthly, byType, byPayment, byStatus, totals, perBranch } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/reservations/:id  (admin) ───────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    let sql = 'SELECT * FROM reservations WHERE id = ?';
    const vals = [req.params.id];
    if (!isSuperAdmin) { sql += ' AND branch_id = ?'; vals.push(req.user.branch_id); }
    const [rows] = await db.query(sql, vals);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/reservations/:id  (admin) ───────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  const { status, payment_status, notes } = req.body;
  try {
    await db.query(
      'UPDATE reservations SET status=?, payment_status=?, notes=?, updated_at=NOW() WHERE id=?',
      [status, payment_status, notes, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/reservations/:id  (admin) ────────────────────
router.delete('/:id', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  try {
    await db.query('DELETE FROM reservations WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
