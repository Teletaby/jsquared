const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function dropOldIndex() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(mongoUri);
    console.log('Connected successfully');
    
    const db = mongoose.connection;
    const collection = db.collection('watchhistories');
    
    // List all indexes
    const indexes = await collection.listIndexes().toArray();
    console.log('Current indexes:');
    indexes.forEach(index => {
      console.log('  -', index.name);
    });
    
    // Drop the old index
    try {
      await collection.dropIndex('userId_1_mediaId_1_mediaType_1');
      console.log('\n✓ Old index dropped successfully');
    } catch (err) {
      if (err.code === 27 || err.message.includes('index not found')) {
        console.log('\n✓ Index does not exist, which is fine');
      } else {
        throw err;
      }
    }
    
    // List indexes again to confirm
    const indexesAfter = await collection.listIndexes().toArray();
    console.log('\nIndexes after deletion:');
    indexesAfter.forEach(index => {
      console.log('  -', index.name);
    });
    
    console.log('\n✓ Done! The new index will be created automatically on next app startup.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

dropOldIndex();
