from fastapi import FastAPI

from agents.orchestrator_agent import run_orchestrator
from memory.session_store import session_store
from schemas.agent_schemas import AgentChatRequest, AgentChatResponse


app = FastAPI(
    title="GM-COMPONENTS Agent Service",
    version="0.1.0",
    description="Servicio Python 3.11 para agentes EV2 separado de la app EV1.",
)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "gm-components-agent",
        "python": "3.11",
    }


@app.post("/agent/chat", response_model=AgentChatResponse)
def agent_chat(payload: AgentChatRequest) -> AgentChatResponse:
    return run_orchestrator(payload)


@app.delete("/agent/session/{session_id}")
def clear_session(session_id: str) -> dict:
    session_store.clear(session_id)
    return {
        "ok": True,
        "session_id": session_id,
        "message": "Sesion limpiada.",
    }
