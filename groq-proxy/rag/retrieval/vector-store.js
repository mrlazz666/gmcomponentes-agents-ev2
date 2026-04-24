const fs = require('fs');
const path = require('path');
const { indexFilePath } = require('../config/rag.config');

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function saveIndex(items) {
  fs.mkdirSync(path.dirname(indexFilePath), { recursive: true });
  fs.writeFileSync(indexFilePath, JSON.stringify(items, null, 2), 'utf8');
}

function loadIndex() {
  if (!fs.existsSync(indexFilePath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(indexFilePath, 'utf8'));
}

function searchSimilar(queryEmbedding, { topK = 5, filterFn = null } = {}) {
  const index = loadIndex();
  const filtered = typeof filterFn === 'function' ? index.filter(filterFn) : index;

  return filtered
    .map(item => ({
      ...item,
      score: cosineSimilarity(queryEmbedding, item.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

module.exports = {
  saveIndex,
  loadIndex,
  searchSimilar
};
