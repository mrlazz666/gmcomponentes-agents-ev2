# GM-COMPONENTS EV2 - Capa de Agentes sobre EV1

Proyecto academico desarrollado como continuacion de la Evaluacion Parcial 1 para la asignatura **Ingenieria de Soluciones con IA (ISY0101)**.

La EV1 implementaba una solucion funcional de:

- FAQ con RAG.
- Recomendacion inteligente de componentes.
- Backend Node/Express.
- Frontend Angular/Ionic.
- Integracion con Groq, Voyage AI, catalogo real y MongoDB Atlas para logs.

La EV2 agrega una capa de agentes sobre esa base sin reemplazarla. El objetivo es que los agentes usen EV1 como herramientas reales mediante HTTP/API.

## 1. Que se implemento en EV2

La EV2 incorpora un servicio independiente en Python 3.11 con FastAPI:

```text
agente/
```

Este servicio implementa:

- `Orchestrator Agent`: coordina el flujo general.
- `Planner Agent`: detecta intencion y genera pasos.
- `FAQ Agent`: usa el FAQ/RAG de EV1 como herramienta.
- `Recommendation Agent`: usa el recomendador EV1 como herramienta.
- `Memory Tool`: registra contexto conversacional.
- `LongTermMemory`: guarda hechos en memoria larga local.
- `LangChain StructuredTool`: registra y ejecuta tools del agente.
- Consola de agentes para pruebas y evidencia.

Tambien se integro una nueva vista en el frontend:

```text
Agentes EV2
```

Desde esa vista se pueden probar:

- FAQ Agent.
- Recommendation Agent.
- Trazabilidad tecnica.
- LangChain Tool usada.
- Plan del Planner Agent.
- Memoria corta y memoria larga.

## 2. Que se reutiliza de EV1

La EV2 no rehace el RAG ni el recomendador.

Se reutilizan directamente estos componentes de EV1:

```text
POST /api/faq
POST /api/recommendation
```

EV1 sigue encargandose de:

- recuperar contexto FAQ mediante RAG,
- usar Voyage AI para embeddings,
- generar respuestas con Groq,
- consultar el catalogo real,
- recomendar productos,
- registrar logs en MongoDB Atlas.

EV2 funciona como una capa superior:

```text
Frontend Angular/Ionic
  -> groq-proxy Node/Express
    -> Servicio Python FastAPI EV2
      -> Orchestrator Agent
        -> Planner Agent
        -> FAQ Agent / Recommendation Agent
          -> LangChain StructuredTool
            -> Endpoints reales EV1
```

## 3. Arquitectura general

```mermaid
flowchart TD
    U[Usuario] --> F[Frontend Angular/Ionic]
    F --> N[groq-proxy Node/Express]

    N --> FAQEV1[EV1 /api/faq]
    N --> RECEV1[EV1 /api/recommendation]
    N --> AGENTNODE[EV2 /api/agent]

    AGENTNODE --> FASTAPI[FastAPI Python 3.11]
    FASTAPI --> ORCH[Orchestrator Agent]
    ORCH --> PLAN[Planner Agent]
    ORCH --> FAQA[FAQ Agent]
    ORCH --> RECA[Recommendation Agent]
    ORCH --> MEM[Memory Tool]

    FAQA --> LFAQ[LangChain Tool FAQ/RAG EV1]
    RECA --> LREC[LangChain Tool Recommendation EV1]

    LFAQ --> FAQEV1
    LREC --> RECEV1
```

## 4. Estructura principal

```text
.
|-- src/
|   |-- app/
|   |   |-- ia-hub/
|   |   |-- models/
|   |   `-- services/
|   `-- environments/
|-- groq-proxy/
|   |-- rag/
|   |-- routes/
|   |-- services/
|   |-- lib/
|   `-- server.js
|-- agente/
|   |-- agents/
|   |-- tools/
|   |-- memory/
|   |-- schemas/
|   |-- docs/
|   |-- app.py
|   |-- main.py
|   `-- requirements.txt
|-- instalar_dependencias_ev2.bat
|-- iniciar_proyecto_completo_ev2.bat
|-- iniciar_consola_agentes_ev2.bat
`-- README.MD
```

## 5. Requisitos

- Node.js 18 o superior.
- npm.
- Python 3.11 disponible como `py -3.11`.
- Conexion a internet.
- Claves validas para:
  - Groq.
  - Voyage AI.
  - MongoDB Atlas.

## 6. Variables de entorno

Crear el archivo:

```text
groq-proxy/.env
```

Basarse en:

```text
groq-proxy/.env.example
```

Ejemplo:

```env
PORT=8787

GROQ_API_KEY=YOUR_GROQ_API_KEY
CATALOG_API_URL=https://gmcomponents.onrender.com/backend/products/

