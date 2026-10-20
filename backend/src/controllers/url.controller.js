import Url from '../models/Url.js';
import { env } from '../config/env.js';
import { validateUrl } from '../utils/urlValidator.js';
import { resolveShortCode } from '../services/shortCode.service.js';

// Helper to escape regex special characters for safe MongoDB searches
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Allowed update fields for PATCH /api/urls/:code
const ALLOWED_UPDATE_FIELDS = new Set(['originalUrl', 'expiresAt', 'isActive']);

/**
 * Standardized response formatter for URL documents.
 * Omits internal MongoDB fields (_id, __v) and includes the public shortUrl.
 */
export const formatUrlResponse = (urlDoc) => ({
  originalUrl: urlDoc.originalUrl,
  shortCode: urlDoc.shortCode,
  shortUrl: `${env.baseUrl}/${urlDoc.shortCode}`,
  customAlias: urlDoc.customAlias,
  clickCount: urlDoc.clickCount,
  expiresAt: urlDoc.expiresAt,
  isActive: urlDoc.isActive,
  createdAt: urlDoc.createdAt instanceof Date ? urlDoc.createdAt.toISOString() : urlDoc.createdAt,
  updatedAt: urlDoc.updatedAt instanceof Date ? urlDoc.updatedAt.toISOString() : urlDoc.updatedAt,
});

/**
 * POST /api/urls
 * Controller to create a new short URL link.
 */
export const createShortUrl = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Request body must be a valid JSON object.',
          statusCode: 400,
        },
      });
    }

    const { originalUrl, customAlias, expiresAt } = req.body;

    const urlValidation = validateUrl(originalUrl);
    if (!urlValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          message: urlValidation.error,
          statusCode: 400,
        },
      });
    }

    let aliasToUse = null;
    if (customAlias !== undefined && customAlias !== null) {
      if (typeof customAlias !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Custom alias must be a string.',
            statusCode: 400,
          },
        });
      }
      aliasToUse = customAlias.trim();
      if (aliasToUse.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Custom alias cannot be empty or only whitespace.',
            statusCode: 400,
          },
        });
      }
    }

    let parsedExpiry = null;
    if (expiresAt !== undefined && expiresAt !== null) {
      if (typeof expiresAt !== 'string' && typeof expiresAt !== 'number') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid expiry date format. Must be an ISO date string or timestamp.',
            statusCode: 400,
          },
        });
      }

      const expiryDate = new Date(expiresAt);
      if (isNaN(expiryDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid expiry date. Please provide a valid ISO-8601 date string.',
            statusCode: 400,
          },
        });
      }

      if (expiryDate.getTime() <= Date.now()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Expiry date must be in the future.',
            statusCode: 400,
          },
        });
      }

      parsedExpiry = expiryDate;
    }

    const { shortCode, isCustom } = await resolveShortCode(aliasToUse);

    const newUrl = new Url({
      originalUrl: urlValidation.normalizedUrl,
      shortCode,
      customAlias: isCustom,
      expiresAt: parsedExpiry,
    });

    await newUrl.save();

    return res.status(201).json({
      success: true,
      data: formatUrlResponse(newUrl),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'The requested short code or custom alias is already in use.',
          statusCode: 409,
        },
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        error: {
          message: messages.join('. '),
          statusCode: 400,
        },
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          statusCode: error.statusCode,
        },
      });
    }

    return next(error);
  }
};

/**
 * GET /api/urls
 * Controller to list, search, filter, and paginate short links.
 *
 * Query Parameters:
 * - search: Substring match across shortCode and originalUrl.
 * - status: 'active' | 'expired' | 'inactive'
 * - page: Positive integer, default 1.
 * - limit: Positive integer between 1 and 100, default 10.
 * - sort: Field to sort by, default '-createdAt' (newest first).
 *
 * Note: In this single-user development milestone, all links are returned.
 * Authentication and per-user ownership restrictions will be applied in later steps.
 */
