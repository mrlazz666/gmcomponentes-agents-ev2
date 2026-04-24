const { voyage } = require('../config/rag.config');

async function embedText(text, inputType = 'document') {
  if (!voyage.apiKey) {
    throw new Error('Falta VOYAGE_API_KEY en el archivo .env');
  }

  const response = await fetch(voyage.embeddingsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${voyage.apiKey}`
    },
    body: JSON.stringify({
      input: text,
      model: voyage.model,
      input_type: inputType
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voyage embeddings error: ${errorText}`);
  }

  const data = await response.json();
  return data?.data?.[0]?.embedding || null;
}

async function embedMany(texts, inputType = 'document') {
  if (!voyage.apiKey) {
    throw new Error('Falta VOYAGE_API_KEY en el archivo .env');
  }

  const response = await fetch(voyage.embeddingsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${voyage.apiKey}`
    },
    body: JSON.stringify({
      input: texts,
      model: voyage.model,
      input_type: inputType
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voyage embeddings error: ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data?.data) ? data.data.map(item => item.embedding) : [];
}

module.exports = {
  embedText,
  embedMany
};
