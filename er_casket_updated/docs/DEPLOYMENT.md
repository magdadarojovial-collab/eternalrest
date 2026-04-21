# Deployment Guide

## Option 1 — Railway (Recommended)

Railway is the easiest option — free tier, auto-deploy from GitHub, built-in MySQL.

1. Push your repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub Repo**
3. Select your repository
4. Click **+ New** → **Database** → **MySQL** (Railway provisions it automatically)
5. In your service **Variables** tab, add:
   ```
   NODE_ENV=production
   DB_HOST=${{MySQL.MYSQL_HOST}}
   DB_PORT=${{MySQL.MYSQL_PORT}}
   DB_USER=${{MySQL.MYSQL_USER}}
   DB_PASSWORD=${{MySQL.MYSQL_PASSWORD}}
   DB_NAME=${{MySQL.MYSQL_DATABASE}}
   JWT_SECRET=your_long_random_secret_here
   CORS_ORIGINS=https://yourapp.railway.app
   ```
6. **Start Command**: `node backend/server.js`
7. Import `database/schema.sql` via Railway's MySQL shell or a client like TablePlus
8. Every `git push` auto-deploys

---

## Option 2 — Render.com

1. Push to GitHub
2. Go to [render.com](https://render.com) → **New Web Service** → connect your repo
3. Settings:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `node backend/server.js`
4. Add all environment variables from `backend/.env.example`
5. For MySQL, use [PlanetScale](https://planetscale.com) or [Clever Cloud](https://clever-cloud.com)

---

## Option 3 — VPS (DigitalOcean, Linode, Hostinger)

### Install and run
```bash
# On your server
git clone https://github.com/your-username/eternal-rest.git
cd eternal-rest/backend
npm install --production

# Configure environment
cp .env.example .env
nano .env          # fill in production values

# Import database
mysql -u root -p eternal_rest < ../database/schema.sql

# Keep server alive with PM2
npm install -g pm2
pm2 start server.js --name eternal-rest
pm2 save
pm2 startup
```

### Nginx reverse proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Add HTTPS (free)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Post-Deployment Checklist

- [ ] `NODE_ENV` set to `production`
- [ ] `JWT_SECRET` changed to a long random string
- [ ] `CORS_ORIGINS` set to your live domain only
- [ ] Database imported from `database/schema.sql`
- [ ] Default passwords changed for all staff accounts
- [ ] HTTPS enabled
