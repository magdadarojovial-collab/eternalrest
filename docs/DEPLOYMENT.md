# Deployment Guide

## Railway (Recommended)

1. Push repo root to GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add MySQL plugin
4. Set environment variables (see README)
5. Import `database/schema.sql`
6. Done — `railway.toml` handles the rest

## Render.com

- **Build Command:** `cd backend && npm install`
- **Start Command:** `node backend/server.js`
- Add environment variables from `backend/.env.example`
- Use PlanetScale or Clever Cloud for free MySQL

## VPS (DigitalOcean / Linode)

```bash
git clone https://github.com/your-username/eternal-rest.git
cd eternal-rest/backend
npm install --production
cp .env.example .env && nano .env
mysql -u root -p eternal_rest < ../database/schema.sql
npm install -g pm2
pm2 start server.js --name eternal-rest
pm2 save && pm2 startup
```

### Nginx
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### HTTPS
```bash
sudo certbot --nginx -d yourdomain.com
```

## Post-Deploy Checklist
- [ ] NODE_ENV = production
- [ ] JWT_SECRET changed
- [ ] CORS_ORIGINS set to live domain
- [ ] Database imported
- [ ] Default passwords changed
- [ ] HTTPS enabled
