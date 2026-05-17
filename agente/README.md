# Servicio de Agentes GM-COMPONENTS EV2

Este modulo implementa una capa separada de agentes en Python 3.11 para no modificar ni romper la app EV1.

## Objetivo

Agregar una arquitectura de agentes con:

- planificacion de tareas,
- uso de herramientas,
- memoria de corto plazo,
- preparacion para memoria de largo plazo,
- API independiente consumible desde el backend Node/Express.

## Ejecucion

Crear entorno virtual:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\activate
py -3.11 -m pip install -r requirements.txt



Levantar API:

py -3.11 -m uvicorn app:app --reload --port 8790


Probar consola:

py -3.11 main.py


Endpoints

GET /health
POST /agent/chat
DELETE /agent/session/{session_id}


Arquitectura


Angular/Ionic EV1
  -> groq-proxy Node/Express
    -> agente Python 3.11
      -> Orchestrator Agent
        -> Planner Agent
        -> FAQ Agent
        -> Recommendation Agent
        -> Catalog Tool
        -> Memory Tool





**16. `agente/docs/arquitectura.md`**

```markdown
# Arquitectura de Agentes

El modulo `agente/` se disena como un servicio separado en Python 3.11.

## Componentes

- `Orchestrator Agent`: recibe la consulta y coordina el flujo.
- `Planner Agent`: clasifica la intencion y genera pasos.
- `FAQ Agent`: preparado para conectarse al RAG existente.
- `Recommendation Agent`: preparado para conectarse al recomendador existente.
- `Memory`: mantiene contexto por `session_id`.

## Diagrama

```mermaid
flowchart TD
    A[Usuario] --> B[Angular/Ionic]
    B --> C[groq-proxy Node]
    C --> D[Servicio agente Python 3.11]
    D --> E[Orchestrator Agent]
    E --> F[Planner Agent]
    E --> G[FAQ Agent]
    E --> H[Recommendation Agent]
    E --> I[Catalog Tool]
    E --> J[Memory Store]




**17. `agente/docs/flujos.md`**

```markdown
# Flujos de Trabajo

## Flujo FAQ

1. Usuario pregunta sobre tienda, stock o productos.
2. Planner clasifica la intencion como `faq`.
3. Orchestrator llama a `FAQ Agent`.
4. FAQ Agent devuelve respuesta basada en contexto.
5. Memoria guarda pregunta y respuesta.

## Flujo Recomendacion

1. Usuario pide una recomendacion.
2. Planner clasifica la intencion como `recommendation`.
3. Orchestrator llama a `Recommendation Agent`.
4. Recommendation Agent prepara sugerencias.
5. Memoria guarda el turno.

## Flujo Catalogo

1. Usuario consulta por un componente.
2. Planner clasifica como `catalog`.
3. Catalog Tool busca productos relacionados.
4. Orchestrator responde con coincidencias.


# Evidencias de Prueba

## Prueba health

```powershell
Invoke-RestMethod http://localhost:8790/health


Resultado esperado:


{
  "ok": true,
  "service": "gm-components-agent",
  "python": "3.11"
}

Prueba chat

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8790/agent/chat `
  -ContentType "application/json" `
  -Body '{"session_id":"demo","message":"quiero una recomendacion para gaming","products":[]}'

Resultado esperado:

intent: recommendation
used_tools: incluye planner_agent, memory_tool, recommendation_tool
memory_messages: aumenta por cada turno
