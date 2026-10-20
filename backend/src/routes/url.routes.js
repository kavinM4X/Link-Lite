
import { Router } from 'express';
import {
  createShortUrl,
  getUrls,
  getUrlByCode,
  updateUrl,
  deleteUrl,
} from '../controllers/url.controller.js';
import { urlCreateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// GET /api/urls - List and search short links with pagination and filtering
router.get('/', getUrls);

// POST /api/urls - Create a new short URL (rate limited)
router.post('/', urlCreateLimiter, createShortUrl);

// GET /api/urls/:code - Get single short link details
router.get('/:code', getUrlByCode);

// PATCH /api/urls/:code - Update editable fields (originalUrl, expiresAt, isActive)
router.patch('/:code', updateUrl);

// DELETE /api/urls/:code - Delete short link by short code
router.delete('/:code', deleteUrl);

export default router;
