# LinkLite — Production Deployment Guide

This document describes the deployment architecture, configuration parameters, hosting requirements, verification procedures, and rollback strategies for the LinkLite URL Shortener application.

---

## 1. Architecture Overview & Required Services

LinkLite consists of two decoupled application tiers backed by a persistent MongoDB database:

```
                      +-----------------------------+
                      |       Clients / Visitors    |
                      +--------------+--------------+
                                     |
              +----------------------+----------------------+
              |                                             |
   Static Assets & UI Requests                  Short Links & API Calls
              |                                             |
              v                                             v
+-----------------------------+             +-------------------------------+
|     Frontend Hosting        |             |  Reverse Proxy (Nginx / ALB)  |
| (Cloudflare Pages, Netlify, |             |   TLS Termination & SSL/HTTPS |
|  S3 + CloudFront, or Nginx) |             +---------------+---------------+
|                             |                             |
|  - SPA Static Bundle        |                             v
|  - Client-side routing      |             +-------------------------------+
+-----------------------------+             |      Node.js Express API      |
                                            |  - Redirect Engine (GET /:id) |
                                            |  - REST Endpoints (/api/*)    |
                                            |  - Rate Limiters & Security   |
                                            +---------------+---------------+
                                                            |
                                                            v
                                            +-------------------------------+
                                            |      MongoDB Database         |
                                            |  - Collections: urls,         |
                                            |    clickevents                |
                                            |  - Replica Set / Atlas        |
                                            +-------------------------------+
```

### Required Infrastructure:
1. **Node.js Runtime:** Node.js 18.x, 20.x, or 22.x LTS.
2. **MongoDB Database:** MongoDB 5.0+ or MongoDB Atlas (M0/M10+).
3. **Reverse Proxy / Ingress:** Nginx, Caddy, AWS ALB, Cloudflare, or built-in PaaS proxies (Render, Railway, Fly.io).
4. **Static Web Host:** Any static site provider (Netlify, Cloudflare Pages, Vercel, S3+CloudFront, or Nginx).

---

## 2. Environment Variables Specification

### Backend Configuration (`backend/.env`)

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `5000` | Port on which the Express HTTP server listens. |
| `NODE_ENV` | Yes | `production` | Enables production optimizations, disables stack trace exposure, activates Apache combined logging. |
| `MONGODB_URI` | Yes | `mongodb+srv://<user>:<password>@cluster0.example.net/linklite?retryWrites=true&w=majority` | Connection string to MongoDB instance or Atlas replica set. |
| `BASE_URL` | Yes | `https://yourdomain.com` (or dedicated short domain `https://lnkl.it`) | Base URL used when generating and displaying short link destinations (`shortUrl: BASE_URL/shortCode`). Must start with `http://` or `https://` without a trailing slash. |
| `CLIENT_ORIGIN` | Yes | `https://app.yourdomain.com` | Allowed frontend origin(s) for CORS. Can be a single origin or a comma-separated list (e.g. `https://app.yourdomain.com,https://linklite.yourdomain.com`). |
| `TRUST_PROXY` | Recommended | `1` | Configures Express `trust proxy`. Set to `1` behind a single reverse proxy (e.g. Nginx, Render, Cloudflare) to ensure accurate client IP logging and rate limiting. |

> [!CAUTION]
> Never commit `.env` files to git. Use environment secret managers (e.g. AWS Secrets Manager, GitHub Actions Secrets, Render/Railway Environment Settings).

---

### Frontend Configuration (`frontend/.env`)

Frontend variables are embedded into client JavaScript at build time (`npm run build`).

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Yes | `https://api.yourdomain.com/api` | Base URL of the backend API endpoints. All dashboard, link management, and analytics queries connect here. |
| `VITE_PUBLIC_SHORT_URL_BASE` | Optional | `https://lnkl.it` (or empty) | Overrides the base domain shown in the UI for generated short links. Use this when the public redirect domain differs from the API domain. |

> [!IMPORTANT]
> **API URL vs. Public Short Link URL:**
> - The **API URL** (`VITE_API_BASE_URL`) targets backend endpoints (e.g. `/api/urls`, `/api/analytics`).
> - The **Public Short Link Base** (`BASE_URL` / `VITE_PUBLIC_SHORT_URL_BASE`) represents the public vanity domain visitors click on (e.g. `https://lnkl.it/xyz`). This separation allows running the management dashboard and public redirection on distinct domains if desired.

---

## 3. Deployment Compatibility & Platform Requirements

