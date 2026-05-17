const express = require('express');
const { handleRecommendation } = require('../services/recommendation.service');
const { saveRecommendationLog } = require('../lib/mongo-log');

const router = express.Router();

router.post('/frontend-log', async (req, res) => {
  try {
    await saveRecommendationLog({
      tipo: 'recommendation_frontend',
      event: req.body?.event || 'unknown',
      sessionId: req.body?.sessionId || null,
      payload: req.body?.payload || {},
      source: 'frontend'
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error guardando frontend log Recommendation:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error guardando frontend log Recommendation',
      detail: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await handleRecommendation(req.body);

    await saveRecommendationLog({
      tipo: 'recommendation',
      pregunta: req.body?.message || '',
      budget: req.body?.budget || req.body?.state?.budget || null,
      step: req.body?.step || 'initial',
      state: req.body?.state || null,
      mode: result?.mode || null,
      answer: result?.answer || '',
      nextStep: result?.nextStep || null,
      quickOptions: Array.isArray(result?.quickOptions) ? result.quickOptions : [],
      suggestions: Array.isArray(result?.suggestions) ? result.suggestions : [],
      aiContext: result?.aiContext || null,
      confidence: typeof result?.confidence === 'number' ? result.confidence : null,
      source: 'backend'
    });

    return res.json(result);
  } catch (error) {
    console.error('Error interno Recommendation:', error);

    await saveRecommendationLog({
      tipo: 'recommendation',
      pregunta: req.body?.message || '',
      budget: req.body?.budget || req.body?.state?.budget || null,
      step: req.body?.step || 'initial',
      state: req.body?.state || null,
      mode: 'error',
      answer: '',
      nextStep: null,
      quickOptions: [],
      suggestions: [],
      aiContext: null,
      confidence: null,
      error: error.message,
      source: 'backend'
    });

    return res.status(500).json({
      error: 'Error interno Recommendation',
      detail: error.message
    });
  }
});

module.exports = router;
