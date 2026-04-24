const fs = require('fs');
const { faqJsonPath } = require('../config/rag.config');

function normalizeText(value) {
  return String(value || '').trim();
}

function loadFaqDocuments() {
  const raw = JSON.parse(fs.readFileSync(faqJsonPath, 'utf8'));

  return raw.map(item => ({
    id: item.id,
    sourceType: 'faq',
    title: normalizeText(item.pregunta),
    content: normalizeText(item.respuesta),
    metadata: {
      topic: 'faq',
      source: 'faq-gmcomponents.json'
    }
  }));
}

module.exports = {
  loadFaqDocuments
};