### 1. MongoDB Persistent Connection
- LinkLite uses Mongoose with persistent connection pooling (`serverSelectionTimeoutMS: 5000`).
- The application connects once at startup before binding the HTTP port:
  ```javascript
  await connectDB();
  server = app.listen(port);
  ```
- **Platform Note:** Ideal for persistent server environments (Docker, Kubernetes, VPS, Render, Railway, Fly.io, ECS). For serverless deployments (AWS Lambda, Vercel Serverless Functions), ensure connection caching or MongoDB Atlas Data API is evaluated.

### 2. Route Ordering & Conflict Prevention
- `/api` routes (`/api/health`, `/api/urls`, `/api/analytics`) are mounted first.
- The root health check alias `GET /health` is registered before dynamic redirects.
- Public redirect handler `GET /:shortCode` is mounted last.
- Reserved words (`api`, `health`, `dashboard`, `urls`, `admin`, etc.) cannot be created as custom aliases.

### 3. SPA Fallback Routing
- LinkLite frontend uses React Router (`BrowserRouter`).
- All nested routes (`/links`, `/analytics`, `/settings`) require the hosting provider to return `index.html` on direct browser refreshes.
- **Static hosts (Netlify, Cloudflare Pages, Render):** A `_redirects` file (`/* /index.html 200`) is included in `frontend/public/` and automatically built into `frontend/dist/`.
- **Nginx configuration example:**
  ```nginx
  server {
      listen 80;
      server_name app.yourdomain.com;
      root /var/www/linklite/dist;
      index index.html;

      location / {
          try_files $uri $uri/ /index.html;
      }
  }
  ```

### 4. Reverse Proxy & Rate Limiting
- Public redirects (`GET /:shortCode`) are protected with `redirectLimiter` (3000 req / 15 min).
- URL creation (`POST /api/urls`) is protected with `createLimiter` (30 req / 15 min).
- General API calls are protected with `apiLimiter` (100 req / 15 min).
- When `TRUST_PROXY=1` is set, Express accurately reads client IPs from `X-Forwarded-For` without spoofing vulnerabilities.

---

## 4. Local Production Verification

Run the following steps to verify production builds locally before deployment:

### Backend Production Verification
```powershell
cd backend
# 1. Ensure production dependencies are installed
npm ci --omit=dev

# 2. Run backend test suite
npm test

# 3. Start server in production mode
$env:NODE_ENV="production"; $env:PORT="5000"; $env:MONGODB_URI="mongodb://127.0.0.1:27017/linklite"; node src/server.js
```

### Frontend Production Build Verification
```powershell
cd frontend
# 1. Install dependencies
npm ci

# 2. Compile production bundle
npm run build

# 3. Preview built bundle
npm run preview
```

---

## 5. Health Check & Monitoring Probes

LinkLite exposes two dedicated health endpoints for load balancers and orchestrator probes:

- `GET /health` (standard root probe for container platforms)
- `GET /api/health` (API-namespaced health probe)

### Expected Healthy Response (HTTP 200 OK):
```json
{
  "name": "LinkLite API",
  "status": "healthy",
  "uptimeSeconds": 1284,
  "timestamp": "2026-10-20T07:25:00.000Z",
  "environment": "production",
  "services": {
    "server": {
      "status": "up"
    },
    "database": {
      "status": "connected",
      "readyState": 1
    }
  }
}
```

### Degraded Response (HTTP 503 Service Unavailable):
Returned if the MongoDB connection drops:
```json
{
  "name": "LinkLite API",
  "status": "degraded",
  "services": {
    "server": { "status": "up" },
    "database": { "status": "disconnected", "readyState": 0 }
  }
}
```

---

## 6. Rollback & Disaster Recovery Considerations

1. **Database Schema Compatibility:**
   - LinkLite's MongoDB schemas (`urls` and `clickevents`) are append-compatible.
   - Deleting a short link preserves `clickevents` with `isDeleted: true`.
   - Any previous backend version can run against the same database without schema migrations.

2. **Zero-Downtime Blue/Green Deployments:**
   - Deploy the new backend revision.
   - Run health check probe on the new instance (`GET /health`).
   - Switch traffic at the load balancer only after the health probe returns HTTP 200.
   - If health check fails or errors spike, switch traffic back to the prior target group immediately.

3. **Frontend Cache Invalidation:**
   - Built assets in `frontend/dist/assets/` use content hashes in their filenames (e.g. `index-D2JbeZLd.js`).
   - Configure cache headers:
     - `index.html`: `Cache-Control: no-cache, no-store, must-revalidate`
     - `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`
   - During rollback, simply redeploying the prior `dist/` directory guarantees clients fetch the correct assets immediately without browser cache corruption.
