import { Router } from 'express';
import healthRoutes from './health.routes.js';
import urlRoutes from './url.routes.js';
import analyticsRoutes from './analytics.routes.js';
import { notFoundHandler } from '../middleware/notFound.middleware.js';

const apiRouter = Router();

// Mount sub-routes
apiRouter.use('/health', healthRoutes);
apiRouter.use('/urls', urlRoutes);
apiRouter.use('/analytics', analyticsRoutes);

// Catch-all for unknown /api/* endpoints - ensures /api requests are never forwarded to public routes
apiRouter.use(notFoundHandler);

export default apiRouter;
