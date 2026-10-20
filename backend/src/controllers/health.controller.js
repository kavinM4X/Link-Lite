import mongoose from 'mongoose';
import { env } from '../config/env.js';

const READY_STATE_MAP = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Controller to handle health check requests.
 * Returns server and database health status as JSON.
 */
export const getHealthStatus = (req, res) => {
  const dbStateNumber = mongoose.connection.readyState;
  const dbState = READY_STATE_MAP[dbStateNumber] || 'unknown';
  const isDbHealthy = dbStateNumber === 1;

  const healthData = {
    name: 'LinkLite API',
    status: isDbHealthy ? 'healthy' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    services: {
      server: {
        status: 'up',
      },
      database: {
        status: dbState,
        readyState: dbStateNumber,
      },
    },
  };

  const statusCode = isDbHealthy ? 200 : 503;
  return res.status(statusCode).json(healthData);
};
