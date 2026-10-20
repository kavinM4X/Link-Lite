import dotenv from 'dotenv';

// Load environment variables from .env file if present
dotenv.config();

/**
 * Validates required environment variables and returns normalized configuration.
 */
export const validateEnv = () => {
  const missing = [];

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    missing.push('MONGODB_URI (or MONGO_URI)');
  }

  if (process.env.BASE_URL) {
    try {
      const parsed = new URL(process.env.BASE_URL);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        console.error('❌ Environment configuration error: BASE_URL must use http or https protocol.');
        process.exit(1);
      }
    } catch {
      console.error('❌ Environment configuration error: BASE_URL is not a valid URL.');
      process.exit(1);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Environment configuration error:');
    console.error(`   Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('   Please check your .env file or refer to .env.example\n');
    process.exit(1);
  }
};

const port = parseInt(process.env.PORT, 10) || 5000;
const rawBaseUrl = process.env.BASE_URL ? process.env.BASE_URL.trim() : `http://localhost:${port}`;
// Remove trailing slash if present
const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

// Reverse proxy configuration: enabled in production or if explicitly configured
const trustProxy = process.env.TRUST_PROXY !== undefined
  ? (process.env.TRUST_PROXY === 'true' ? true : parseInt(process.env.TRUST_PROXY, 10) || process.env.TRUST_PROXY)
  : (process.env.NODE_ENV === 'production' ? 1 : false);

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/linklite';

export const env = {
  port,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  baseUrl,
  trustProxy,
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

