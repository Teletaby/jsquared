// One-time script to remove base64 images from user documents
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await mongoose.connection.db.collection('users').updateMany(
    { image: { $regex: '^data:' } },
    { $set: { image: null } }
  );
  console.log('Cleaned base64 images from', result.modifiedCount, 'users');
  await mongoose.disconnect();
}

clean().catch(e => { console.error(e); process.exit(1); });
