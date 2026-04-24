const express = require('express');
const { handleFaq } = require('../services/faq.service');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await handleFaq(req.body);
    return res.json(result);
  } catch (error) {
    console.error('Error interno FAQ:', error);
    return res.status(500).json({
      error: 'Error interno FAQ',
      detail: error.message
    });
  }
});

module.exports = router;