export const getUrls = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 10, sort = 'createdAt' } = req.query;

    // 1. Validate pagination parameters
    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Page parameter must be a positive integer greater than or equal to 1.',
          statusCode: 400,
        },
      });
    }

    const limitNum = Number(limit);
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Limit parameter must be an integer between 1 and 100.',
          statusCode: 400,
        },
      });
    }

    // 2. Validate and construct status filter
    const now = new Date();
    const filterClauses = [];

    if (status !== undefined) {
      const validStatuses = ['active', 'expired', 'inactive'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Invalid status filter "${status}". Allowed values: active, expired, inactive.`,
            statusCode: 400,
          },
        });
      }

      if (status === 'active') {
        filterClauses.push({
          isActive: true,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        });
      } else if (status === 'expired') {
        filterClauses.push({
          expiresAt: { $ne: null, $lte: now },
        });
      } else if (status === 'inactive') {
        filterClauses.push({
          isActive: false,
        });
      }
    }

    // 3. Construct search filter if provided
    if (search !== undefined && search !== null) {
      const trimmedSearch = String(search).trim();
      if (trimmedSearch.length > 100) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Search query cannot exceed 100 characters.',
            statusCode: 400,
          },
        });
      }

      if (trimmedSearch.length > 0) {
        const escaped = escapeRegex(trimmedSearch);
        const searchRegex = new RegExp(escaped, 'i');
        filterClauses.push({
          $or: [{ shortCode: searchRegex }, { originalUrl: searchRegex }],
        });
      }
    }

    // Combine filter clauses with $and if multiple exist
    const finalFilter = filterClauses.length > 1
      ? { $and: filterClauses }
      : filterClauses.length === 1
        ? filterClauses[0]
        : {};

    // 4. Resolve sorting (default: newest first)
    const sortOrder = sort === 'oldest' || sort === 'createdAtAsc' ? 1 : -1;
    const sortField = sort === 'clicks' || sort === 'clickCount' ? 'clickCount' : 'createdAt';
    const sortOption = { [sortField]: sortOrder };

    // 5. Database-level pagination and counting
    const totalRecords = await Url.countDocuments(finalFilter);
    const totalPages = Math.ceil(totalRecords / limitNum);
    const skip = (pageNum - 1) * limitNum;

    const records = await Url.find(finalFilter)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean();

    return res.status(200).json({
      success: true,
      data: records.map(formatUrlResponse),
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/urls/:code
 * Controller to get one short link's details by short code.
 */
export const getUrlByCode = async (req, res, next) => {
  try {
    const { code } = req.params;

    const urlDoc = await Url.findOne({ shortCode: code }).lean();
    if (!urlDoc) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Short link not found.',
          statusCode: 404,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: formatUrlResponse(urlDoc),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/urls/:code
 * Controller to update a short link's editable fields: originalUrl, expiresAt, isActive.
 * Protected fields (shortCode, clickCount, customAlias, _id, createdAt, updatedAt) cannot be modified.
 */
export const updateUrl = async (req, res, next) => {
  try {
    const { code } = req.params;

    // 1. Validate request body presence and format
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Request body cannot be empty and must be a valid JSON object.',
          statusCode: 400,
        },
      });
    }

    // 2. Reject unsupported / protected fields
    const receivedFields = Object.keys(req.body);
    const unsupportedFields = receivedFields.filter((field) => !ALLOWED_UPDATE_FIELDS.has(field));
    if (unsupportedFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Field(s) [${unsupportedFields.join(', ')}] cannot be updated. Protected fields: shortCode, clickCount, customAlias, _id, createdAt, updatedAt. Allowed fields: originalUrl, expiresAt, isActive.`,
          statusCode: 400,
        },
      });
    }

    // 3. Find document by short code
    const urlDoc = await Url.findOne({ shortCode: code });
    if (!urlDoc) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Short link not found.',
          statusCode: 404,
        },
      });
    }

    // 4. Validate and apply updates
    const { originalUrl, expiresAt, isActive } = req.body;

    if (originalUrl !== undefined) {
      const urlValidation = validateUrl(originalUrl);
      if (!urlValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            message: urlValidation.error,
            statusCode: 400,
          },
        });
      }
      urlDoc.originalUrl = urlValidation.normalizedUrl;
    }

    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        urlDoc.expiresAt = null; // Removing expiry
      } else {
        if (typeof expiresAt !== 'string' && typeof expiresAt !== 'number') {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Invalid expiry date format. Must be an ISO date string or timestamp.',
              statusCode: 400,
            },
          });
        }

        const parsedDate = new Date(expiresAt);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Invalid expiry date. Please provide a valid ISO-8601 date string.',
              statusCode: 400,
            },
          });
        }

        if (parsedDate.getTime() <= Date.now()) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Expiry date must be in the future.',
              statusCode: 400,
            },
          });
        }

        urlDoc.expiresAt = parsedDate;
      }
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'isActive must be a boolean (true or false).',
            statusCode: 400,
          },
        });
      }
      urlDoc.isActive = isActive;
    }

    // Save changes (triggers updatedAt management and preserves shortCode, clickCount, etc.)
    await urlDoc.save();

    return res.status(200).json({
      success: true,
      data: formatUrlResponse(urlDoc),
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        error: {
          message: messages.join('. '),
          statusCode: 400,
        },
      });
    }

    return next(error);
  }
};

/**
 * DELETE /api/urls/:code
 * Controller to delete a short link by its short code.
 *
 * Note: Deleting a link permanently removes the document, including its stored clickCount.
 * If historical metrics are required in future designs, separate analytics event collections should be used.
 */
export const deleteUrl = async (req, res, next) => {
  try {
    const { code } = req.params;

    const deleted = await Url.findOneAndDelete({ shortCode: code });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Short link not found.',
          statusCode: 404,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: `Short link "${code}" deleted successfully.`,
    });
  } catch (error) {
    return next(error);
  }
};
