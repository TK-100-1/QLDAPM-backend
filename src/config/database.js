import mongoose from 'mongoose';

let db = null;

async function connectDatabase() {
  const mongoURI = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME;

  if (!mongoURI || !dbName) {
    throw new Error('Required environment variables MONGO_URI and MONGO_DB_NAME are missing!');
  }

  await mongoose.connect(mongoURI, {
    dbName,
    serverSelectionTimeoutMS: 10000,
  });

  db = mongoose.connection.db;
  console.log('Connected to MongoDB!');
}

async function connectDatabaseWithRetry(maxRetries = 3, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await connectDatabase();
      return;
    } catch (err) {
      console.log(`Failed to connect to MongoDB (attempt ${i + 1}/${maxRetries}): ${err.message}`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    console.log('Attempting to disconnect from MongoDB...');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

function getDb() {
  return db;
}

export {
  connectDatabase,
  connectDatabaseWithRetry,
  disconnectDatabase,
  getDb,
};
