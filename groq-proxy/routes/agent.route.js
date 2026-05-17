const express = require('express');
const { callAgentChat, callAgentHealth } = require('../services/agent.service');

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const result = await callAgentHealth();
    return res.json(result);
  } catch (error) {
    console.error('Error consultando health de agentes:', error);
    return res.status(502).json({
      ok: false,
      error: 'Servicio de agentes no disponible',
      detail: error.message
    });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const result = await callAgentChat(req.body);
    return res.json(result);
  } catch (error) {
    console.error('Error en adaptador Agent EV2:', error);
    return res.status(502).json({
      error: 'Error conectando con servicio de agentes EV2',
      detail: error.message
    });
  }
});

module.exports = router;
