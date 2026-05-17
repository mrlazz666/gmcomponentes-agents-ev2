from typing import Any

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from tools.catalog_pool import search_catalog
from tools.faq_tool import ask_ev1_faq
from tools.recommendation_tool import call_ev1_recommendation


class FaqToolInput(BaseModel):
    message: str = Field(description="Pregunta del usuario para consultar el RAG FAQ de EV1.")
    products: list[dict[str, Any]] = Field(default_factory=list)


class RecommendationToolInput(BaseModel):
    message: str = Field(description="Mensaje del usuario para el recomendador EV1.")
    products: list[dict[str, Any]] = Field(default_factory=list)
    budget: int | None = Field(default=None)
    step: str = Field(default="initial")
    state: dict[str, Any] | None = Field(default=None)


class CatalogToolInput(BaseModel):
    message: str = Field(description="Texto de busqueda para consultar el catalogo.")
    products: list[dict[str, Any]] = Field(default_factory=list)


def _faq_rag_ev1_tool(message: str, products: list[dict[str, Any]] | None = None) -> dict:
    return ask_ev1_faq(message, products or [])


def _recommendation_ev1_tool(
    message: str,
    products: list[dict[str, Any]] | None = None,
    budget: int | None = None,
    step: str = "initial",
    state: dict[str, Any] | None = None,
) -> dict:
    return call_ev1_recommendation(
        message=message,
        products=products or [],
        budget=budget,
        step=step,
        state=state,
    )


def _catalog_search_tool(message: str, products: list[dict[str, Any]] | None = None) -> list[dict]:
    return search_catalog(message, products or [])


LANGCHAIN_TOOLS = {
    "gm_components_faq_rag_ev1": StructuredTool.from_function(
        func=_faq_rag_ev1_tool,
        name="gm_components_faq_rag_ev1",
        description=(
            "Consulta el RAG FAQ real de EV1 para responder preguntas sobre "
            "GM-COMPONENTS, stock, productos, garantia y despacho."
        ),
        args_schema=FaqToolInput,
    ),
    "gm_components_recommendation_ev1": StructuredTool.from_function(
        func=_recommendation_ev1_tool,
        name="gm_components_recommendation_ev1",
        description=(
            "Ejecuta el recomendador conversacional real de EV1 para sugerir "
            "componentes segun presupuesto, uso, marca y prioridad."
        ),
        args_schema=RecommendationToolInput,
    ),
    "gm_components_catalog_search": StructuredTool.from_function(
        func=_catalog_search_tool,
        name="gm_components_catalog_search",
        description="Busca productos relacionados dentro del catalogo recibido por el agente.",
        args_schema=CatalogToolInput,
    ),
}


def invoke_langchain_tool(tool_name: str, payload: dict[str, Any]) -> Any:
    tool = LANGCHAIN_TOOLS[tool_name]
    return tool.invoke(payload)


def get_langchain_tool_names() -> list[str]:
    return list(LANGCHAIN_TOOLS.keys())
