const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.join(__dirname, '..', '..', '.env')
});

module.exports = {
  catalogApiUrl: process.env.CATALOG_API_URL || 'https://gmcomponents.onrender.com/backend/products/',
  faqJsonPath: path.join(__dirname, '..', '..', 'knowledge', 'faq-gmcomponents.json'),
  indexFilePath: path.join(__dirname, '..', 'data', 'faq.index.json'),
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY || '',
    model: process.env.VOYAGE_MODEL || 'voyage-4-lite',
    embeddingsUrl: process.env.VOYAGE_EMBEDDINGS_URL || 'https://api.voyageai.com/v1/embeddings'
  },    
  retrieval: {
    topKFaq: 4,
    topKProducts: 8,
    minScore: 0.15
  }
};
