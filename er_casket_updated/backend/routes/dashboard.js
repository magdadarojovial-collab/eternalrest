// backend/routes/dashboard.js
// Updated: branch-constrained to Gensan (1) & Bohol (2), categories: wood & metal only
const router = require('express').Router();
const db     = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ── GET /api/dashboard/stats ──────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    const bid          = req.user.branch_id;
    // Scope all queries to fixed branches only
    const branchScope  = isSuperAdmin ? 'branch_id IN (1,2)' : `branch_id = ${db.escape(bid)}`;
    const where        = ' WHERE ' + branchScope;
    const whereAnd     = ' WHERE ' + branchScope + ' AND ';

    const [[casketRow]]  = await db.query(`SELECT COUNT(*) AS total, COALESCE(SUM(stock),0) AS totalStock FROM caskets${where}`);
    const [[resRow]]     = await db.query(`SELECT COUNT(*) AS total FROM reservations${where}`);
    const [[pendingRow]] = await db.query(`SELECT COUNT(*) AS total FROM reservations${whereAnd}status = 'pending'`);
    const [[memRow]]     = await db.query(`SELECT COUNT(*) AS total FROM memorials${where}`);
    const [[userRow]]    = await db.query(isSuperAdmin
      ? 'SELECT COUNT(*) AS total FROM users WHERE branch_id IN (1,2) OR branch_id IS NULL'
      : `SELECT COUNT(*) AS total FROM users WHERE branch_id = ${db.escape(bid)}`
    );

    const [[revenueRow]] = await db.query(
      `SELECT COALESCE(SUM(price_total),0) AS totalRevenue,
              COALESCE(SUM(price_advance),0) AS totalCollected,
              COALESCE(SUM(price_balance),0) AS totalOutstanding
       FROM reservations${whereAnd}payment_status = 'verified'`
    );

    // Monthly revenue (last 6 months)
    const [monthly] = await db.query(
      `SELECT DATE_FORMAT(created_at,'%b %Y') AS month,
              COUNT(*) AS count,
              COALESCE(SUM(price_total),0) AS revenue
       FROM reservations${whereAnd}created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY MIN(created_at) ASC`
    );

    // Inventory by status
    const [inventory] = await db.query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(stock),0) AS totalStock
       FROM caskets${where} GROUP BY status`
    );

    // ── Caskets by category (wood vs metal only) ──────────────
    const [byCategory] = await db.query(
      `SELECT category,
              COUNT(*) AS casket_types,
              COALESCE(SUM(stock),0) AS total_stock,
              COALESCE(AVG(price),0) AS avg_price
       FROM caskets${where} AND category IN ('wood','metal')
       GROUP BY category ORDER BY category`
    );

    // ── Branch summary (2 branches only) ─────────────────────
    let branchSummary = [];
    if (isSuperAdmin) {
      const [brows] = await db.query(`
        SELECT b.id, b.name, b.status,
          (SELECT COUNT(*) FROM reservations r WHERE r.branch_id = b.id) AS reservations,
          (SELECT COUNT(*) FROM reservations r WHERE r.branch_id = b.id AND r.status = 'pending') AS pending,
          (SELECT COUNT(*) FROM caskets c WHERE c.branch_id = b.id) AS caskets,
          (SELECT COALESCE(SUM(c.stock),0) FROM caskets c WHERE c.branch_id = b.id) AS totalStock,
          (SELECT COUNT(*) FROM memorials m WHERE m.branch_id = b.id) AS memorials,
          (SELECT COALESCE(SUM(r.price_total),0) FROM reservations r WHERE r.branch_id = b.id AND r.payment_status='verified') AS revenue,
          (SELECT COUNT(*) FROM caskets c WHERE c.branch_id = b.id AND c.category='wood') AS wood_count,
          (SELECT COUNT(*) FROM caskets c WHERE c.branch_id = b.id AND c.category='metal') AS metal_count
        FROM branches b WHERE b.id IN (1,2) ORDER BY b.id
      `);
      branchSummary = brows;
    }

    res.json({
      success: true,
      data: {
        totalCaskets:        casketRow.total,
        totalStock:          casketRow.totalStock,
        totalReservations:   resRow.total,
        pendingReservations: pendingRow.total,
        totalMemorials:      memRow.total,
        totalUsers:          userRow.total,
        totalRevenue:        revenueRow.totalRevenue,
        totalCollected:      revenueRow.totalCollected,
        totalOutstanding:    revenueRow.totalOutstanding,
        monthly,
        inventory,
        byCategory,   // NEW: wood vs metal breakdown
        branchSummary
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/dashboard/audit ──────────────────────────────────
router.get('/audit', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    let sql = 'SELECT * FROM audit_log';
    const vals = [];
    if (!isSuperAdmin) { sql += ' WHERE branch_id = ?'; vals.push(req.user.branch_id); }
    sql += ' ORDER BY created_at DESC LIMIT 50';
    const [rows] = await db.query(sql, vals);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/dashboard/inventory ─────────────────────────────
router.get('/inventory', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    const bid          = req.user.branch_id;
    // Only wood & metal categories; only 2 fixed branches
    let sql = `SELECT c.*, b.name AS branch_name,
                      (SELECT COUNT(*) FROM casket_inclusions ci WHERE ci.casket_id = c.id) AS inclusions_count
               FROM caskets c
               LEFT JOIN branches b ON b.id = c.branch_id
               WHERE c.category IN ('wood','metal') AND c.branch_id IN (1,2)`;
    const vals = [];
    if (!isSuperAdmin) { sql += ' AND c.branch_id = ?'; vals.push(bid); }
    sql += ' ORDER BY c.branch_id, c.category, c.name';
    const [rows] = await db.query(sql, vals);
    const caskets = rows.map(c => ({
      ...c,
      features: typeof c.features === 'string' ? JSON.parse(c.features) : (c.features || [])
    }));
    res.json({ success: true, data: caskets });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/dashboard/reports ────────────────────────────────
// Comprehensive report filtered by branch (Gensan/Bohol) and category (wood/metal)
router.get('/reports', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    const bid          = req.user.branch_id;
    const { from_date, to_date, branch_id: filterBranch } = req.query;

    // Determine which branch(es) to report on
    let targetBranches;
    if (isSuperAdmin) {
      targetBranches = filterBranch && [1,2].includes(Number(filterBranch))
        ? [Number(filterBranch)]
        : [1, 2];
    } else {
      targetBranches = [bid];
    }

    const branchIn = targetBranches.join(',');
    const dateFrom = from_date || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
    const dateTo   = to_date   || new Date().toISOString().split('T')[0];

    // Reservations by branch + casket category
    const [byCatBranch] = await db.query(`
      SELECT b.name AS branch_name, b.id AS branch_id,
             c.category,
             COUNT(r.id) AS total_reservations,
             COALESCE(SUM(r.price_total),0) AS revenue,
             COALESCE(SUM(r.price_advance),0) AS collected
      FROM reservations r
      JOIN branches b ON b.id = r.branch_id
      LEFT JOIN caskets c ON c.id = r.casket_id
      WHERE r.branch_id IN (${branchIn})
        AND c.category IN ('wood','metal')
        AND DATE(r.created_at) BETWEEN ? AND ?
      GROUP BY b.id, c.category
      ORDER BY b.id, c.category
    `, [dateFrom, dateTo]);

    // Monthly revenue per branch
    const [monthlyPerBranch] = await db.query(`
      SELECT DATE_FORMAT(r.created_at,'%Y-%m') AS month,
             b.name AS branch_name,
             b.id AS branch_id,
             COUNT(r.id) AS count,
             COALESCE(SUM(r.price_total),0) AS revenue
      FROM reservations r
      JOIN branches b ON b.id = r.branch_id
      WHERE r.branch_id IN (${branchIn})
        AND DATE(r.created_at) BETWEEN ? AND ?
      GROUP BY month, b.id ORDER BY month ASC, b.id ASC
    `, [dateFrom, dateTo]);

    // Stock summary by branch + category
    const [stockSummary] = await db.query(`
      SELECT b.name AS branch_name, b.id AS branch_id,
             c.category,
             COUNT(*) AS casket_types,
             COALESCE(SUM(c.stock),0) AS total_stock,
             COALESCE(MIN(c.price),0) AS min_price,
             COALESCE(MAX(c.price),0) AS max_price
      FROM caskets c
      JOIN branches b ON b.id = c.branch_id
      WHERE c.branch_id IN (${branchIn})
        AND c.category IN ('wood','metal')
      GROUP BY b.id, c.category ORDER BY b.id, c.category
    `);

    res.json({ success: true, data: { byCatBranch, monthlyPerBranch, stockSummary, dateFrom, dateTo, branches: targetBranches } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
