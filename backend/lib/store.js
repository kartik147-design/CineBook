const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');

function createStore(fileName, initialValue) {
  const dataDirectory = process.env.CINEBOOK_DATA_DIR
    ? path.resolve(process.env.CINEBOOK_DATA_DIR)
    : path.join(__dirname, '..', 'data');
  const filePath = path.join(dataDirectory, fileName);
  let data = initialValue;
  let writeQueue = Promise.resolve();

  if (!process.env.MONGODB_URI) {
    fs.mkdirSync(dataDirectory, { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(initialValue, null, 2));
    }
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`Unable to read CineBook store "${fileName}": ${error.message}`);
    }

    return {
      ready: Promise.resolve(),
      get: () => data,
      save: () => {
        const tempPath = `${filePath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
        fs.renameSync(tempPath, filePath);
      },
      health: async () => true,
    };
  }

  if (Boolean(process.env.MONGODB_USERNAME) !== Boolean(process.env.MONGODB_PASSWORD)) {
    throw new Error('Set both MONGODB_USERNAME and MONGODB_PASSWORD to authenticate with MongoDB.');
  }

  let seedData = initialValue;
  if (fs.existsSync(filePath)) {
    try {
      seedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`Unable to read legacy CineBook store "${fileName}": ${error.message}`);
    }
    if (!seedData || typeof seedData !== 'object' || Array.isArray(seedData)) {
      throw new Error(`Legacy CineBook store "${fileName}" must contain a JSON object.`);
    }
  }

  const client = new MongoClient(process.env.MONGODB_URI, {
    ...(process.env.MONGODB_USERNAME && !hasUriCredentials(process.env.MONGODB_URI)
      ? {
          auth: {
            username: process.env.MONGODB_USERNAME,
            password: process.env.MONGODB_PASSWORD,
          },
          authSource: process.env.MONGODB_AUTH_SOURCE || 'admin',
        }
      : {}),
  });
  const collectionName = path.basename(fileName, path.extname(fileName));
  let collection;
  const ready = client.connect().then(async () => {
    collection = client.db(process.env.MONGODB_DATABASE || 'cinebook')
      .collection(`cinebook_${collectionName}`);
    await collection.updateOne(
      { _id: 'state' },
      { $setOnInsert: { data: seedData } },
      { upsert: true },
    );
    const document = await collection.findOne({ _id: 'state' });
    if (!document || !document.data || typeof document.data !== 'object') {
      throw new Error(`MongoDB store "${collectionName}" has an invalid state document.`);
    }
    for (const key of Object.keys(data)) delete data[key];
    Object.assign(data, document.data);
  });

  return {
    ready,
    get: () => data,
    save: () => {
      const snapshot = structuredClone(data);
      writeQueue = writeQueue.catch(() => {}).then(() =>
        collection.replaceOne({ _id: 'state' }, { _id: 'state', data: snapshot }, { upsert: true }),
      );
      return writeQueue;
    },
    health: async () => {
      await ready;
      await client.db(process.env.MONGODB_DATABASE || 'cinebook').command({ ping: 1 });
      return true;
    },
  };
}

function hasUriCredentials(uri) {
  try {
    const parsed = new URL(uri);
    return Boolean(parsed.username || parsed.password);
  } catch {
    return false;
  }
}

module.exports = { createStore };
