import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Connect to MongoDB using Mongoose.
 * Sets up connection event listeners and ensures the connection succeeds
 * before resolving.
 */
export const connectDB = async () => {
  // Set up connection event listeners
  mongoose.connection.on('connected', () => {
    console.log(`✅ MongoDB connected successfully to: ${mongoose.connection.host}/${mongoose.connection.name}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB runtime connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected.');
  });

  try {
    console.log('🔄 Connecting to MongoDB...');
    const conn = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
    });
    return conn;
  } catch (error) {
    console.error('❌ Failed to establish initial connection to MongoDB:');
    console.error(`   ${error.message}`);
    throw error;
  }
};

/**
 * Gracefully disconnect from MongoDB.
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('🔌 MongoDB connection closed gracefully.');
  } catch (err) {
    console.error('❌ Error while closing MongoDB connection:', err.message);
  }
};
