import { Router } from 'express';
import { handleRedirect } from '../controllers/redirect.controller.js';
import { redirectLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// GET /:shortCode - Public redirect endpoint (rate limited)
router.get('/:shortCode', redirectLimiter, handleRedirect);

export default router;

