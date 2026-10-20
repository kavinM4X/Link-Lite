import Url from '../models/Url.js';
import ClickEvent from '../models/ClickEvent.js';
import { env } from '../config/env.js';

/**
 * Helper to build zero-filled daily date series in UTC.
 *
 * @param {number} days - Number of days to include in the series.
 * @param {Array<{ _id: string, clicks: number }>} aggResults - Aggregation results grouped by YYYY-MM-DD.
 * @returns {{ startDate: string, endDate: string, data: Array<{ date: string, clicks: number }> }}
 */
const buildDailyTimeSeries = (days, aggResults) => {
  const map = new Map(aggResults.map((item) => [item._id, item.clicks]));
  const now = new Date();
  const series = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const dateStr = d.toISOString().split('T')[0];
    series.push({
      date: dateStr,
      clicks: map.get(dateStr) || 0,
    });
  }

  return {
    startDate: series[0].date,
    endDate: series[series.length - 1].date,
    data: series,
  };
};

/**
 * GET /api/analytics/overview
 * Returns high-level metrics for LinkLite:
 * - totalLinks, activeLinks, expiredLinks
 * - totalClicks
 * - clicksToday (UTC midnight to now)
 * - clicksPrevious7Days (7 days prior to today's UTC midnight)
 */
export const getOverviewAnalytics = async (req, res, next) => {
  try {
    const now = new Date();

    // UTC Date boundaries
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const startOfPrevious7Days = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Concurrently fetch counts
    const [
      totalLinks,
      activeLinks,
      expiredLinks,
      totalEvents,
      urlClicksAgg,
      clicksToday,
      clicksPrevious7Days,
    ] = await Promise.all([
      Url.countDocuments({}),
      Url.countDocuments({
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      }),
      Url.countDocuments({
        expiresAt: { $ne: null, $lte: now },
      }),
      ClickEvent.countDocuments({}),
      Url.aggregate([{ $group: { _id: null, total: { $sum: '$clickCount' } } }]),
      ClickEvent.countDocuments({
        clickedAt: { $gte: startOfToday },
      }),
      ClickEvent.countDocuments({
        clickedAt: { $gte: startOfPrevious7Days, $lt: startOfToday },
      }),
    ]);

    const totalUrlClicks = urlClicksAgg[0]?.total || 0;
    // Total clicks accounts for total events and live URL counters
    const totalClicks = Math.max(totalEvents, totalUrlClicks);

    return res.status(200).json({
      success: true,
      data: {
        totalLinks,
        activeLinks,
        expiredLinks,
        totalClicks,
        clicksToday,
        clicksPrevious7Days,
        dateBoundaries: {
          timezone: 'UTC',
          startOfToday: startOfToday.toISOString(),
          startOfPrevious7Days: startOfPrevious7Days.toISOString(),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/analytics/clicks?period=7d|30d|90d
 * Returns daily click counts for the requested period, including zero-click dates.
 */
export const getClickTimeSeries = async (req, res, next) => {
  try {
    const { period = '7d' } = req.query;

    const allowedPeriods = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };

    if (!allowedPeriods[period]) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid period parameter. Allowed values: 7d, 30d, 90d.',
          statusCode: 400,
        },
      });
    }

    const days = allowedPeriods[period];
    const now = new Date();
    const startTimestamp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1), 0, 0, 0, 0));

    // MongoDB aggregation grouping by YYYY-MM-DD
    const aggResults = await ClickEvent.aggregate([
      { $match: { clickedAt: { $gte: startTimestamp } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$clickedAt', timezone: 'UTC' },
          },
          clicks: { $sum: 1 },
        },
      },
    ]);

    const { startDate, endDate, data } = buildDailyTimeSeries(days, aggResults);
    const totalClicks = data.reduce((sum, item) => sum + item.clicks, 0);

    return res.status(200).json({
      success: true,
      period,
      startDate,
      endDate,
      totalClicks,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/analytics/top-links
 * Returns top 10 short links ranked by clickCount.
 */
export const getTopLinks = async (req, res, next) => {
  try {
    const topLinks = await Url.find({})
      .sort({ clickCount: -1, createdAt: -1 })
      .limit(10)
      .lean();

    const data = topLinks.map((link) => ({
      shortCode: link.shortCode,
      originalUrl: link.originalUrl,
      shortUrl: `${env.baseUrl}/${link.shortCode}`,
      clickCount: link.clickCount,
      createdAt: link.createdAt instanceof Date ? link.createdAt.toISOString() : link.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/analytics/urls/:code
 * Returns click analytics for a specific short link:
 * - Total clicks
 * - Daily click breakdown (past 7 days, zero-filled)
 * - Referrer breakdown
 * - Device breakdown
 * - Browser breakdown
 */
export const getUrlAnalytics = async (req, res, next) => {
  try {
    const { code } = req.params;

    const urlDoc = await Url.findOne({ shortCode: code }).lean();
    const eventCount = await ClickEvent.countDocuments({ shortCode: code });

    // If link has never existed and has no historical events, return 404
    if (!urlDoc && eventCount === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Short link not found.',
          statusCode: 404,
        },
      });
    }

    const totalClicks = urlDoc ? Math.max(urlDoc.clickCount, eventCount) : eventCount;

    // 7-day daily breakdown for this specific code
    const now = new Date();
    const startTimestamp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6, 0, 0, 0, 0));

    const [dailyAgg, referrers, devices, browsers] = await Promise.all([
      ClickEvent.aggregate([
        { $match: { shortCode: code, clickedAt: { $gte: startTimestamp } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$clickedAt', timezone: 'UTC' },
            },
            clicks: { $sum: 1 },
          },
        },
      ]),
      ClickEvent.aggregate([
        { $match: { shortCode: code } },
        { $group: { _id: '$referrer', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, referrer: '$_id', count: 1 } },
      ]),
      ClickEvent.aggregate([
        { $match: { shortCode: code } },
        { $group: { _id: '$device', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, device: '$_id', count: 1 } },
      ]),
      ClickEvent.aggregate([
        { $match: { shortCode: code } },
        { $group: { _id: '$browser', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, browser: '$_id', count: 1 } },
      ]),
    ]);

    const { data: dailyClicks } = buildDailyTimeSeries(7, dailyAgg);

    return res.status(200).json({
      success: true,
      data: {
        shortCode: code,
        originalUrl: urlDoc ? urlDoc.originalUrl : null,
        shortUrl: `${env.baseUrl}/${code}`,
        isDeleted: !urlDoc,
        totalClicks,
        dailyClicks,
        referrers,
        devices,
        browsers,
      },
    });
  } catch (error) {
    return next(error);
  }
};
