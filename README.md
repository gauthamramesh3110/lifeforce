# Lifeforce

A care management dashboard that serves machine-learning care-plan predictions to
clinicians — the deployment half of the
[care plan prediction work](https://github.com/gauthamramesh3110/clinical_data_ml).

The model that reaches 70% top-1 accuracy in a notebook is not a system. This is
what it takes to make it one: a service boundary, an auth story, a container, and
a pipeline that ships it.

## Architecture

```
Next.js app (App Router, TypeScript)
   │
   ├── Microsoft Entra ID ──── authentication
   │
   ├── Cosmos DB ──────────── patient and encounter data
   │
   └── careplan-predictor ─── Azure Function serving the PyTorch Transformer
                              (functions/careplan-predictor)

Docker image ──► Azure Container Instances
GitHub Actions ─► build pipeline
```

The predictor lives behind its own function boundary rather than inside the web
app: the model has different scaling behaviour, different dependencies, and a
different deployment cadence from the UI.

<!-- TODO: describe what the dashboard actually shows — which views exist, what a
     clinician does with a prediction once it appears. Two or three sentences. -->

## Layout

| Path                        | Contents                                  |
| --------------------------- | ----------------------------------------- |
| `app/`                      | Next.js App Router pages and layouts      |
| `components/`               | UI components (shadcn/ui, see `components.json`) |
| `functions/careplan-predictor/` | Azure Function serving model predictions |
| `hooks/`                    | React hooks                               |
| `lib/`                      | Shared utilities and data access          |
| `types/`                    | Shared TypeScript types                   |
| `scripts/`                  | Setup and data-loading scripts            |
| `proxy.ts`                  | Request proxying                          |
| `Dockerfile`                | Container build                           |
| `.github/workflows/`        | CI                                        |

## Running locally

```bash
npm install
npm run dev          # http://localhost:3000
```

<!-- TODO: list the required environment variables — Cosmos DB connection,
     Entra ID client/tenant IDs, predictor function URL — with a .env.example. -->

The predictor function runs separately:

```bash
cd functions/careplan-predictor
# TODO: document how to run the function locally (Azure Functions Core Tools?)
```

## Deployment

Built as a container and deployed to Azure Container Instances, with the image
pushed to Azure Container Registry. CI runs from `.github/workflows/`.

<!-- TODO: document the deploy step — which workflow, what it needs configured,
     whether deployment is automatic on main or manual. -->

## Data

Patient records come from [Synthea](https://github.com/synthetichealth/synthea)
synthetic data — no real patient information is involved anywhere in this project.

## Status

<!-- TODO: one honest line. Is this deployed and reachable, or does it run
     locally? A reader wants to know before they clone it. -->
