# Data AI Analyst

Natural-language analytics. Ask questions in English, get answers from BigQuery.

## Architecture

| Layer | Tech |
|---|---|
| Backend | FastAPI (Python 3.12) — `/backend` |
| Frontend | Next.js 15 + TypeScript + Tailwind 4 — `/frontend` |
| Deploy | 2 Cloud Run services per app, GitHub-triggered Cloud Build |
| Auth (user → frontend) | Cloud Run IAM (Google sign-in) |
| Auth (frontend → backend) | Service-to-service Cloud Run IAM (OIDC tokens via metadata server) |
| Identity | Workload Identity, dedicated SA per service, no JSON keys |
| Secrets | Google Secret Manager, mounted as env vars at boot |

See [`decisions.md`](./decisions.md) for the full architectural rationale.

## Local development

Prereqs: Docker, gcloud CLI authenticated as a user with BigQuery access (`gcloud auth application-default login`).

```bash
cd data-ai-analyst
docker compose up --build
```

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:8000>
- Backend health: <http://localhost:8000/health>

The backend mounts your local Application Default Credentials so BigQuery calls work without any service-account JSON.

## Project structure

```
data-ai-analyst/
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
