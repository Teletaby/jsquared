// One-off script to update a user's watch-history `source` and `sourceSetAt`.
// Usage examples:
// MONGO_URL="mongodb://..." node scripts/backfill-user-source.js --userId=693a97b60d68d7ee83b43c37 --mediaId=1228246 --source=vidnest --sourceSetAt=2025-12-24T15:47:23.958Z
// Or set ENV: USER_ID and MEDIA_ID and SOURCE and SOURCE_SET_AT

const { MongoClient, ObjectId } = require('mongodb');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

async function main() {
  const argv = yargs(hideBin(process.argv)).argv;
  const MONGO_URL = process.env.MONGO_URL || argv.mongoUrl;
  if (!MONGO_URL) {
    console.error('MONGO_URL must be set as env or --mongoUrl');
    process.exit(2);
  }

  const userId = argv.userId || process.env.USER_ID;
  const mediaId = argv.mediaId || process.env.MEDIA_ID;
  const source = argv.source || process.env.SOURCE || 'vidnest';
  const sourceSetAtRaw = argv.sourceSetAt || process.env.SOURCE_SET_AT;

  if (!userId || !mediaId) {
    console.error('Provide --userId and --mediaId (or set USER_ID and MEDIA_ID env vars)');
    process.exit(2);
  }

  const sourceSetAt = sourceSetAtRaw ? new Date(sourceSetAtRaw) : new Date();

  const client = new MongoClient(MONGO_URL, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('watchhistories');

    const filter = {
      userId: ObjectId.isValid(userId) ? new ObjectId(userId) : userId,
      mediaId: typeof mediaId === 'string' && /^[0-9]+$/.test(mediaId) ? Number(mediaId) : mediaId,
    };

    console.log('Filter:', filter);

    const before = await col.findOne(filter);
    console.log('Before:', before);

    const update = {
      $set: {
        source,
        sourceSetAt,
      },
    };

    const res = await col.updateOne(filter, update);
    console.log('Matched:', res.matchedCount, 'Modified:', res.modifiedCount);

    const after = await col.findOne(filter);
    console.log('After:', after);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
