import { VisitorLog } from './visitorLogging';
import { connectToDatabase } from './visitorLogging';

// Batch configuration
const BATCH_SIZE = 20; // Write after collecting 20 logs
const BATCH_TIMEOUT = 30 * 1000; // Write after 30 seconds regardless

interface BatchedLog extends VisitorLog {}

let logBatch: BatchedLog[] = [];
let batchTimeout: NodeJS.Timeout | null = null;

/**
 * Write batched logs to database
 */
async function flushLogs(): Promise<void> {
  if (logBatch.length === 0) {
    return;
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('visitor_logs');
    
    // Write all logs at once (cast to any to avoid type conflict)
    await collection.insertMany([...logBatch] as any);
    
    console.log(`[Visitor Logging] Batch written: ${logBatch.length} logs`);
    logBatch = [];
    
    // Clear timeout
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
  } catch (error) {
    console.error('[Visitor Logging] Error writing batch:', error);
    // Keep logs in batch for retry
  }
}

/**
 * Queue a visitor log for batch writing
 */
export async function queueVisitorLog(visitorData: VisitorLog): Promise<void> {
  logBatch.push(visitorData);

  // If batch is full, flush immediately
  if (logBatch.length >= BATCH_SIZE) {
    await flushLogs();
  } else if (!batchTimeout) {
    // Set timeout to flush after BATCH_TIMEOUT
    batchTimeout = setTimeout(async () => {
      await flushLogs();
    }, BATCH_TIMEOUT);
  }
}

/**
 * Force flush all pending logs
 */
export async function flushVisitorLogs(): Promise<void> {
  await flushLogs();
}

/**
 * Get pending batch size (for debugging)
 */
export function getPendingBatchSize(): number {
  return logBatch.length;
}
