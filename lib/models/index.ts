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
    // Keep track of the user's last chosen video source so we can resume it the next time
    lastUsedSource: {
      type: String,
      enum: ['videasy', 'vidlink', 'vidnest', 'vidsrc'],
      sparse: true,
    },
    // Timestamp when the user last used their chosen video source
    lastUsedSourceAt: {
      type: Date,
      sparse: true,
    },
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
    // Which source the user used when this history entry was saved
    source: {
      type: String,
      enum: ['videasy', 'vidlink', 'vidnest', 'vidsrc'],
      sparse: true,
    },
    // Timestamp when the `source` field was last set (helps distinguish automated heartbeats)
    sourceSetAt: {
      type: Date,
      sparse: true,
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

// Add debug hooks to surface any writes to lastUsedSource
userSchema.post('findOneAndUpdate', function(doc: any) {
  try {
    console.log('[User Hook][findOneAndUpdate] user updated via findOneAndUpdate:', { _id: doc?._id, lastUsedSource: doc?.lastUsedSource, lastUsedSourceAt: doc?.lastUsedSourceAt });
  } catch (e) { console.error('[User Hook] error in findOneAndUpdate hook', e); }
});

userSchema.post('updateOne', function(res: any) {
  try {
    console.log('[User Hook][updateOne] updateOne executed on User model');
  } catch (e) { console.error('[User Hook] error in updateOne hook', e); }
});

userSchema.post('save', function(doc: any) {
  try {
    console.log('[User Hook][save] user saved:', { _id: doc?._id, lastUsedSource: doc?.lastUsedSource, lastUsedSourceAt: doc?.lastUsedSourceAt });
  } catch (e) { console.error('[User Hook] error in save hook', e); }
});

// Models
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const WatchHistory = mongoose.models.WatchHistory || mongoose.model('WatchHistory', watchHistorySchema);
export const Watchlist = mongoose.models.Watchlist || mongoose.model('Watchlist', watchlistSchema);
export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
