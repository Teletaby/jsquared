import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/models';
import { updateUserLastUsedSource } from '@/lib/watchHistoryUtils';

async function run() {
  await connectToDatabase();

  // Create a temporary test user
  const email = `test+repro-${Date.now()}@example.com`;
  const user = await User.create({ email, username: `repro_${Date.now()}` });
  console.log('Created test user', { id: String(user._id), email });

  try {
    // 1) Explicit save (force=true) -> should persist
    const explicitAt = new Date();
    console.log('Applying explicit save (vidnest) at', explicitAt.toISOString());
    await updateUserLastUsedSource(user._id, 'vidnest', explicitAt, true);

    const afterExplicit = await User.findById(user._id).lean();
    console.log('After explicit save:', { lastUsedSource: afterExplicit?.lastUsedSource, lastUsedSourceAt: afterExplicit?.lastUsedSourceAt });

    // 2) Non-explicit heartbeat (force=false) with later timestamp -> should NOT overwrite
    const heartbeatAt = new Date(Date.now() + 1000);
    console.log('Applying non-explicit heartbeat (vidlink) at', heartbeatAt.toISOString());
    await updateUserLastUsedSource(user._id, 'vidlink', heartbeatAt, false);

    const afterHeartbeat = await User.findById(user._id).lean();
    console.log('After heartbeat:', { lastUsedSource: afterHeartbeat?.lastUsedSource, lastUsedSourceAt: afterHeartbeat?.lastUsedSourceAt });

    if (afterHeartbeat?.lastUsedSource !== 'vidnest') {
      console.error('Repro failed: lastUsedSource was overwritten by non-explicit update');
      process.exitCode = 2;
    } else {
      console.log('Repro succeeded: lastUsedSource remains vidnest (non-explicit update was skipped)');
    }
  } finally {
    // cleanup
    await User.deleteOne({ _id: user._id });
    console.log('Cleaned up test user');
    process.exit();
  }
}

run().catch((e) => {
  console.error('Error running repro script:', e);
  process.exit(1);
});