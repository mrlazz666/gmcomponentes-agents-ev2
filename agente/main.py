from agents.orchestrator_agent import run_orchestrator
from schemas.agent_schemas import AgentChatRequest
from tools.catalog_pool import fetch_catalog


def print_products(title: str, products: list[dict], limit: int = 5) -> None:
    if not products:
        return

    print(f"\n{title}:")
    for product in products[:limit]:
        name = product.get("nombre", "Producto")
        description = product.get("descripcion", "")
        price = product.get("precio", "")
        stock = product.get("stock", "")
        print(f"- {name} {description} | Precio: ${price} | Stock: {stock}")


def main() -> None:
    print("GM-COMPONENTS Agent Service - consola")
    print("Cargando catalogo real...\n")

    try:
        products = fetch_catalog()
        print(f"Catalogo cargado: {len(products)} productos.\n")
    except Exception as error:
        products = []
        print(f"No se pudo cargar catalogo. Se usara lista vacia. Error: {error}\n")

    print("Escribe 'salir' para terminar.\n")

    session_id = "console-demo"

    while True:
        message = input("Tu: ").strip()

        if not message:
            continue

        if message.lower() in ["salir", "exit", "quit"]:
            print("Sesion finalizada.")
            break

        try:
            response = run_orchestrator(
                AgentChatRequest(
                    session_id=session_id,
                    message=message,
                    products=products,
                )
            )

            print(f"\nIntent: {response.intent}")
            print(f"Tools: {', '.join(response.used_tools)}")
            print(f"Memoria: {response.memory_messages} mensajes")
            print(f"Agente: {response.answer}")

            featured = response.data.get("productoDestacado")
            related = response.data.get("productosRelacionados", [])
            suggestions = response.data.get("suggestions", [])
            quick_options = response.data.get("quickOptions", [])
            next_step = response.data.get("nextStep")

            if featured:
                print(f"\nProducto destacado: {featured.get('nombre')} - {featured.get('descripcion')}")

            print_products("Productos relacionados", related)
            print_products("Recomendaciones", suggestions)

            if next_step == "done" and response.intent == "recommendation":
                print("Flujo de recomendacion finalizado. Para iniciar otra, escribe una nueva necesidad completa.")


            if quick_options:
                print("\nOpciones rapidas:")
                print(", ".join(str(option) for option in quick_options))

            print("")

        except Exception as error:
            print(f"\nError ejecutando agente: {error}\n")


if __name__ == "__main__":
    main()
