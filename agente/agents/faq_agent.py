from memory.long_term_memory import long_term_memory
from tools.langchain_tool_registry import invoke_langchain_tool


def run_faq_agent(
    message: str,
    products: list[dict],
    session_id: str,
) -> tuple[str, list[str], dict]:
    long_term_matches = long_term_memory.search(
        session_id=session_id,
        query=message,
        memory_type="faq",
        limit=3,
    )

    result = invoke_langchain_tool(
        "gm_components_faq_rag_ev1",
        {
            "message": message,
            "products": products or [],
        },
    )

    answer = result.get("respuesta") or "No fue posible obtener respuesta desde el RAG EV1."

    featured_product = result.get("productoDestacado") or {}
    featured_name = featured_product.get("nombre") if isinstance(featured_product, dict) else None

    saved_fact_text = f"FAQ consultada: {message}"
    if featured_name:
        saved_fact_text = f"{saved_fact_text}. Producto destacado: {featured_name}"

    saved_fact = long_term_memory.save_fact(
        session_id=session_id,
        fact=saved_fact_text,
        memory_type="faq",
        source="faq_agent",
        metadata={
            "normalized_question": result.get("_normalized_question"),
            "featured_product": featured_name,
        },
    )

    return answer, ["langchain_core", "gm_components_faq_rag_ev1", "long_term_memory_tool"], {
        "source": "faq_agent",
        "agent_framework": "LangChain Core StructuredTool",
        "integration_status": "connected_to_ev1_rag",
        "normalized_question": result.get("_normalized_question"),
        "error": result.get("_error"),
        "detail": result.get("_detail"),
        "productoDestacado": result.get("productoDestacado"),
        "productosRelacionados": result.get("productosRelacionados", []),
        "sugerencias": result.get("sugerencias", []),
        "long_term_memory": {
            "enabled": True,
            "type": "faq",
            "matches": long_term_matches,
            "saved_fact": saved_fact,
        },
    }
