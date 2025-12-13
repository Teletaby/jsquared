import { MongoClient, Db, Collection } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    console.log('Using cached database connection');
    return { client: cachedClient, db: cachedDb };
  }

  console.log('Creating new database connection...');
  console.log('MONGODB_URI exists:', !!MONGODB_URI);
  
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  const client = await MongoClient.connect(MONGODB_URI);
  console.log('MongoDB client connected');
  
  const db = client.db('jsquared-cinema');
  console.log('Database selected: jsquared-cinema');

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export { connectToDatabase };

export interface VisitorLog {
  _id?: string;
  ipAddress: string;
  userAgent: string;
  browser: string;
  browserVersion: string;
  operatingSystem: string;
  isp?: string;
  timestamp: Date;
  url: string;
  referer?: string;
  country?: string;
  city?: string;
  pageLoadTime?: number;
  userId?: string; // If user is logged in
}

export async function logVisitor(visitorData: VisitorLog) {
  try {
    console.log('logVisitor function called with data:', visitorData);
    const { db } = await connectToDatabase();
    console.log('Database connection established');
    
    const visitorLogsCollection: Collection<VisitorLog> = db.collection('visitor_logs');
    console.log('Got visitor_logs collection');

    // Create index on timestamp for efficient querying
    await visitorLogsCollection.createIndex({ timestamp: -1 });
    await visitorLogsCollection.createIndex({ ipAddress: 1 });
    console.log('Indexes created/verified');

    const result = await visitorLogsCollection.insertOne({
      ...visitorData,
      timestamp: new Date(),
    });

    console.log('Insert result:', result);
    console.log('Visitor logged successfully with ID:', result.insertedId);
    return result;
  } catch (error) {
    console.error('Error logging visitor:', error);
    throw error;
  }
}

export async function getVisitorLogs(
  limit: number = 100,
  skip: number = 0
) {
  try {
    const { db } = await connectToDatabase();
    const visitorLogsCollection: Collection<VisitorLog> = db.collection('visitor_logs');

    const logs = await visitorLogsCollection
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .toArray();

    return logs;
  } catch (error) {
    console.error('Error fetching visitor logs:', error);
    throw error;
  }
}

export async function getVisitorLogsCount() {
  try {
    const { db } = await connectToDatabase();
    const visitorLogsCollection: Collection<VisitorLog> = db.collection('visitor_logs');

    const count = await visitorLogsCollection.countDocuments();
    return count;
  } catch (error) {
    console.error('Error counting visitor logs:', error);
    throw error;
  }
}

export async function deleteOldVisitorLogs(daysOld: number = 30) {
  try {
    const { db } = await connectToDatabase();
    const visitorLogsCollection: Collection<VisitorLog> = db.collection('visitor_logs');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await visitorLogsCollection.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    return result;
  } catch (error) {
    console.error('Error deleting old visitor logs:', error);
    throw error;
  }
}
