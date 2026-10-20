import mongoose from 'mongoose';

const urlSchema = new mongoose.Schema(
  {
    originalUrl: {
      type: String,
      required: [true, 'Original URL is required'],
      trim: true,
      maxlength: [2048, 'Original URL cannot exceed 2048 characters'],
    },
    shortCode: {
      type: String,
      required: [true, 'Short code is required'],
      trim: true,
      unique: true, // Automatically creates a unique index on shortCode
      minlength: [4, 'Short code must be at least 4 characters long'],
      maxlength: [32, 'Short code cannot exceed 32 characters'],
    },
    customAlias: {
      type: Boolean,
      default: false,
    },
    clickCount: {
      type: Number,
      default: 0,
      min: [0, 'Click count cannot be negative'],
    },
    expiresAt: {
      type: Date,
      default: null, // Note: No TTL index added; expired links remain available for analytics and management
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Url = mongoose.model('Url', urlSchema);

export default Url;
