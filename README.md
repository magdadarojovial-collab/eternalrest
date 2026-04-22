# ⚰️ Eternal Rest Funeral Services

Full-stack funeral management system — Node.js + MySQL, serving **General Santos** and **Bohol** branches.

---

## 📁 Structure

```
/                           ← repo root (push this level to GitHub)
├── backend/
│   ├── config/db.js
│   ├── middleware/auth.js
│   ├── routes/             # 9 API route files
│   ├── scripts/seedAdmin.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── public/
│   ├── index.html          # Public site
│   ├── login.html          # Unified staff login
│   ├── admin.html          # Branch admin panel
│   ├── superadmin.html     # Super admin panel
│   ├── memorial.html
│   └── uploads/
├── database/
│   └── schema.sql
├── docs/
│   └── DEPLOYMENT.md
├── casket_photo/           # Sample product images
├── nixpacks.toml           # Railway build config
├── railway.toml            # Railway deploy config
├── Procfile                # Start command
├── package.json            # Root package (used by Railway)
└── .gitignore
```

---

## 🚀 Local Development

```bash
git clone https://github.com/your-username/eternal-rest.git
cd eternal-rest
cd backend && npm install
cp .env.example .env       # fill in your DB credentials
cd ..
npm start
```

| Page | URL |
|------|-----|
| Public Site | http://localhost:3000 |
| Staff Login | http://localhost:3000/login |
| Admin Panel | http://localhost:3000/admin |
| Super Admin | http://localhost:3000/superadmin |

---

## 👥 Default Credentials

> ⚠️ Change after first login.

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `admin123` |
| Admin (Gensan) | `msantos` | `admin123` |
| Admin (Bohol) | `jreyes` | `admin123` |

---

## 🌐 Deploy to Railway

1. Push repo to GitHub (push the **root folder contents**, not a subfolder)
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add **MySQL** database plugin
4. Set environment variables:

```
NODE_ENV=production
DB_HOST=${{MySQL.MYSQL_HOST}}
DB_PORT=${{MySQL.MYSQL_PORT}}
DB_USER=${{MySQL.MYSQL_USER}}
DB_PASSWORD=${{MySQL.MYSQL_PASSWORD}}
DB_NAME=${{MySQL.MYSQL_DATABASE}}
JWT_SECRET=your_long_random_secret
CORS_ORIGINS=https://yourapp.railway.app
```

5. Import `database/schema.sql` into the Railway MySQL database
6. Deploy — Railway reads `railway.toml` + `nixpacks.toml` automatically ✅

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for Render and VPS options.

---

## 📦 Stack

Node.js · Express · MySQL · JWT · Multer · Vanilla HTML/CSS/JS