VOYAGE_API_KEY=YOUR_VOYAGE_API_KEY
VOYAGE_MODEL=voyage-4-large
VOYAGE_EMBEDDINGS_URL=https://api.voyageai.com/v1/embeddings

MONGODB_URI=mongodb://USER:PASSWORD@HOST1:27017,HOST2:27017,HOST3:27017/faq_logs?ssl=true&replicaSet=YOUR_REPLICA_SET&authSource=admin&appName=Cluster0
MONGODB_DB=faq_logs
MONGODB_COLLECTION=gm_componentes_logs_faq
MONGODB_RECOMMENDATION_COLLECTION=gm_componentes_logs_recommendation
MONGODB_TTL_SECONDS=60
```

No se deben subir archivos `.env` al repositorio.

## 7. Instalacion

La forma recomendada es ejecutar:

```powershell
instalar_dependencias_ev2.bat
```

Este script instala:

- dependencias del frontend Angular/Ionic,
- dependencias del backend EV1 `groq-proxy`,
- entorno virtual Python 3.11 en `agente/.venv`,
- dependencias Python de `agente/requirements.txt`.

Tambien se puede instalar manualmente:

```powershell
npm.cmd install
```

```powershell
cd groq-proxy
npm.cmd install
```

```powershell
cd agente
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 8. Ejecucion del proyecto completo

La forma recomendada es:

```powershell
iniciar_proyecto_completo_ev2.bat
```

Este script levanta:

```text
EV1 groq-proxy        http://localhost:8787
EV2 FastAPI agentes  http://localhost:8790
Frontend Angular
```

Tambien se puede ejecutar manualmente en tres terminales.

Terminal 1:

```powershell
cd groq-proxy
npm.cmd start
```

Terminal 2:

```powershell
cd agente
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8790
```

Terminal 3:

```powershell
npm.cmd start
```

## 9. Consola de agentes EV2

Para probar la capa de agentes sin frontend:

```powershell
iniciar_consola_agentes_ev2.bat
```

Este script levanta `groq-proxy` y luego ejecuta la consola:

```text
agente/main.py
```

Ejemplos:

```text
/faq tienen stock de rtx 4060
```

```text
/rec quiero una grafica
500000
Sin preferencia
Gaming
Precio
```

La consola muestra:

- intent detectado,
- tools usadas,
- memoria,
- respuesta,
- productos relacionados,
- recomendaciones,
- opciones rapidas.

## 10. Endpoints principales

EV1:

```text
GET  /api/health
POST /api/faq
POST /api/recommendation
```

EV2 por Node:

```text
GET  /api/agent/health
POST /api/agent/chat
```

EV2 directo:

```text
GET    /health
POST   /agent/chat
DELETE /agent/session/{session_id}
```

## 11. Pruebas sugeridas

### FAQ Agent

En la vista `Agentes EV2 -> FAQ Agent`:

```text
tienen stock de rtx 4060
```

Resultado esperado:

- intent `faq`,
- uso de `LangChain Core StructuredTool`,
- tool `gm_components_faq_rag_ev1`,
- respuesta desde EV1,
- producto destacado o relacionados,
- memoria larga registrada.

### Recommendation Agent

En la vista `Agentes EV2 -> Recommendation Agent`:

```text
quiero una grafica
500000
Sin preferencia
Gaming
Precio
```

Resultado esperado:

- flujo por etapas,
- memoria corta activa,
- memoria larga registrada,
- producto principal,
- alternativas recomendadas,
- trazabilidad del Planner Agent.

## 12. Documentacion tecnica

La documentacion de EV2 esta en:

```text
agente/docs/arquitectura.md
agente/docs/flujos.md
agente/docs/evidencias.md
```

Incluye:

- arquitectura EV1 + EV2,
- orquestacion de agentes,
- uso de LangChain,
- memoria corta y larga,
- flujos de trabajo,
- evidencias con capturas.

## 13. Limitaciones conocidas

Groq y Voyage AI pueden responder con errores de limite de uso en cuentas gratuitas.

Ejemplos:

- `rate_limit_exceeded` en Groq.
- limite reducido de RPM/TPM en Voyage AI.

Esto no significa que la arquitectura este rota. Significa que el proveedor externo rechazo temporalmente la solicitud por cuota.

## 14. Relacion con indicadores de logro

| Indicador | Implementacion |
|---|---|
| IL2.1 | Agentes funcionales con LangChain StructuredTool y tools reales EV1 |
| IL2.2 | Memoria corta por `session_id` y memoria larga persistida en JSON local |
| IL2.3 | Planner Agent, Orchestrator Agent y Recommendation Agent por etapas |
| IL2.4 | Documentacion tecnica en `agente/docs` con evidencias |
