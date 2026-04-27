# Creative AI Analyst

AI-powered ad creative tooling. Generate, analyse, and audit Meta ad creatives —
GPT-5.4 for copy and vision, gpt-image-2 for image variants, Gemini for video critique.
Model names live behind `OPENAI_CHAT_MODEL` / `OPENAI_IMAGE_MODEL` env vars (see `.env.example`).

## Architecture

| Layer | Tech |
|---|---|
| Backend | FastAPI (Python 3.12) — `/backend` |
| Frontend | Next.js 15 + TypeScript + Tailwind 4 — `/frontend` |
| LLMs | OpenAI GPT-5.4-mini (copy + vision), gpt-image-2 (image edit), Gemini 2.0 Flash (video) |
| Data | BigQuery (`elt_meta_ads.creative_ai`), Google Cloud Storage (image artifacts) |
| External | Meta Graph API v21 (ad previews, account/campaign metadata) |
| Deploy | 2 Cloud Run services per app, GitHub-triggered Cloud Build |
| Auth (user → frontend) | Cloud Run IAM (Google sign-in) |
| Auth (frontend → backend) | Service-to-service Cloud Run IAM (OIDC tokens via metadata server) |
| Identity | Workload Identity, dedicated SA per service, no JSON keys |
| Secrets | Google Secret Manager, mounted as env vars at boot |

See [`decisions.md`](./decisions.md) for the full architectural rationale.

## Local development

Prereqs: Docker, gcloud CLI authenticated (`gcloud auth application-default login`).

```bash
cd creative-ai-analyst
docker compose up --build
```

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:8000>
- Backend docs: <http://localhost:8000/docs>

## Project structure

```
creative-ai-analyst/
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
