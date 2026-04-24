const { callGroq } = require('../../lib/groq-client');
const { faqPrompt } = require('../../knowledge/system-prompts');
const { getCatalog } = require('../sources/catalog.source');
const { retrieveFaqContext } = require('../retrieval/retrieve-faq-context');

async function runFaqRagPipeline({ pregunta, productosFallback = [] }) {
  const catalog = await getCatalog({ fallbackProducts: productosFallback });

  // Aunque retrieveFaqContext use el índice guardado,
  // dejamos el catálogo disponible para futuras mejoras.
  const retrievalResult = await retrieveFaqContext(pregunta, catalog);

  const llmResult = await callGroq([
    {
      role: 'system',
      content: faqPrompt
    },
    {
      role: 'user',
      content: JSON.stringify({
        pregunta,
        contextoRag: {
          analisis: retrievalResult.analysis,
          foundExactMatch: retrievalResult.foundExactMatch,
          productoDestacado: retrievalResult.featuredProduct,
          productosRelacionados: retrievalResult.relatedProducts,
          documentos: retrievalResult.documentos
        }
      })
    }
  ]);

  return {
    llm: llmResult,
    retrieval: retrievalResult
  };
}

module.exports = {
  runFaqRagPipeline
};
