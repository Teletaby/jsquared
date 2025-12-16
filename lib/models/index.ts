import mongoose, { Schema } from 'mongoose';

// User Schema
const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    username: {
      type: String,
      sparse: true,
      unique: true,
    },
    password: {
      type: String,
      sparse: true,
    },
    name: String,
    image: String,
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    provider: {
      type: String,
      enum: ['google', 'credentials'],
      default: 'credentials',
    },
    googleId: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Watch History Schema
const watchHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mediaId: {
      type: Number,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ['movie', 'tv'],
      required: true,
    },
    title: String,
    posterPath: String,
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    totalDuration: {
      type: Number,
      default: 0,
    },
    currentTime: {
      type: Number,
      default: 0,
    },
    totalPlayedSeconds: {
      type: Number,
      default: 0,
    },
    seasonNumber: {
      type: Number,
      sparse: true,
    },
    episodeNumber: {
      type: Number,
      sparse: true,
    },
    lastWatchedAt: {
      type: Date,
      default: Date.now,
    },
    finished: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Watchlist Schema
const watchlistSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mediaId: {
      type: Number,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ['movie', 'tv'],
      required: true,
    },
    title: String,
    posterPath: String,
    rating: Number,
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Settings Schema
const settingsSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'app_settings', // Ensure only one settings document exists
    },
    isMaintenanceMode: {
      type: Boolean,
      default: false,
    },
    isChatbotMaintenanceMode: {
      type: Boolean,
      default: false,
    },
    videoSource: {
      type: String,
      enum: ['videasy', 'vidlink', 'vidsrc'],
      default: 'videasy',
    },
  },
  { timestamps: true }
);

// Create unique compound indexes
// For TV shows, we need seasonNumber and episodeNumber to distinguish episodes
// For movies, we only need userId, mediaId, and mediaType
watchHistorySchema.index(
  { userId: 1, mediaId: 1, mediaType: 1, seasonNumber: 1, episodeNumber: 1 },
  { unique: true, sparse: true } // sparse allows null seasonNumber/episodeNumber for movies
);
watchlistSchema.index({ userId: 1, mediaId: 1, mediaType: 1 }, { unique: true });

// Models
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const WatchHistory = mongoose.models.WatchHistory || mongoose.model('WatchHistory', watchHistorySchema);
export const Watchlist = mongoose.models.Watchlist || mongoose.model('Watchlist', watchlistSchema);
export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
