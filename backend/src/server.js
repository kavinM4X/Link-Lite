import app from './app.js';
import { env, validateEnv } from './config/env.js';
import { connectDB, disconnectDB } from './config/database.js';

// Validate environment variables before initialization
validateEnv();

let server;

const startServer = async () => {
  try {
    // 1. Establish database connection before accepting any incoming requests
    await connectDB();

    // 2. Start HTTP server only after database connection succeeds
    server = app.listen(env.port, () => {
      console.log('----------------------------------------------------');
      console.log(`🚀 LinkLite Server running in [${env.nodeEnv}] mode`);
      console.log(`📡 Listening on: http://localhost:${env.port}`);
      console.log(`🩺 Health check: http://localhost:${env.port}/api/health`);
      console.log('----------------------------------------------------');
    });
  } catch (error) {
    console.error('❌ Server startup aborted due to database connection failure.');
    console.error('   Please ensure MongoDB is running and MONGODB_URI is correct in your .env file.');
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('🛑 HTTP server closed.');
      await disconnectDB();
      console.log('👋 Process terminated gracefully.');
      process.exit(0);
    });
  } else {
    await disconnectDB();
    process.exit(0);
  }

  // Force exit if shutdown takes too long (e.g. 10s)
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating process due to shutdown timeout.');
    process.exit(1);
  }, 10000);
};

// Process event listeners
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception thrown:', error);
  process.exit(1);
});

// Launch server
startServer();
