import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { getHealthStatus } from './controllers/health.controller.js';
import apiRouter from './routes/index.js';
import redirectRoutes from './routes/redirect.routes.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

// Trust reverse proxy (e.g. Nginx, Cloudflare, AWS ALB, Render) for accurate client IP resolution
if (env.trustProxy !== false) {
  app.set('trust proxy', env.trustProxy);
}

// Security middleware - sets various HTTP response headers
app.use(helmet());


// CORS configuration - support single origin, comma-separated list, or wildcard
const allowedOrigins = env.clientOrigin.split(',').map((origin) => origin.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);

      // Always permit local development origins on any dynamic port (e.g. 5173, 5174, etc.)
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin) || isLocalhost) {
        return callback(null, true);
      }

      // Disallow origin cleanly without triggering an unhandled server error
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);


// HTTP request logging
if (env.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Request body parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Root informational endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'LinkLite URL Shortener API',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Direct health check endpoint for container orchestrators and load balancers
app.get('/health', getHealthStatus);

// 1. Mount API routes (/api/health, /api/urls, /api/*)
app.use('/api', apiRouter);


// 2. Mount public redirection routes (GET /:shortCode)
app.use('/', redirectRoutes);

// 3. 404 handler for unknown routes
app.use(notFoundHandler);

// 4. Global centralized error handler
app.use(errorHandler);

export default app;
