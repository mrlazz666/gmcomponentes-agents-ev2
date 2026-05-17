from memory.short_term_memory import get_recent_context


def get_memory_context(session_id: str) -> str:
    return get_recent_context(session_id)
