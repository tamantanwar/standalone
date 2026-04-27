# Competitive AI

Competitor intelligence aggregator. Pulls PPC competitors and competitor ad creatives
from third-party sources (SpyFu, SerpAPI, Meta Ads Library) and surfaces them to the
sales team during prospect demos.

## Architecture

| Layer | Tech |
|---|---|
| Backend | FastAPI (Python 3.12) — `/backend` |
| Frontend | Next.js 15 + TypeScript + Tailwind 4 — `/frontend` |
| External | SpyFu (PPC competitors + domain stats), SerpAPI (Google Ads Transparency Center), Meta Graph v21 (`/ads_archive`) |
| Data | None — pure API aggregation, no DB writes |
| Deploy | 2 Cloud Run services per app, GitHub-triggered Cloud Build |
| Auth (user → frontend) | Cloud Run IAM (Google sign-in) |
| Auth (frontend → backend) | Service-to-service Cloud Run IAM (OIDC tokens via metadata server) |
| Identity | Workload Identity, dedicated SA per service, no JSON keys |
| Secrets | Google Secret Manager, mounted as env vars at boot |

See [`decisions.md`](./decisions.md) for the full architectural rationale.

## Local development

Prereqs: Docker, gcloud CLI authenticated (`gcloud auth application-default login`).

```bash
cd competitive-ai
docker compose up --build
```

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:8000>
- Backend docs: <http://localhost:8000/docs>

## Project structure

```
competitive-ai/
├── backend/              FastAPI service
│   ├── src/
│   │   ├── main.py       App entrypoint, routes
│   │   └── config.py     Pydantic settings
│   └── pyproject.toml    uv-managed deps
├── frontend/             Next.js app
│   └── src/
│       ├── app/          App Router pages
│       └── lib/          Backend client, OIDC token minting
├── docker-compose.yml    Local dev orchestration
└── decisions.md          Architectural decision log
```
