# ⚰️ Eternal Rest Funeral Services

A full-stack web system for managing funeral service reservations, casket inventory, digital memorials, and staff communication — serving two branches: **General Santos** and **Bohol**.

---

## 📁 Project Structure

```
er_casket_updated/
├── backend/                        # Node.js + Express API server
│   ├── config/
│   │   └── db.js                   # MySQL database connection
│   ├── middleware/
│   │   └── auth.js                 # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js                 # Login, session restore
│   │   ├── branches.js             # Branch management, inventory transfers
│   │   ├── caskets.js              # Casket CRUD, inclusions, photo upload
│   │   ├── clients.js              # Public client accounts
│   │   ├── dashboard.js            # Stats, analytics, reports, audit log
│   │   ├── memorials.js            # Digital memorial wall
│   │   ├── messages.js             # Inventory chat (Admin ↔ Super Admin)
│   │   ├── reservations.js         # Reservations, payments, installments
│   │   └── users.js                # Staff user management
│   ├── scripts/
│   │   └── seedAdmin.js            # Seed initial super admin account
│   ├── server.js                   # Express entry point
│   ├── package.json
│   └── .env.example                # Environment variable template (safe to commit)
│
├── public/                         # Frontend (static HTML/CSS/JS)
│   ├── index.html                  # Public site — caskets, reservations, memorials
│   ├── login.html                  # Unified staff login portal (auto-redirects by role)
│   ├── admin.html                  # Branch admin panel
│   ├── superadmin.html             # Super admin panel
│   ├── memorial.html               # Individual memorial page
│   └── uploads/
│       ├── caskets/                # Casket images (user-uploaded at runtime)
│       └── memorials/              # Memorial photos (user-uploaded at runtime)
│
├── database/
│   └── schema.sql                  # Full database schema + seed data
│
├── docs/
│   └── DEPLOYMENT.md               # Hosting guide (Railway, Render, VPS)
│
├── casket_photo/                   # Sample casket photos for seeding
├── .gitignore
├── package.json                    # Root convenience scripts
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/eternal-rest.git
cd eternal-rest
```

### 2. Install dependencies
```bash
cd backend
npm install
```

### 3. Set up the database
- Open **phpMyAdmin** or your MySQL client
- Create a database named `eternal_rest`
- Import `database/schema.sql`

### 4. Configure environment variables
```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials
```

### 5. Start the server
```bash
npm start        # production
npm run dev      # development (auto-reload with nodemon)
```

### 6. Open in browser

| Page | URL |
|------|-----|
| Public Site | http://localhost:3000 |
| **Staff Login** | http://localhost:3000/login |
| Admin Panel | http://localhost:3000/admin |
| Super Admin | http://localhost:3000/superadmin |

> Staff should always use `/login` — it detects their role and redirects automatically.

---

## 👥 Default Login Credentials

> ⚠️ Change these immediately after first login.

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `admin123` |
| Admin (Gensan) | `msantos` | `admin123` |
| Admin (Bohol) | `jreyes` | `admin123` |

---

## 🔑 Role-Based Access

| Role | Access |
|------|--------|
| `superadmin` | All branches — dashboard, users, reports, inventory hub, audit log |
| `admin` | Branch-scoped — reservations, caskets, memorials, messages |
| `staff` | Branch-scoped — reservations and caskets only |
| Public | Casket catalog, reservations, memorial wall |

---

## 🌐 Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for full instructions.

### Required environment variables for production

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DB_HOST` | Your MySQL host |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | `eternal_rest` |
| `JWT_SECRET` | Long random string — run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CORS_ORIGINS` | `https://yourdomain.com` |

---

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express.js |
| Database | MySQL (via mysql2) |
| Auth | JWT + bcrypt |
| File Uploads | Multer |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Icons & Fonts | Font Awesome, Google Fonts |

---

## ✅ Features

- Public casket catalog with package inclusions and realistic Philippine pricing
- Online reservation form with retrieval location, burial schedule, and installment plans
- Payment tracking — GCash, bank transfer, walk-in, installment
- Digital memorial wall with photo gallery and tributes
- **Unified staff login** — one URL, auto-redirects Admin vs Super Admin
- Branch-scoped data — General Santos and Bohol
- **Inventory Hub** — real-time chat + transfer history + audit log
- Casket photo upload and management
- Analytics and reports filtered by branch and casket category (wood / metal)
- User management with role-based access control
