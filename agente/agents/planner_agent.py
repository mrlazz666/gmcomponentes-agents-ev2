from schemas.agent_schemas import AgentIntent, AgentStep


STORE_IDENTITY_WORDS = [
    "quienes son",
    "quiénes son",
    "que es gm",
    "qué es gm",
    "que es gm-components",
    "qué es gm-components",
    "gmcomponents",
    "gm componentes",
    "gm-components",
]

RECOMMENDATION_WORDS = [
    "recomienda",
    "recomendacion",
    "recomendación",
    "me recomiendas",
    "mejor opcion",
    "mejor opción",
    "presupuesto",
    "gaming",
    "oficina",
    "calidad precio",
    "calidad/precio",
]

FAQ_WORDS = [
    "que es",
    "qué es",
    "quienes son",
    "quiénes son",
    "venden",
    "horario",
    "despacho",
    "garantia",
    "garantía",
    "stock",
    "disponible",
    "disponibilidad",
    "tienen",
    "tiene",
    "quiero una",
    "quiero un",
    "muestrame",
    "muéstrame",
]

PRODUCT_MODEL_WORDS = [
    "rtx",
    "gtx",
    "rx",
    "ryzen",
    "core i",
    "intel",
    "ddr4",
    "ddr5",
    "h510",
    "x570",
    "z790",
    "b550",
]

CATALOG_WORDS = [
    "catalogo",
    "catálogo",
    "listar productos",
    "ver productos",
    "buscar productos",
]


def detect_intent(message: str) -> AgentIntent:
    text = message.lower()

    if any(word in text for word in RECOMMENDATION_WORDS):
        return "recommendation"

    if any(word in text for word in STORE_IDENTITY_WORDS):
        return "faq"

    if any(word in text for word in FAQ_WORDS):
        return "faq"

    if any(word in text for word in PRODUCT_MODEL_WORDS):
        return "faq"

    if any(word in text for word in CATALOG_WORDS):
        return "catalog"

    return "general"


def build_plan(intent: AgentIntent) -> list[AgentStep]:
    common = [
        AgentStep(
            name="analizar_consulta",
            description="Identificar intencion, datos disponibles y contexto previo.",
            status="completed",
        )
    ]

    if intent == "recommendation":
        return common + [
            AgentStep(
                name="revisar_memoria",
                description="Usar datos previos como presupuesto, uso o marca si existen.",
                status="completed",
            ),
            AgentStep(
                name="consultar_recomendador",
                description="Seleccionar productos candidatos segun necesidad del usuario.",
                status="planned",
            ),
            AgentStep(
                name="redactar_respuesta",
                description="Explicar la recomendacion de forma clara.",
                status="planned",
            ),
        ]

    if intent == "faq":
        return common + [
            AgentStep(
                name="normalizar_pregunta",
                description="Ajustar preguntas breves para que apunten al dominio GM-COMPONENTS.",
                status="completed",
            ),
            AgentStep(
                name="recuperar_contexto_ev1",
                description="Usar el RAG FAQ implementado en la EV1 como herramienta.",
                status="planned",
            ),
            AgentStep(
                name="responder_con_evidencia",
                description="Responder usando la informacion recuperada por la EV1.",
                status="planned",
            ),
        ]

    if intent == "catalog":
        return common + [
            AgentStep(
                name="consultar_catalogo",
                description="Buscar productos relacionados en el catalogo.",
                status="planned",
            ),
            AgentStep(
                name="presentar_resultados",
                description="Mostrar coincidencias y datos utiles.",
                status="planned",
            ),
        ]

    return common + [
        AgentStep(
            name="respuesta_general",
            description="Responder de forma breve y pedir mas informacion si falta contexto.",
            status="planned",
        )
    ]
