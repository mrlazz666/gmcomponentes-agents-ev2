# GM-COMPONENTS IA Hub

Proyecto academico desarrollado para la asignatura **Ingenieria de Soluciones con IA (ISY0101)**.

El sistema integra dos modulos de IA dentro de una sola experiencia:

- **FAQ con RAG** para responder preguntas sobre la tienda, categorias, productos y stock.
- **Recomendacion inteligente** guiada por pasos para sugerir componentes segun presupuesto, marca, uso y prioridad.

## 1. Stack del proyecto

### Frontend
- Angular 18
- Ionic 8

### Backend
- Node.js
- Express

### IA y recuperacion
- Groq para generacion/mejora de respuestas
- Voyage AI para embeddings del FAQ
- RAG local para FAQ
- MongoDB Atlas para logs FAQ con TTL

## 2. Arquitectura general

### IA Hub
La app expone una sola pantalla principal llamada `IA GM-COMPONENTS` con dos pestañas:

- `Recomendacion`
- `FAQ`

### FAQ con RAG
Flujo general:

1. El frontend envia la pregunta y el catalogo actual al backend.
2. El backend intenta resolver la consulta con pipeline RAG.
3. Se recupera contexto desde FAQ interna + catalogo.
4. Groq redacta la respuesta final.
5. La interaccion se guarda en MongoDB Atlas con expiracion automatica.

### Recomendacion conversacional
Flujo general:

1. El usuario indica el componente que busca.
2. El sistema exige presupuesto en CLP.
3. Luego pregunta por marca, uso y prioridad si hace falta.
4. El backend rankea productos reales del catalogo.
5. La interfaz muestra la respuesta y un carrusel con alternativas.

## 3. Estructura principal

```text
gmcomponentes_ia_demo/
├── src/
│   ├── app/
│   │   ├── ia-hub/
│   │   ├── models/
│   │   └── services/
│   └── environments/
├── groq-proxy/
│   ├── knowledge/
│   ├── lib/
│   ├── rag/
│   ├── routes/
│   ├── services/
│   └── server.js
└── README.MD
```

## 4. Variables de entorno del backend

Crear el archivo:

`E:\DESCARGAS MOZILLA\gmComponents2025 beta para ser trabajado\gmcomponentes_ia_demo\groq-proxy\.env`

Basarse en:

`E:\DESCARGAS MOZILLA\gmComponents2025 beta para ser trabajado\gmcomponentes_ia_demo\groq-proxy\.env.example`

Variables esperadas:

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
MONGODB_TTL_SECONDS=60
```

## 5. Instalacion

### Frontend
Desde la raiz del proyecto:

```powershell
npm install
```

### Backend
Desde la carpeta `groq-proxy`:

```powershell
npm install
```

## 6. Ejecucion

### Levantar backend
Desde:

`E:\DESCARGAS MOZILLA\gmComponents2025 beta para ser trabajado\gmcomponentes_ia_demo\groq-proxy`

ejecutar:

```powershell
npm start
```

El backend quedara disponible en:

- `http://localhost:8787`

### Levantar frontend
Desde la raiz del proyecto:

```powershell
npm start
```

La app quedara disponible normalmente en:

- `http://localhost:8100`

## 7. Endpoints principales

### Health
```text
GET /api/health
```

### FAQ
```text
POST /api/faq
```

### Recomendacion
```text
POST /api/recommendation
```

## 8. Pruebas funcionales sugeridas

### FAQ
- `que es gmcomponents`
- `que venden`
- `que graficas nvidia tienen`
- `tienen stock de rtx 4060`
- `muestrame nzxt h510 elite`

### Recomendacion
Ejemplo de flujo:

1. `quiero una grafica para jugar en 1440p`
2. presupuesto: `$600.000`
3. marca: `nvidia` o `sin preferencia`
4. uso: `gaming`
5. prioridad: `calidad/precio`

## 9. Notas importantes

- MongoDB Atlas no se sube a GitHub; solo se versiona el codigo de integracion.
- `groq-proxy/.env` real no debe subirse.
- El proyecto incluye recommendation y FAQ dentro del mismo `ia-hub`.
- El FAQ usa RAG.
- La recommendation trabaja con productos reales del catalogo disponible.

## 10. Repositorio

Repositorio principal:

[https://github.com/mrlazz666/gmcomponents-ia-faq-rag](https://github.com/mrlazz666/gmcomponents-ia-faq-rag)
