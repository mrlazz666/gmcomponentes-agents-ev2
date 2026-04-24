const { loadFaqDocuments } = require('../documents/faq.documents');
const { loadCatalogDocuments } = require('../documents/catalog.documents');
const { getCatalog } = require('../sources/catalog.source');
const { embedMany } = require('../embeddings/embedder');
const { saveIndex } = require('../retrieval/vector-store');

async function main() {
  const faqDocs = loadFaqDocuments();
  const catalog = await getCatalog();
  const productDocs = loadCatalogDocuments(catalog);

  const allDocs = [...faqDocs, ...productDocs];
  const texts = allDocs.map(doc => `${doc.title}. ${doc.content}`);
  const embeddings = await embedMany(texts, 'document');

  const items = allDocs.map((document, index) => ({
    id: document.id,
    document,
    embedding: embeddings[index]
  }));

  saveIndex(items);
  console.log(`Indice FAQ RAG generado con ${items.length} documentos`);
}

main().catch(error => {
  console.error('Error generando indice:', error);
  process.exit(1);
});
