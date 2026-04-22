// backend/routes/memorials.js
const router = require('express').Router();
const db     = require('../config/db');
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const { authMiddleware, requireRole } = require('../middleware/auth');

// ── Multer – memorial photos ──────────────────────────────────
const MEM_PHOTO_DIR = path.join(__dirname, '../../public/uploads/memorials');
if (!fs.existsSync(MEM_PHOTO_DIR)) fs.mkdirSync(MEM_PHOTO_DIR, { recursive: true });

const memStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MEM_PHOTO_DIR),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'mem_' + Date.now() + '_' + Math.floor(Math.random() * 9999) + ext);
  }
});
const memUpload = multer({
  storage: memStorage,
  fileFilter: (_req, file, cb) => {
    ['image/jpeg','image/jpg','image/png','image/webp'].includes(file.mimetype)
      ? cb(null, true) : cb(new Error('Images only.'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ── GET /api/memorials  – public list ────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, branch_id } = req.query;
    let sql    = 'SELECT * FROM memorials WHERE 1=1';
    const vals = [];
    if (branch_id) { sql += ' AND branch_id = ?'; vals.push(branch_id); }
    if (search)    { sql += ' AND name LIKE ?';    vals.push(`%${search}%`); }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.query(sql, vals);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// ── GET /api/memorials/photos/all  – all photos across memorials (admin moderation) ──
router.get('/photos/all', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    let sql = `SELECT mp.*, m.name AS memorial_name, m.branch_id
               FROM memorial_photos mp
               JOIN memorials m ON m.id = mp.memorial_id`;
    const vals = [];
    if (!isSuperAdmin) {
      sql += ' WHERE m.branch_id = ?';
      vals.push(req.user.branch_id);
    }
    sql += ' ORDER BY mp.created_at DESC';
    const [rows] = await db.query(sql, vals);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/memorials/:id  – single memorial (for memorial.html) ──
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM memorials WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Memorial not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/memorials  – public create ─────────────────────
router.post('/', async (req, res) => {
  const { name, born, died, quote, branch_id } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  try {
    const [result] = await db.query(
      'INSERT INTO memorials (branch_id, name, born, died, quote, initials) VALUES (?,?,?,?,?,?)',
      [branch_id || null, name, born || null, died || null, quote || 'Forever in our hearts.', initials]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/memorials/:id/candle  – public ─────────────────
router.post('/:id/candle', async (req, res) => {
  try {
    await db.query('UPDATE memorials SET candles = candles + 1 WHERE id = ?', [req.params.id]);
    const [rows] = await db.query('SELECT candles FROM memorials WHERE id = ?', [req.params.id]);
    res.json({ success: true, candles: rows[0]?.candles });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/memorials/:id/photos  – public ──────────────────
router.get('/:id/photos', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM memorial_photos WHERE memorial_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/memorials/:id/photos  – public upload ──────────
router.post('/:id/photos', memUpload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No image received.' });
  const photoUrl = '/uploads/memorials/' + req.file.filename;
  try {
    const [result] = await db.query(
      'INSERT INTO memorial_photos (memorial_id, photo_url, caption, uploaded_by) VALUES (?,?,?,?)',
      [req.params.id, photoUrl, req.body.caption || null, req.body.uploader_name || 'Anonymous']
    );
    const photo = { id: result.insertId, memorial_id: Number(req.params.id), photo_url: photoUrl,
      caption: req.body.caption || null, uploaded_by: req.body.uploader_name || 'Anonymous' };
    res.status(201).json({ success: true, photo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// ── PUT /api/memorials/:id/photos/:photoId  – edit caption (admin) ────────
router.put('/:id/photos/:photoId', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  const { caption } = req.body;
  try {
    await db.query(
      'UPDATE memorial_photos SET caption = ? WHERE id = ? AND memorial_id = ?',
      [caption || null, req.params.photoId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/memorials/:id/photos/:photoId  (admin) ────────
router.delete('/:id/photos/:photoId', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT photo_url FROM memorial_photos WHERE id = ? AND memorial_id = ?',
      [req.params.photoId, req.params.id]);
    if (rows.length && rows[0].photo_url) {
      const fp = path.join(__dirname, '../../public', rows[0].photo_url);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await db.query('DELETE FROM memorial_photos WHERE id = ?', [req.params.photoId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/memorials/:id/tributes  – public ────────────────
router.get('/:id/tributes', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM memorial_tributes WHERE memorial_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/memorials/:id/tributes  – public ───────────────
router.post('/:id/tributes', memUpload.single('photo'), async (req, res) => {
  const { author_name, relation, message } = req.body;
  if (!author_name || !message)
    return res.status(400).json({ success: false, message: 'Name and message are required.' });

  const photoUrl = req.file ? '/uploads/memorials/' + req.file.filename : null;
  try {
    const [result] = await db.query(
      'INSERT INTO memorial_tributes (memorial_id, author_name, relation, message, photo_url) VALUES (?,?,?,?,?)',
      [req.params.id, author_name, relation || null, message, photoUrl]
    );
    const tribute = {
      id: result.insertId, memorial_id: Number(req.params.id),
      author_name, relation: relation || null, message, photo_url: photoUrl,
      created_at: new Date().toISOString()
    };
    res.status(201).json({ success: true, tribute });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/memorials/:id  (admin) ───────────────────────
router.delete('/:id', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  try {
    // Clean up photos from disk
    const [photos] = await db.query('SELECT photo_url FROM memorial_photos WHERE memorial_id = ?', [req.params.id]);
    const [tribs]  = await db.query('SELECT photo_url FROM memorial_tributes WHERE memorial_id = ? AND photo_url IS NOT NULL', [req.params.id]);
    [...photos, ...tribs].forEach(row => {
      if (row.photo_url) {
        const fp = path.join(__dirname, '../../public', row.photo_url);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    });
    await db.query('DELETE FROM memorial_photos   WHERE memorial_id = ?', [req.params.id]);
    await db.query('DELETE FROM memorial_tributes WHERE memorial_id = ?', [req.params.id]);
    await db.query('DELETE FROM memorials WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;