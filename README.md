# Standalone

Three internal AI tools extracted from the legacy Kedet platform. Each folder is
an independent Cloud Run app (FastAPI backend + Next.js frontend). They share
no runtime state.

## Apps

| Folder | Purpose | External APIs |
|---|---|---|
| [`data-ai-analyst`](./data-ai-analyst) | Natural-language analytics over BigQuery | OpenAI GPT-4o, BigQuery |
| [`creative-ai-analyst`](./creative-ai-analyst) | Ad creative generation, editing, audit | OpenAI GPT-4o + gpt-image-1, Gemini 2.0, Meta Graph, GCS, BigQuery |
| [`competitive-ai`](./competitive-ai) | Competitor intelligence (PPC, ad creatives) | SpyFu, SerpAPI, Meta Ads Library |

## Stack (per app)

- **Backend:** FastAPI (Python 3.12), `uv` for deps
- **Frontend:** Next.js 15 (App Router, TypeScript, Tailwind 4)
- **Identity:** GCP Workload Identity (no JSON service-account keys committed anywhere)
- **Auth (frontend → backend):** Service-to-service Cloud Run IAM (OIDC)
- **Secrets:** Google Secret Manager in production; `.env` (gitignored) for local dev

See each app's `README.md` and `decisions.md` for full architecture.

## Local development

Each app runs the same two-terminal flow:

```bash
# Terminal 1 — backend
cd <app>/backend
cp .env.example .env       # then fill in keys
uv sync
uv run uvicorn src.main:app --reload --port 8000

# Terminal 2 — frontend
cd <app>/frontend
cp .env.local.example .env.local
npm install --legacy-peer-deps
npm run dev
```

Visit <http://localhost:3000>.

## Deploy

Each app deploys to Google Cloud Run via GitHub-triggered Cloud Build. The
`Dockerfile` in each `backend/` and `frontend/` is the build artifact.
Cloud Build runs in Google's infrastructure — no Docker needed locally.
