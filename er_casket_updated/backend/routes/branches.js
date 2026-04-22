// backend/routes/branches.js
// Branch Management – locked to 2 fixed branches (Gensan & Bohol)
const router = require('express').Router();
const db     = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const FIXED_BRANCH_IDS = [1, 2]; // General Santos, Bohol – immutable

// ── GET /api/branches  – public ──────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM branches WHERE id IN (1,2) ORDER BY id');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/branches/transfer  – stock transfer (superadmin) ─
router.post('/transfer', authMiddleware, requireRole('superadmin'), async (req, res) => {
  const { casket_id, from_branch_id, to_branch_id, quantity, notes } = req.body;
  if (!casket_id || !from_branch_id || !to_branch_id || !quantity)
    return res.status(400).json({ success: false, message: 'casket_id, from_branch_id, to_branch_id, quantity are required.' });
  if (!FIXED_BRANCH_IDS.includes(Number(from_branch_id)) || !FIXED_BRANCH_IDS.includes(Number(to_branch_id)))
    return res.status(400).json({ success: false, message: 'Invalid branch. Only Gensan and Bohol are supported.' });
  if (Number(from_branch_id) === Number(to_branch_id))
    return res.status(400).json({ success: false, message: 'Source and destination branches must be different.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[src]] = await conn.query('SELECT stock, name FROM caskets WHERE id = ? AND branch_id = ? FOR UPDATE',[casket_id, from_branch_id]);
    if (!src) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Casket not found in source branch.' }); }
    if (src.stock < quantity) { await conn.rollback(); return res.status(400).json({ success: false, message: `Insufficient stock. Available: ${src.stock}` }); }
    await conn.query(`UPDATE caskets SET stock=stock-?,status=IF(stock-?<=0,'reserved',IF(stock-?=1,'limited','available')) WHERE id=? AND branch_id=?`,[quantity,quantity,quantity,casket_id,from_branch_id]);
    const [[dest]] = await conn.query('SELECT id FROM caskets WHERE id=? AND branch_id=?',[casket_id,to_branch_id]);
    if (dest) {
      await conn.query(`UPDATE caskets SET stock=stock+?,status=IF(stock+?>=3,'available',IF(stock+?=1,'limited','available')) WHERE id=? AND branch_id=?`,[quantity,quantity,quantity,casket_id,to_branch_id]);
    } else {
      await conn.query(`INSERT INTO caskets(branch_id,name,category,material,price,stock,status,description,features) SELECT ?,name,category,material,price,?,'available',description,features FROM caskets WHERE id=?`,[to_branch_id,quantity,casket_id]);
    }
    await conn.query('INSERT INTO inventory_transfers(casket_id,from_branch_id,to_branch_id,quantity,transferred_by,notes)VALUES(?,?,?,?,?,?)',[casket_id,from_branch_id,to_branch_id,quantity,req.user.username,notes||null]);
    await conn.query('INSERT INTO audit_log(user,action,details,ip)VALUES(?,?,?,?)',[req.user.username,'INVENTORY_TRANSFER',`Transferred ${quantity}x ${src.name} from branch #${from_branch_id} to #${to_branch_id}`,req.ip]);
    await conn.commit();
    res.json({ success: true, message: `Transferred ${quantity} unit(s) of ${src.name} successfully.` });
  } catch (err) {
    await conn.rollback(); console.error(err);
    res.status(500).json({ success: false, message: 'Transfer failed.' });
  } finally { conn.release(); }
});


// ── GET /api/branches/transfers  – list all transfer history ─
router.get('/transfers', authMiddleware, requireRole('superadmin'), async (req, res) => {
  const { branch_id } = req.query;
  try {
    let sql = `
      SELECT t.*,
             c.name  AS casket_name,
             bf.name AS from_branch,
             bt.name AS to_branch
      FROM inventory_transfers t
      LEFT JOIN caskets  c  ON c.id  = t.casket_id
      LEFT JOIN branches bf ON bf.id = t.from_branch_id
      LEFT JOIN branches bt ON bt.id = t.to_branch_id
      WHERE (t.from_branch_id IN (1,2) OR t.to_branch_id IN (1,2))
    `;
    const vals = [];
    if (branch_id && [1,2].includes(Number(branch_id))) {
      sql += ' AND (t.from_branch_id = ? OR t.to_branch_id = ?)';
      vals.push(branch_id, branch_id);
    }
    sql += ' ORDER BY t.created_at DESC LIMIT 100';
    const [rows] = await db.query(sql, vals);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
// ── GET /api/branches/:id/stats ───────────────────────────────
router.get('/:id/stats', authMiddleware, requireRole('superadmin'), async (req, res) => {
  const bid = req.params.id;
  if (!FIXED_BRANCH_IDS.includes(Number(bid))) return res.status(404).json({ success: false, message: 'Branch not found.' });
  try {
    const [[cr]] = await db.query('SELECT COUNT(*) AS t FROM caskets WHERE branch_id=?',[bid]);
    const [[rr]] = await db.query('SELECT COUNT(*) AS t FROM reservations WHERE branch_id=?',[bid]);
    const [[pr]] = await db.query('SELECT COUNT(*) AS t FROM reservations WHERE branch_id=? AND status="pending"',[bid]);
    const [[mr]] = await db.query('SELECT COUNT(*) AS t FROM memorials WHERE branch_id=?',[bid]);
    const [[ur]] = await db.query('SELECT COUNT(*) AS t FROM users WHERE branch_id=?',[bid]);
    const [[rv]] = await db.query('SELECT IFNULL(SUM(price_total),0) AS revenue FROM reservations WHERE branch_id=? AND status IN("confirmed","completed")',[bid]);
    res.json({ success:true, data:{ totalCaskets:cr.t,totalReservations:rr.t,pendingReservations:pr.t,totalMemorials:mr.t,totalUsers:ur.t,totalRevenue:rv.revenue } });
  } catch(err){ res.status(500).json({success:false,message:'Server error.'}); }
});

// ── GET /api/branches/:id/reservations ───────────────────────
router.get('/:id/reservations', authMiddleware, requireRole('superadmin'), async (req, res) => {
  if (!FIXED_BRANCH_IDS.includes(Number(req.params.id))) return res.status(404).json({ success: false, message: 'Branch not found.' });
  try {
    const [rows] = await db.query('SELECT * FROM reservations WHERE branch_id=? ORDER BY created_at DESC LIMIT 20',[req.params.id]);
    res.json({ success:true, data:rows });
  } catch(err){ res.status(500).json({success:false,message:'Server error.'}); }
});

// ── GET /api/branches/:id/caskets ────────────────────────────
router.get('/:id/caskets', authMiddleware, requireRole('superadmin'), async (req, res) => {
  if (!FIXED_BRANCH_IDS.includes(Number(req.params.id))) return res.status(404).json({ success: false, message: 'Branch not found.' });
  try {
    const [rows] = await db.query('SELECT * FROM caskets WHERE branch_id=? ORDER BY id',[req.params.id]);
    // Fetch inclusions separately
    const ids = rows.map(r=>r.id);
    let inclMap = {};
    if(ids.length){
      const [incl] = await db.query('SELECT * FROM casket_inclusions WHERE casket_id IN(?)',[ids]);
      incl.forEach(i=>{ if(!inclMap[i.casket_id]) inclMap[i.casket_id]=[]; inclMap[i.casket_id].push(i); });
    }
    const caskets = rows.map(c=>({...c,features:typeof c.features==='string'?JSON.parse(c.features):(c.features||[]),inclusions:inclMap[c.id]||[]}));
    res.json({ success:true, data:caskets });
  } catch(err){ console.error(err); res.status(500).json({success:false,message:'Server error.'}); }
});

// ── GET /api/branches/:id/audit ───────────────────────────────
router.get('/:id/audit', authMiddleware, requireRole('superadmin'), async (req, res) => {
  if (!FIXED_BRANCH_IDS.includes(Number(req.params.id))) return res.status(404).json({ success: false, message: 'Branch not found.' });
  try {
    const [rows] = await db.query('SELECT * FROM audit_log WHERE branch_id=? OR branch_id IS NULL ORDER BY created_at DESC LIMIT 30',[req.params.id]);
    res.json({ success:true, data:rows });
  } catch(err){ res.status(500).json({success:false,message:'Server error.'}); }
});

// ── POST /api/branches  – DISABLED ───────────────────────────
router.post('/', authMiddleware, requireRole('superadmin'), (req, res) => {
  return res.status(403).json({ success:false, message:'Adding branches is disabled. Only General Santos and Bohol branches are supported.' });
});

// ── PUT /api/branches/:id  – update contact info only ─────────
router.put('/:id', authMiddleware, requireRole('superadmin'), async (req, res) => {
  const bid = req.params.id;
  if (!FIXED_BRANCH_IDS.includes(Number(bid))) return res.status(404).json({ success:false, message:'Branch not found.' });
  const { address, phone, email, manager_name } = req.body;
  try {
    await db.query('UPDATE branches SET address=?,phone=?,email=?,manager_name=? WHERE id=?',[address||null,phone||null,email||null,manager_name||null,bid]);
    await db.query('INSERT INTO audit_log(user,action,details,ip)VALUES(?,?,?,?)',[req.user.username,'BRANCH_UPDATE',`Updated branch #${bid}`,req.ip]);
    res.json({ success:true });
  } catch(err){ res.status(500).json({success:false,message:'Server error.'}); }
});

// ── DELETE /api/branches/:id  – DISABLED ─────────────────────
router.delete('/:id', authMiddleware, requireRole('superadmin'), (req, res) => {
  return res.status(403).json({ success:false, message:'Deleting branches is disabled.' });
});

module.exports = router;
