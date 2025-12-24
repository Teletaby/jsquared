// Bulk backfill script: for a given user, find watch-history docs where
// `sourceSetAt` is missing or older than the user's `lastUsedSourceAt`,
// and update them to the user's `lastUsedSource` with `sourceSetAt = lastUsedSourceAt`.
// Usage:
// MONGO_URL="mongodb://..." node scripts/backfill-user-sources-bulk.js --userId=693a97b60d68d7ee83b43c37 --dryRun
// To apply changes, omit --dryRun or pass --apply

const { MongoClient, ObjectId } = require('mongodb');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('userId', { type: 'string', demandOption: true })
    .option('dryRun', { type: 'boolean', default: true })
    .option('apply', { type: 'boolean', default: false })
    .argv;

  const MONGO_URL = process.env.MONGO_URL || argv.mongoUrl;
  if (!MONGO_URL) {
    console.error('MONGO_URL must be set as env or --mongoUrl');
    process.exit(2);
  }

  const userId = argv.userId;
  const dryRun = argv.dryRun && !argv.apply;

  const client = new MongoClient(MONGO_URL, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db();
    const users = db.collection('users');
    const wh = db.collection('watchhistories');

    const user = await users.findOne(ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { _id: userId });
    if (!user) {
      console.error('User not found:', userId);
      process.exit(2);
    }

    const lastUsedSource = user.lastUsedSource;
    const lastUsedSourceAt = user.lastUsedSourceAt ? new Date(user.lastUsedSourceAt) : null;
    if (!lastUsedSource || !lastUsedSourceAt) {
      console.error('User has no lastUsedSource or lastUsedSourceAt; nothing to backfill.');
      process.exit(0);
    }

    console.log('User:', userId, 'lastUsedSource=', lastUsedSource, 'at', lastUsedSourceAt.toISOString());

    const cursor = wh.find({ userId: ObjectId.isValid(userId) ? new ObjectId(userId) : userId });
    let total = 0;
    let toUpdate = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      total++;
      const sourceSetAt = doc.sourceSetAt ? new Date(doc.sourceSetAt) : null;
      // If no sourceSetAt, or it's older than user's lastUsedSourceAt, plan to update
      if (!sourceSetAt || sourceSetAt < lastUsedSourceAt) {
        toUpdate.push({ _id: doc._id, mediaId: doc.mediaId, currentSource: doc.source, sourceSetAt });
      }
    }

    console.log('Scanned', total, 'watch-history docs for user. Candidates to update:', toUpdate.length);
    if (toUpdate.length > 0) console.log('Examples:', toUpdate.slice(0, 5));

    if (dryRun) {
      console.log('Dry run mode; no updates applied. Run with --apply to make changes.');
      process.exit(0);
    }

    console.log('Applying updates...');
    let modified = 0;
    for (const item of toUpdate) {
      const res = await wh.updateOne(
        { _id: item._id },
        { $set: { source: lastUsedSource, sourceSetAt: lastUsedSourceAt } }
      );
      modified += res.modifiedCount || 0;
    }

    console.log('Applied updates. Modified:', modified);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
