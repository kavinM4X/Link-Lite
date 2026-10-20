import mongoose from 'mongoose';

const clickEventSchema = new mongoose.Schema(
  {
    shortCode: {
      type: String,
      required: [true, 'shortCode is required for click events'],
      trim: true,
      index: true,
    },
    urlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Url',
      required: true,
      index: true,
    },
    clickedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    referrer: {
      type: String,
      default: 'direct',
      trim: true,
      lowercase: true,
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'bot', 'other'],
      default: 'other',
    },
    browser: {
      type: String,
      enum: ['chrome', 'safari', 'firefox', 'edge', 'opera', 'bot', 'other'],
      default: 'other',
    },
  },
  {
    timestamps: false, // clickedAt represents the event timestamp
  }
);

// Compound index for time-series queries per shortCode
clickEventSchema.index({ shortCode: 1, clickedAt: -1 });

// Note: No TTL index is configured. Click events are permanently retained for historical analytics.

const ClickEvent = mongoose.model('ClickEvent', clickEventSchema);

export default ClickEvent;
