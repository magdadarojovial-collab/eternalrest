# ⚰️ Eternal Rest Funeral Services

A full-stack web system for managing funeral service reservations, casket inventory, digital memorials, and staff communication — serving two branches: **General Santos** and **Bohol**.

---

## 📁 Project Structure

```
er_casket_updated/
├── backend/                        # Node.js + Express API server
│   ├── config/db.js                # MySQL database connection
│   ├── middleware/auth.js          # JWT authentication middleware
│   ├── routes/                     # API route handlers (9 files)
│   ├── scripts/seedAdmin.js        # Seed initial super admin account
│   ├── server.js                   # Express entry point
│   ├── package.json                # Backend dependencies
│   └── .env.example                # Environment variable template
│
├── public/                         # Frontend (static HTML/CSS/JS)
│   ├── index.html                  # Public site
│   ├── login.html                  # Unified staff login (auto-redirects by role)
│   ├── admin.html                  # Branch admin panel
│   ├── superadmin.html             # Super admin panel
│   ├── memorial.html               # Memorial page
│   └── uploads/                    # Runtime uploads (caskets, memorials)
│
├── database/
│   └── schema.sql                  # Full database schema + seed data
│
├── docs/
│   └── DEPLOYMENT.md               # Detailed hosting guide
│
├── nixpacks.toml                   # Railway build configuration
├── Procfile                        # Railway/Heroku start command
├── .gitignore
├── package.json                    # Root package (used by Railway)
└── README.md
```

---

## 🚀 Local Development

### 1. Clone and install
```bash
git clone https://github.com/your-username/eternal-rest.git
cd eternal-rest
cd backend && npm install
```

### 2. Set up database
- Create database: `eternal_rest`
- Import: `database/schema.sql`

### 3. Configure environment
```bash
cd backend
cp .env.example .env
# Edit .env with your DB credentials
```

### 4. Run
```bash
# From project root:
npm run dev     # development (nodemon)
npm start       # production
```

### 5. Open in browser

| Page | URL |
|------|-----|
| Public Site | http://localhost:3000 |
| Staff Login | http://localhost:3000/login |
| Admin Panel | http://localhost:3000/admin |
| Super Admin | http://localhost:3000/superadmin |

---

## 👥 Default Credentials

> ⚠️ Change immediately after first login.

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `admin123` |
| Admin (Gensan) | `msantos` | `admin123` |
| Admin (Bohol) | `jreyes` | `admin123` |

---

## 🌐 Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Select your repository — Railway auto-detects `nixpacks.toml`
4. Add a **MySQL** database plugin
5. Set these environment variables:

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

6. Import `database/schema.sql` into the Railway MySQL database
7. Every `git push` auto-deploys ✅

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for Render and VPS options.

---

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express.js |
| Database | MySQL (mysql2) |
| Auth | JWT + bcrypt |
| Uploads | Multer |
| Frontend | Vanilla HTML/CSS/JS |
| Icons | Font Awesome, Google Fonts |
