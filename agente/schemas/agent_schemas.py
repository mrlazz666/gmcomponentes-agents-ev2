from typing import Any, Literal

from pydantic import BaseModel, Field


AgentIntent = Literal["faq", "recommendation", "catalog", "general"]


class AgentChatRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    message: str
    user: dict[str, Any] | None = None
    products: list[dict[str, Any]] = Field(default_factory=list)


class AgentStep(BaseModel):
    name: str
    description: str
    status: Literal["planned", "completed", "skipped"] = "planned"


class AgentChatResponse(BaseModel):
    session_id: str
    intent: AgentIntent
    answer: str
    plan: list[AgentStep]
    memory_messages: int
    used_tools: list[str] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)
