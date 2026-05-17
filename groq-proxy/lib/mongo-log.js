const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'gmcomponents_ai';
const collectionName = process.env.MONGODB_COLLECTION || 'faq_logs';
const recommendationCollectionName = process.env.MONGODB_RECOMMENDATION_COLLECTION || collectionName;
const ttlSeconds = Number(process.env.MONGODB_TTL_SECONDS || 60);

let clientPromise = null;
let collectionPromise = null;
let recommendationCollectionPromise = null;

async function getClient() {
  if (!uri) {
    throw new Error('MONGODB_URI no esta configurado');
  }

  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

async function getCollection() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const client = await getClient();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      await collection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: ttlSeconds }
      );

      return collection;
    })();
  }

  return collectionPromise;
}

async function getRecommendationCollection() {
  if (!recommendationCollectionPromise) {
    recommendationCollectionPromise = (async () => {
      const client = await getClient();
      const db = client.db(dbName);
      const collection = db.collection(recommendationCollectionName);

      await collection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: ttlSeconds }
      );

      return collection;
    })();
  }

  return recommendationCollectionPromise;
}

async function saveFaqLog(logData) {
  try {
    const collection = await getCollection();

    await collection.insertOne({
      ...logData,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Error guardando log FAQ en MongoDB:', error.message);
  }
}

async function saveRecommendationLog(logData) {
  try {
    const collection = await getRecommendationCollection();

    await collection.insertOne({
      ...logData,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Error guardando log Recommendation en MongoDB:', error.message);
  }
}

module.exports = {
  saveFaqLog,
  saveRecommendationLog
};
