import { MongoClient, Db, Collection } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }
  
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  const client = await MongoClient.connect(MONGODB_URI);
  
  const db = client.db('jsquared-cinema');

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
  // Optional visit tracking fields
  visitId?: string;
  startTime?: Date;
  endTime?: Date;
  durationSeconds?: number;
}

export async function logVisitor(visitorData: VisitorLog) {
  try {
    const { db } = await connectToDatabase();
    
    const visitorLogsCollection: Collection<VisitorLog> = db.collection('visitor_logs');

    // Create index on timestamp for efficient querying
    await visitorLogsCollection.createIndex({ timestamp: -1 });
    await visitorLogsCollection.createIndex({ ipAddress: 1 });
    await visitorLogsCollection.createIndex({ visitId: 1 });

    const result = await visitorLogsCollection.insertOne({
      ...visitorData,
      timestamp: new Date(),
    });

    return result;
  } catch (error) {
    throw error;
  }
}

// Update an existing visit entry with an end time and duration. If no document exists, do an upsert.
export async function finalizeVisit(visitId: string, endTime: Date, durationSeconds?: number) {
  try {
    if (!visitId) return;
    const { db } = await connectToDatabase();
    const visitorLogsCollection: Collection<VisitorLog> = db.collection('visitor_logs');

    // Attempt to calculate duration from stored startTime if none provided
    let duration = durationSeconds;
    if (duration === undefined) {
      const existing = await visitorLogsCollection.findOne({ visitId });
      if (existing?.startTime) {
        const st = new Date(existing.startTime);
        duration = Math.max(0, Math.round((endTime.getTime() - st.getTime()) / 1000));
      } else {
        duration = undefined;
      }
    }

    // Update the existing start record if present; otherwise insert a short record representing the visit end
    const result: any = await visitorLogsCollection.findOneAndUpdate(
      { visitId },
      {
        $set: {
          endTime,
          durationSeconds: duration,
        }
      },
      { returnDocument: 'after' }
    );

    if (!result || !result.value) {
      // No existing visit found; insert a minimal document
      await visitorLogsCollection.insertOne({ visitId, endTime, durationSeconds: duration, timestamp: new Date() } as any);
    }

    return result;
  } catch (error) {
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

    // Aggregate by visitId when available, otherwise treat each document as its own visit
    // We sort newest timestamp first so $first after $sort picks the most recent doc for each visit
    const pipeline = [
      {
        $addFields: {
          visitKey: {
            $cond: [ { $ifNull: ["$visitId", false] }, "$visitId", { $toString: "$_id" } ]
          }
        }
      },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$visitKey",
          latestDoc: { $first: "$$ROOT" },
          startTime: { $min: "$startTime" },
          endTime: { $max: "$endTime" },
          durationSeconds: { $max: "$durationSeconds" },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          visitId: "$_id",
          ipAddress: { $ifNull: ["$latestDoc.ipAddress", "N/A"] },
          userAgent: "$latestDoc.userAgent",
          browser: { $ifNull: ["$latestDoc.browser", "Unknown"] },
          browserVersion: { $ifNull: ["$latestDoc.browserVersion", "Unknown"] },
          os: { $ifNull: ["$latestDoc.operatingSystem", "Unknown"] },
          url: { $ifNull: ["$latestDoc.url", "N/A"] },
          timestamp: { $ifNull: [ "$startTime", "$latestDoc.timestamp" ] },
          startTime: "$startTime",
          endTime: "$endTime",
          durationSeconds: { $ifNull: [ "$durationSeconds", { $cond: [ { $and: [ { $ifNull: ["$startTime", false] }, { $ifNull: ["$endTime", false] } ] }, { $divide: [ { $subtract: [ "$endTime", "$startTime" ] }, 1000 ] }, null ] } ] },
          entries: "$count",
        }
      },
      { $sort: { timestamp: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    const cursor = await visitorLogsCollection.aggregate(pipeline);
    const logs = await cursor.toArray();

    return logs;
  } catch (error) {
    throw error;
  }
}

export async function getVisitorLogsCount() {
  try {
    const { db } = await connectToDatabase();
    const visitorLogsCollection: Collection<VisitorLog> = db.collection('visitor_logs');

    // Count unique visits (grouped by visitId when present, otherwise by doc _id)
    const pipeline = [
      {
        $addFields: {
          visitKey: {
            $cond: [ { $ifNull: ["$visitId", false] }, "$visitId", { $toString: "$_id" } ]
          }
        }
      },
      {
        $group: {
          _id: "$visitKey"
        }
      },
      { $count: "count" }
    ];

    const res = await visitorLogsCollection.aggregate(pipeline).toArray();
    const count = (res && res[0] && res[0].count) ? res[0].count : 0;
    return count;
  } catch (error) {
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
    throw error;
  }
}
