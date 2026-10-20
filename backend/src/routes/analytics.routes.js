import { Router } from 'express';
import {
  getOverviewAnalytics,
  getClickTimeSeries,
  getTopLinks,
  getUrlAnalytics,
} from '../controllers/analytics.controller.js';

const router = Router();

// GET /api/analytics/overview - Overall system metrics and click counts
router.get('/overview', getOverviewAnalytics);

// GET /api/analytics/clicks?period=7d|30d|90d - Time-series daily clicks with zero-filling
router.get('/clicks', getClickTimeSeries);

// GET /api/analytics/top-links - Top 10 links ranked by click count
router.get('/top-links', getTopLinks);

// GET /api/analytics/urls/:code - Detailed analytics for a specific link
router.get('/urls/:code', getUrlAnalytics);

export default router;
