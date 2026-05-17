import os
import requests
from dotenv import load_dotenv

load_dotenv()

CATALOG_API_URL = os.getenv(
    "CATALOG_API_URL",
    "https://gmcomponents.onrender.com/backend/products/",
)


def fetch_catalog() -> list[dict]:
    response = requests.get(CATALOG_API_URL, timeout=30)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, list) else []


def search_catalog(message: str, products: list[dict], limit: int = 5) -> list[dict]:
    if not products:
        products = fetch_catalog()

    query_tokens = {
        token
        for token in message.lower().replace(",", " ").replace(".", " ").split()
        if len(token) >= 3
    }

    scored = []
    for product in products:
        text = " ".join(
            str(product.get(key, ""))
            for key in ["nombre", "descripcion", "categoria", "marca"]
        ).lower()

        score = sum(1 for token in query_tokens if token in text)

        if score > 0:
            scored.append((score, product))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [product for _, product in scored[:limit]]
