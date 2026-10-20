# Link-Lite — Modern URL Shortener & Link Analytics Platform

Link-Lite is a high-performance, production-ready URL shortener and link management platform built with React + Vite, Node.js + Express, and MongoDB.

## Features

- **URL Shortening & Custom Aliases:** Generate cryptographically secure 7-character short codes or assign custom branded aliases (4–32 characters).
- **Public Short-Link Redirection:** High-speed HTTP 302 redirection with abuse and rate-limit protection (`RateLimit-Limit`, `RateLimit-Remaining`).
- **Atomic Click Tracking & Analytics:** Non-blocking event logging capturing referrers, device types, and browser categories.
- **Full CRUD Management:** Filter by active/expired/inactive status, search short codes and original URLs, update target destinations, set expiry dates, or delete links while preserving historical analytics.
- **Interactive Visual Analytics:** 7-day, 30-day, and 90-day time-series click charts powered by Recharts, top 10 links ranking, and detailed breakdown cards.
- **Enterprise-Grade Security:**
  - Strict input validation and CRLF/control-character injection rejection.
  - Defense against ReDoS and regex exhaustion.
  - Helmet HTTP security headers.
  - Configurable CORS origin allowlisting and clean origin rejection.
  - In-memory and reverse-proxy (`trust proxy`) rate limiting.
- **Automated Test Suite:** 52 comprehensive unit, integration, security, and regression tests.

---

## Tech Stack

- **Frontend:** React 18 / 19, Vite, React Router DOM v6, Recharts, Lucide React, Vanilla CSS design tokens.
- **Backend:** Node.js, Express.js (ES Modules), Mongoose, Helmet, Express-Rate-Limit, Morgan.
- **Database:** MongoDB (Local or Atlas Replica Set).

---

## Project Structure

```
short-URL/
├── backend/                  # Node.js + Express API server
│   ├── src/
│   │   ├── config/           # Database & environment configuration
│   │   ├── controllers/      # Route controllers (URL, redirect, analytics, health)
│   │   ├── middleware/       # Rate limiting, error handling, 404 handler
│   │   ├── models/           # Mongoose models (Url, ClickEvent)
│   │   ├── routes/           # Express routes
│   │   ├── services/         # Short code resolution & collision management
│   │   └── utils/            # Validators & analytics date helpers
│   ├── test/                 # Node test suite (52 automated tests)
│   ├── .env.example
│   └── package.json
├── frontend/                 # React + Vite Single Page Application
│   ├── public/               # Static assets & SPA redirect rule (_redirects)
│   ├── src/
│   │   ├── components/       # UI components, modals, navbar, layout
│   │   ├── pages/            # Dashboard, Links, Analytics, Settings, NotFound
│   │   ├── routes/           # React Router route configuration
│   │   ├── services/         # Fetch API client and error handling
│   │   └── styles/           # CSS design system (tokens, layout, components)
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── DEPLOYMENT.md             # Production deployment guide
├── .gitignore                # Root Git ignore rules
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js (v18.x or v20.x LTS)
- MongoDB running locally or a MongoDB Atlas URI

### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Update MONGODB_URI in .env if needed
npm run dev
```
Backend will be available at `http://localhost:5000`.

### 2. Frontend Setup
```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev
```
Frontend will be available at `http://localhost:5173`.

### 3. Running Automated Tests
```bash
cd ../backend
npm test
```

---

## Deployment

Refer to [`DEPLOYMENT.md`](DEPLOYMENT.md) for complete instructions on environment variables, Nginx reverse proxy configuration, SPA fallback routing, and health check monitoring.

---

## License

ISC
