const express = require('express');
const { handleRecommendation } = require('../services/recommendation.service');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await handleRecommendation(req.body);
    return res.json(result);
  } catch (error) {
    console.error('Error interno Recommendation:', error);
    return res.status(500).json({
      error: 'Error interno Recommendation',
      detail: error.message
    });
  }
});

module.exports = router;
