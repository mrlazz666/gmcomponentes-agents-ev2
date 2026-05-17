from memory.session_store import session_store


def get_recent_context(session_id: str, limit: int = 6) -> str:
    memory = session_store.get(session_id)
    recent_messages = memory.recent(limit)

    if not recent_messages:
        return "Sin contexto previo."

    lines = []
    for message in recent_messages:
        role = "Usuario" if message["role"] == "user" else "Asistente"
        lines.append(f"{role}: {message['content']}")

    return "\n".join(lines)
