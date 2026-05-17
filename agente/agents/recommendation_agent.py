import re

from memory.long_term_memory import long_term_memory
from memory.session_store import SessionMemory
from tools.langchain_tool_registry import invoke_langchain_tool




def extract_budget(message: str) -> int | None:
    patterns = [
        r"\$?\s*(\d{1,3}(?:[.\s]\d{3})+)",
        r"\$?\s*(\d{5,9})",
    ]

    for pattern in patterns:
        match = re.search(pattern, message.lower())
        if match:
            digits = re.sub(r"\D", "", match.group(1))
            if digits:
                return int(digits)

    return None


def is_budget_only(message: str) -> bool:
    text = message.strip()
    digits = re.sub(r"\D", "", text)
    letters = re.sub(r"[^a-zA-ZáéíóúÁÉÍÓÚñÑ]", "", text)

    return bool(digits) and not letters


def resolve_message_for_ev1(message: str, memory: SessionMemory, detected_budget: int | None) -> str:
    current = memory.recommendation
    base_request = current.state.get("baseRequest") if current.state else None

    if (
        current.active
        and current.step == "initial"
        and detected_budget is not None
        and is_budget_only(message)
        and base_request
    ):
        return base_request

    return message


def run_recommendation_agent(
    message: str,
    products: list[dict],
    memory: SessionMemory,
    session_id: str,
) -> tuple[str, list[str], dict]:
    current = memory.recommendation

    long_term_matches = long_term_memory.search(
        session_id=session_id,
        query=message,
        memory_type="recommendation",
        limit=3,
    )


    if not current.active:
        memory.clear_recommendation()
        current = memory.recommendation

    detected_budget = extract_budget(message)
    budget = detected_budget if detected_budget is not None else current.budget

    step = current.step if current.active else "initial"
    state = current.state if current.active else None

    message_for_ev1 = resolve_message_for_ev1(message, memory, detected_budget)

    result = invoke_langchain_tool(
        "gm_components_recommendation_ev1",
        {
            "message": message_for_ev1,
            "products": products or [],
            "budget": budget,
            "step": step,
            "state": state,
        },
    )


    next_step = result.get("nextStep") or "done"
    result_state = result.get("state") or {}
    result_budget = result_state.get("budget") or budget
    mode = result.get("mode")

    if next_step == "done" and mode == "result":
        memory.clear_recommendation()
    else:
        memory.update_recommendation(
            step=next_step,
            state=result_state,
            budget=result_budget,
            active=True,
        )

    answer = result.get("answer") or "No fue posible generar recomendacion."


    suggestions = result.get("suggestions", [])
    main_suggestion = suggestions[0] if suggestions else {}
    main_product_name = (
        main_suggestion.get("nombre")
        if isinstance(main_suggestion, dict)
        else None
    )

    saved_fact_parts = [
        f"Recommendation consultada: {message_for_ev1}",
        f"step: {next_step}",
    ]

    if result_budget:
        saved_fact_parts.append(f"budget: {result_budget}")

    if main_product_name:
        saved_fact_parts.append(f"producto sugerido: {main_product_name}")

    saved_fact = long_term_memory.save_fact(
        session_id=session_id,
        fact=". ".join(saved_fact_parts),
        memory_type="recommendation",
        source="recommendation_agent",
        metadata={
            "mode": mode,
            "nextStep": next_step,
            "budget": result_budget,
            "main_product": main_product_name,
        },
    )

    return answer, ["langchain_core", "gm_components_recommendation_ev1", "long_term_memory_tool"], {

        "source": "recommendation_agent",
        "agent_framework": "LangChain Core StructuredTool",
        "integration_status": "connected_to_ev1_recommendation",
        "mode": mode,
        "nextStep": next_step,
        "quickOptions": result.get("quickOptions", []),
        "state": result_state,
        "suggestions": result.get("suggestions", []),
        "confidence": result.get("confidence"),
        "aiContext": result.get("aiContext"),
        "messageSentToEv1": message_for_ev1,
        "long_term_memory": {
        "enabled": True,
        "type": "recommendation",
        "matches": long_term_matches,
        "saved_fact": saved_fact,
        },

    }
