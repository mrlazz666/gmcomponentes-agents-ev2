from agents.faq_agent import run_faq_agent
from agents.planner_agent import build_plan, detect_intent
from agents.recommendation_agent import run_recommendation_agent
from memory.session_store import session_store
from schemas.agent_schemas import AgentChatRequest, AgentChatResponse
from tools.catalog_pool import search_catalog
from tools.memory_tool import get_memory_context


def should_continue_recommendation(memory, message: str) -> bool:
    if not memory.recommendation.active:
        return False

    text = message.lower().strip()

    continuation_words = [
        "sin preferencia",
        "sin marca",
        "ninguna",
        "cualquiera",
        "gaming",
        "oficina",
        "edicion",
        "edición",
        "diseno",
        "diseño",
        "general",
        "calidad",
        "precio",
        "calidad/precio",
        "calidad precio",
    ]

    return any(word in text for word in continuation_words) or len(text.split()) <= 4


def run_orchestrator(payload: AgentChatRequest) -> AgentChatResponse:
    memory = session_store.get(payload.session_id)
    memory.add_user_message(payload.message)

    message = payload.message.strip()
    forced_intent = None

    if message.lower().startswith("/rec "):
        forced_intent = "recommendation"
        payload.message = message[5:].strip()

    elif message.lower().startswith("/faq "):
        forced_intent = "faq"
        payload.message = message[5:].strip()


    intent = forced_intent or detect_intent(payload.message)

    if should_continue_recommendation(memory, payload.message):
        intent = "recommendation"

    plan = build_plan(intent)

    used_tools = ["planner_agent", "memory_tool"]
    memory_context = get_memory_context(payload.session_id)

    if intent == "faq":
        answer, tool_names, data = run_faq_agent(payload.message, payload.products,payload.session_id,)
        used_tools.extend(tool_names)

    elif intent == "recommendation":
        answer, tool_names, data = run_recommendation_agent(
            payload.message,
            payload.products,
            memory,
            payload.session_id,
        )
        used_tools.extend(tool_names)

    elif intent == "catalog":
        matches = search_catalog(payload.message, payload.products)
        used_tools.append("catalog_tool")
        data = {
            "source": "catalog_tool",
            "matches": matches,
        }

        if matches:
            answer = f"Encontre {len(matches)} productos relacionados en el catalogo."
        else:
            answer = "No encontre productos relacionados en el catalogo recibido."

    else:
        data = {
            "source": "orchestrator_agent",
            "memory_context": memory_context,
        }
        answer = (
            "Puedo ayudarte con preguntas FAQ, busqueda de catalogo o recomendaciones. "
            "Dime que componente buscas o que duda tienes sobre GM-COMPONENTS."
        )

    memory.add_assistant_message(answer)

    return AgentChatResponse(
        session_id=payload.session_id,
        intent=intent,
        answer=answer,
        plan=plan,
        memory_messages=memory.count(),
        used_tools=used_tools,
        data=data,
    )
