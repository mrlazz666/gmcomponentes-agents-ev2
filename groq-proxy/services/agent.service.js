const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8790';

async function parseAgentResponse(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    return {
      error: 'Respuesta no JSON desde servicio de agentes',
      detail: text
    };
  }
}

async function callAgentChat(payload) {
  const response = await fetch(`${AGENT_SERVICE_URL}/agent/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  });

  const data = await parseAgentResponse(response);

  if (!response.ok) {
    const detail = data.detail || data.error || `HTTP ${response.status}`;
    throw new Error(`Servicio de agentes no disponible: ${detail}`);
  }

  return data;
}

async function callAgentHealth() {
  const response = await fetch(`${AGENT_SERVICE_URL}/health`);
  const data = await parseAgentResponse(response);

  if (!response.ok) {
    throw new Error(`Health agentes fallo con HTTP ${response.status}`);
  }

  return data;
}

module.exports = {
  callAgentChat,
  callAgentHealth
};
