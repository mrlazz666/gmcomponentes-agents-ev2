import os
import requests
from dotenv import load_dotenv

load_dotenv()

EV1_PROXY_URL = os.getenv("EV1_PROXY_URL", "http://localhost:8787")


def normalize_faq_question(message: str) -> str:
    text = message.strip()
    low = text.lower()

    if low in ["quienes son", "quiénes son", "quienes son?", "quiénes son?"]:
        return "quienes son GM-COMPONENTS"

    if low in ["que venden", "qué venden", "que venden?", "qué venden?"]:
        return "que productos vende GM-COMPONENTS"

    if "gm" not in low and any(term in low for term in ["horario", "despacho", "garantia", "garantía"]):
        return f"{text} en GM-COMPONENTS"

    return text


def build_faq_error_response(message: str, normalized_message: str, error: Exception, detail: str = "") -> dict:
    return {
        "respuesta": (
            "El agente intento usar el RAG de la EV1, pero el backend FAQ no respondio correctamente. "
            "La herramienta fue seleccionada bien; hay que revisar el tiempo de respuesta o el detalle del endpoint."
        ),
        "sugerencias": [],
        "productoDestacado": None,
        "productosRelacionados": [],
        "_error": str(error),
        "_detail": detail or str(error),
        "_normalized_question": normalized_message,
    }


def ask_ev1_faq(message: str, products: list[dict] | None = None) -> dict:
    normalized_message = normalize_faq_question(message)

    payload = {
        "mode": "faq",
        "usuario": {
            "correo": "console@gmcomponents.cl",
            "nombre": "Usuario Consola",
            "rol": "cliente",
        },
        "pregunta": normalized_message,
        "productos": products or [],
    }

    try:
        response = requests.post(
            f"{EV1_PROXY_URL}/api/faq",
            json=payload,
            timeout=90,
        )
        response.raise_for_status()
        result = response.json()
        result["_normalized_question"] = normalized_message
        return result

    except requests.HTTPError as error:
        detail = ""
        try:
            detail = response.text
        except Exception:
            detail = str(error)

        return build_faq_error_response(message, normalized_message, error, detail)

    except requests.RequestException as error:
        return build_faq_error_response(message, normalized_message, error)
