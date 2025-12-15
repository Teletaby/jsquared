import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';

/**
 * Create all necessary database indexes for optimal performance
 * Run this once during app initialization or manually
 */
export async function createDatabaseIndexes() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('jsquared-cinema');

    console.log('[Database] Starting index creation...');

    // Users collection indexes
    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    console.log('[Database] Created index: users.email');

    // Watchlist collection indexes
    const watchlistCollection = db.collection('watchlists');
    await watchlistCollection.createIndex({ userId: 1, mediaId: 1 }, { unique: true });
    await watchlistCollection.createIndex({ userId: 1 });
    console.log('[Database] Created indexes: watchlists.userId, watchlists.userId+mediaId');

    // Watch history collection indexes
    const watchHistoryCollection = db.collection('watch_history');
    await watchHistoryCollection.createIndex({ userId: 1 });
    await watchHistoryCollection.createIndex({ userId: 1, mediaId: 1 });
    await watchHistoryCollection.createIndex({ watchedAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL
    console.log('[Database] Created indexes: watch_history.userId, watch_history.userId+mediaId');

    // Visitor logs collection indexes
    const visitorLogsCollection = db.collection('visitor_logs');
    await visitorLogsCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL
    await visitorLogsCollection.createIndex({ timestamp: 1 });
    await visitorLogsCollection.createIndex({ ipAddress: 1 });
    await visitorLogsCollection.createIndex({ userId: 1 });
    console.log('[Database] Created indexes: visitor_logs.timestamp, visitor_logs.ipAddress, visitor_logs.userId');

    // Chat/Messages collection indexes (if exists)
    try {
      const messagesCollection = db.collection('messages');
      await messagesCollection.createIndex({ userId: 1, createdAt: -1 });
      await messagesCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL
      console.log('[Database] Created indexes: messages.userId+createdAt');
    } catch (error) {
      console.log('[Database] Messages collection not found, skipping indexes');
    }

    // Sessions collection indexes (NextAuth)
    try {
      const sessionsCollection = db.collection('sessions');
      await sessionsCollection.createIndex({ sessionToken: 1 }, { unique: true });
      await sessionsCollection.createIndex({ userId: 1 });
      await sessionsCollection.createIndex({ expires: 1 }, { expireAfterSeconds: 0 }); // Delete expired sessions
      console.log('[Database] Created indexes: sessions.sessionToken, sessions.userId');
    } catch (error) {
      console.log('[Database] Sessions collection not found, skipping indexes');
    }

    console.log('[Database] ✓ All indexes created successfully');
    return true;
  } catch (error) {
    console.error('[Database] Error creating indexes:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Export for manual runs
if (require.main === module) {
  createDatabaseIndexes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
