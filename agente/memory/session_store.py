from dataclasses import dataclass, field
from typing import Any


@dataclass
class RecommendationSession:
    step: str = "initial"
    state: dict[str, Any] = field(default_factory=dict)
    budget: int | None = None
    active: bool = False


@dataclass
class SessionMemory:
    messages: list[dict[str, str]] = field(default_factory=list)
    recommendation: RecommendationSession = field(default_factory=RecommendationSession)

    def add_user_message(self, content: str) -> None:
        self.messages.append({"role": "user", "content": content})

    def add_assistant_message(self, content: str) -> None:
        self.messages.append({"role": "assistant", "content": content})

    def recent(self, limit: int = 6) -> list[dict[str, str]]:
        return self.messages[-limit:]

    def count(self) -> int:
        return len(self.messages)

    def update_recommendation(
        self,
        step: str,
        state: dict[str, Any],
        budget: int | None,
        active: bool,
    ) -> None:
        self.recommendation.step = step
        self.recommendation.state = state or {}
        self.recommendation.budget = budget
        self.recommendation.active = active

    def clear_recommendation(self) -> None:
        self.recommendation = RecommendationSession()


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionMemory] = {}

    def get(self, session_id: str) -> SessionMemory:
        if session_id not in self._sessions:
            self._sessions[session_id] = SessionMemory()
        return self._sessions[session_id]

    def clear(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)


session_store = SessionStore()
