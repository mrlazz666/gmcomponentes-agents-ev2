import os
import requests
from dotenv import load_dotenv

load_dotenv()

EV1_PROXY_URL = os.getenv("EV1_PROXY_URL", "http://localhost:8787")


def call_ev1_recommendation(
    message: str,
    products: list[dict],
    budget: int | None,
    step: str = "initial",
    state: dict | None = None,
) -> dict:
    payload = {
        "message": message,
        "budget": budget,
        "step": step,
        "state": state,
        "productos": products or [],
    }

    response = requests.post(
        f"{EV1_PROXY_URL}/api/recommendation",
        json=payload,
        timeout=60,
    )

    response.raise_for_status()
    return response.json()
