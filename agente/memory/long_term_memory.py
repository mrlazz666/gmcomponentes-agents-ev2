import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class LongTermMemory:
    """
    Memoria de largo plazo local para EV2.

    Persiste hechos simples por session_id en un archivo JSON separado de EV1.
    No modifica FAQ/RAG ni Recommendation; solo guarda y recupera contexto.
    """

    def __init__(self, store_path: str | None = None) -> None:
        self.store_path = Path(store_path or Path(__file__).resolve().parents[1] / "logs" / "long_term_store.json")

    def _load_store(self) -> dict[str, list[dict[str, Any]]]:
        if not self.store_path.exists():
            return {}

        try:
            with self.store_path.open("r", encoding="utf-8") as file:
                data = json.load(file)
                return data if isinstance(data, dict) else {}
        except (json.JSONDecodeError, OSError):
            return {}

    def _save_store(self, store: dict[str, list[dict[str, Any]]]) -> None:
        self.store_path.parent.mkdir(parents=True, exist_ok=True)

        with self.store_path.open("w", encoding="utf-8") as file:
            json.dump(store, file, ensure_ascii=False, indent=2)

    def _tokens(self, text: str) -> set[str]:
        normalized = text.lower()
        words = re.findall(r"[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+", normalized)

        return {
            word
            for word in words
            if len(word) >= 3
        }

    def save_fact(
        self,
        session_id: str,
        fact: str,
        memory_type: str,
        source: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        store = self._load_store()
        session_memories = store.setdefault(session_id, [])

        item = {
            "type": memory_type,
            "fact": fact,
            "source": source,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        session_memories.append(item)

        # Mantiene la memoria acotada para que el archivo local no crezca sin control.
        store[session_id] = session_memories[-50:]

        self._save_store(store)
        return item

    def search(
        self,
        session_id: str,
        query: str,
        memory_type: str | None = None,
        limit: int = 3,
    ) -> list[dict[str, Any]]:
        store = self._load_store()
        session_memories = store.get(session_id, [])
        query_tokens = self._tokens(query)

        if not query_tokens:
            return session_memories[-limit:]

        matches: list[tuple[int, dict[str, Any]]] = []

        for item in session_memories:
            if memory_type and item.get("type") != memory_type:
                continue

            searchable_text = " ".join(
                [
                    str(item.get("fact", "")),
                    str(item.get("source", "")),
                    json.dumps(item.get("metadata", {}), ensure_ascii=False),
                ]
            )

            item_tokens = self._tokens(searchable_text)
            score = len(query_tokens.intersection(item_tokens))

            if score > 0:
                matches.append((score, item))

        matches.sort(key=lambda pair: pair[0], reverse=True)
        return [item for _, item in matches[:limit]]


long_term_memory = LongTermMemory()
