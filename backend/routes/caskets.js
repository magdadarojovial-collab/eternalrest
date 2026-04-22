// backend/routes/caskets.js
const router = require('express').Router();
const db     = require('../config/db');
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const { authMiddleware, requireRole } = require('../middleware/auth');

// ── Multer setup ──────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads/caskets');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = 'casket_' + Date.now() + '_' + Math.floor(Math.random() * 10000) + ext;
    cb(null, name);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPG, PNG, WEBP, or GIF images are allowed.'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max
});

// ── GET /api/caskets  – public ────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, status, search, sort, branch_id } = req.query;
    let sql    = 'SELECT * FROM caskets WHERE 1=1';
    const vals = [];

    if (branch_id) { sql += ' AND (branch_id = ? OR branch_id IS NULL)'; vals.push(branch_id); }
    if (category && category !== 'all') { sql += ' AND category = ?'; vals.push(category); }
    if (status)                          { sql += ' AND status = ?';   vals.push(status); }
    if (search) {
      sql += ' AND (name LIKE ? OR material LIKE ? OR description LIKE ?)';
      const like = `%${search}%`;
      vals.push(like, like, like);
    }

    const sortMap = { 'price-asc': 'price ASC', 'price-desc': 'price DESC', name: 'name ASC' };
    sql += ` ORDER BY ${sortMap[sort] || 'id ASC'}`;

    const [rows] = await db.query(sql, vals);
    const caskets = rows.map(c => ({
      ...c,
      features: typeof c.features === 'string' ? JSON.parse(c.features) : c.features
    }));
    res.json({ success: true, data: caskets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/caskets/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM caskets WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Casket not found.' });
    const c = rows[0];
    c.features = typeof c.features === 'string' ? JSON.parse(c.features) : c.features;
    res.json({ success: true, data: c });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/caskets  (admin) ────────────────────────────────
router.post('/', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  const { name, category, material, price, stock, status, description, features } = req.body;
  if (!name || !category || !price)
    return res.status(400).json({ success: false, message: 'name, category and price are required.' });

  const branch_id = req.user.role === 'superadmin'
    ? (req.body.branch_id || null)
    : req.user.branch_id;

  try {
    const [result] = await db.query(
      `INSERT INTO caskets (branch_id, name, category, material, price, stock, status, description, features)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [branch_id, name, category, material || null, price, stock || 1, status || 'available',
       description || null, JSON.stringify(features || [])]
    );
    await db.query(
      'INSERT INTO audit_log (branch_id, user, action, details, ip) VALUES (?,?,?,?,?)',
      [branch_id, req.user.username, 'CASKET_ADD', `Added casket: ${name}`, req.ip]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/caskets/:id  (admin) ─────────────────────────────
router.put('/:id', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  const { name, category, material, price, stock, status, description, features } = req.body;
  try {
    await db.query(
      `UPDATE caskets SET name=?,category=?,material=?,price=?,stock=?,status=?,
       description=?,features=?,updated_at=NOW() WHERE id=?`,
      [name, category, material, price, stock, status,
       description, JSON.stringify(features || []), req.params.id]
    );
    await db.query(
      'INSERT INTO audit_log (branch_id, user, action, details, ip) VALUES (?,?,?,?,?)',
      [req.user.branch_id || null, req.user.username, 'CASKET_EDIT', `Updated casket #${req.params.id}`, req.ip]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/caskets/:id/photo  (admin) — upload photo ──────
router.post('/:id/photo', authMiddleware, requireRole('admin','superadmin'),
  upload.single('photo'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file received.' });

    const newUrl = '/uploads/caskets/' + req.file.filename;

    try {
      // Delete old photo file if it exists
      const [rows] = await db.query('SELECT image_url FROM caskets WHERE id = ?', [req.params.id]);
      if (rows.length && rows[0].image_url) {
        const oldPath = path.join(__dirname, '../../public', rows[0].image_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      await db.query('UPDATE caskets SET image_url = ?, updated_at = NOW() WHERE id = ?',
        [newUrl, req.params.id]);
      await db.query(
        'INSERT INTO audit_log (branch_id, user, action, details, ip) VALUES (?,?,?,?,?)',
        [req.user.branch_id || null, req.user.username, 'CASKET_PHOTO',
         `Uploaded photo for casket #${req.params.id}`, req.ip]
      );
      res.json({ success: true, image_url: newUrl });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server error saving photo.' });
    }
  }
);

// ── DELETE /api/caskets/:id/photo  (admin) — remove photo ────
router.delete('/:id/photo', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT image_url FROM caskets WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Casket not found.' });

    const oldUrl = rows[0].image_url;
    if (oldUrl) {
      const oldPath = path.join(__dirname, '../../public', oldUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await db.query('UPDATE caskets SET image_url = NULL, updated_at = NOW() WHERE id = ?', [req.params.id]);
    await db.query(
      'INSERT INTO audit_log (branch_id, user, action, details, ip) VALUES (?,?,?,?,?)',
      [req.user.branch_id || null, req.user.username, 'CASKET_PHOTO_REMOVE',
       `Removed photo from casket #${req.params.id}`, req.ip]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/caskets/:id  (superadmin only) ───────────────
router.delete('/:id', authMiddleware, requireRole('superadmin'), async (req, res) => {
  try {
    // Also delete the photo file if present
    const [rows] = await db.query('SELECT image_url FROM caskets WHERE id = ?', [req.params.id]);
    if (rows.length && rows[0].image_url) {
      const oldPath = path.join(__dirname, '../../public', rows[0].image_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await db.query('DELETE FROM caskets WHERE id = ?', [req.params.id]);
    await db.query(
      'INSERT INTO audit_log (branch_id, user, action, details, ip) VALUES (?,?,?,?,?)',
      [null, req.user.username, 'CASKET_DELETE', `Deleted casket #${req.params.id}`, req.ip]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
// ── GET /api/caskets/:id/inclusions ──────────────────────────
router.get('/:id/inclusions', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM casket_inclusions WHERE casket_id = ? ORDER BY id',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/caskets/:id/inclusions (admin) – replace inclusions ─
router.put('/:id/inclusions', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  const { inclusions } = req.body; // array of { item_name, quantity, unit }
  if (!Array.isArray(inclusions))
    return res.status(400).json({ success: false, message: 'inclusions must be an array.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM casket_inclusions WHERE casket_id = ?', [req.params.id]);
    if (inclusions.length) {
      const vals = inclusions.map(i => [req.params.id, i.item_name, i.quantity || 1, i.unit || null]);
      await conn.query('INSERT INTO casket_inclusions (casket_id, item_name, quantity, unit) VALUES ?', [vals]);
    }
    await conn.query(
      'INSERT INTO audit_log (branch_id, user, action, details, ip) VALUES (?,?,?,?,?)',
      [req.user.branch_id || null, req.user.username, 'CASKET_INCLUSIONS_UPDATE', `Updated inclusions for casket #${req.params.id}`, req.ip]
    );
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    conn.release();
  }
});
