# CLAUDE.md — context for any Claude session in this repo

This file primes Claude Code with everything needed to continue work on this
monorepo from any machine. **Claude: read this file in full at the start of
every session here.**

---

## What this repo is

Three standalone AI apps extracted from a legacy Kedet platform. Each is a
self-contained FastAPI + Next.js service deployed (or to be deployed) to
Google Cloud Run via GitHub-triggered Cloud Build.

| Folder | Purpose |
|---|---|
| `data-ai-analyst/` | NL → SQL → BigQuery analytics (GPT-4o) |
| `creative-ai-analyst/` | Ad creative generation, editing, audit (OpenAI + Gemini + Meta + GCS + BQ) |
| `competitive-ai/` | Competitor intelligence (SpyFu, SerpAPI, Meta Ads Library) |

The user (Aman) owns the FastAPI backend logic and asks Claude to handle the
frontend (Next.js / TypeScript / Tailwind 4) and any backend scaffolding.

---

## Working style — IMPORTANT

The user has explicitly asked for **execution mode, not mentor mode** for this
project. He's juggling another concurrent project and just needs the apps
shipped. **Do not lecture, do not surface tradeoffs unprompted, do not pitch
portfolio artifacts.** Just build, verify, and report concisely.

If the user asks "should we…" or "what do you think about…", give a short
2–3 sentence answer with a recommendation. Don't expand into a multi-section
analysis.

If a piece of original Kedet behavior is being changed, **say so explicitly
before changing it**. Past mistake: silently parameterized hardcoded BigQuery
table names — the user wanted exact-same logic.

---

## Architecture (locked decisions, do not relitigate)

- **Repo layout:** Monorepo on disk and on GitHub (`tamantanwar/standalone`).
- **Stack per app:** FastAPI (Python 3.12, `uv`) + Next.js 15 (App Router, TS, Tailwind 4).
- **Deploy:** 2 Cloud Run services per app (backend + frontend) — 6 services total.
  GitHub-triggered Cloud Build reads each `Dockerfile`. No local Docker needed.
- **Identity:** Google Cloud Workload Identity. **Never** create or commit JSON service-account keys.
  Each Cloud Run service has its own dedicated SA, scoped to least-privilege IAM.
  Code uses Application Default Credentials (ADC) — works locally via
  `gcloud auth application-default login`, on Cloud Run via metadata server.
- **Auth (frontend → backend):** Service-to-service Cloud Run IAM. Backend is
  deployed `--no-allow-unauthenticated`. Frontend mints OIDC ID tokens via the
  metadata server (audience = backend URL) and includes them as
  `Authorization: Bearer <token>`. See `*/frontend/src/lib/backend-client.ts`.
- **Auth (user → frontend):** Cloud Run IAM with Google sign-in (`roles/run.invoker`).
  No login UI to build.
- **Secrets:** Google Secret Manager in production. Local dev uses `.env` files
  (gitignored). Per-SA IAM grants on individual secrets, not project-wide.

Each app has a `decisions.md` with the full rationale.

---

## Status — what's done, what's not

### data-ai-analyst — FULL port
Backend `POST /ai/ask`: NL question → keyword routing to one of three hardcoded
tables (`funnel_main` / `funnel_audience` / `funnel_conversions`) → fetch schema
via `getMetadata()` → GPT-4o NL→SQL → dry-run validate → execute → GPT-4o
analyze results. Frontend: form + analysis + table + 4 plotly charts.
**Note:** the table names are hardcoded *intentionally* — they match the original
Kedet code exactly. To run, point `BIGQUERY_DATASET` at a dataset that contains
those three tables.

### competitive-ai — FULL port
Backend: `GET /competitive-analysis/competitors` (SpyFu PPC competitors + per-competitor
domain stats), `GET /competitive-analysis/adCreatives` (SerpAPI Google Ads Transparency
or Meta `/ads_archive`). Frontend: form → competitor stats table + grouped bar chart
(toggle metric) → competitor selector + Google/Facebook toggle → ad-creative grid.

### creative-ai-analyst — 11/12 endpoints ported

**Backend, ported and faithful to the original logic:**
- `GET /creative-ai/accounts`
- `GET /creative-ai/campaign-objectives`
- `GET /creative-ai/ads` (full enrichment — ad_name parsing, CTR/CPC/Clicks for `LINK_CLICKS`, ROAS/CPA/total_revenue for `OUTCOME_SALES` / `OUTCOME_CONVERSIONS`, ranking, location/promotion filters, top-10)
- `POST /creative-ai/ad-preview` (5 FB ad-format previews via Graph v21)
- `POST /creative-ai/generate-ai-ads` (GPT-4o generates 5 variations)
- `POST /creative-ai/generate-variant` (gpt-image-1 1536x1024 + GCS upload + BQ `stored_image_url` UPDATE)
- `POST /creative-ai/edit-image` (gpt-image-1 1024x1024 with size/format guards + GCS + BQ)
- `POST /creative-ai/audit` (GPT-4o vision audit with the original ~60-line system prompt + Gemini 2.0-flash for video URLs via file upload + ACTIVE polling)
- `POST /creative-ai/compare` (GPT-4o two-image vision comparison)
- `POST /creative-ai/process-prompt` (NL keyword router → variant/edit/audit/compare)
- `POST /creative-ai/download-images` (in-memory zip)

**Backend NOT ported:** `POST /creative-ai/file-upload/fbAdImages`. The original
pulls per-client `fb_config` from a Postgres `clients` table, then uses the
Facebook Business SDK to upload images. Two future paths:
- (a) Hardcode one `fb_config` from env vars (`FB_AD_ACCOUNT_ID`, `FB_PAGE_ID`,
  etc.) and call Graph API directly — single-tenant, fits standalone model
- (b) Re-add a Postgres dependency for per-client config

The user has not yet picked a path. Ask before implementing.

**Frontend NOT yet built:** UI for the 6 newer backend endpoints
(`generate-variant`, `edit-image`, `audit`, `compare`, `process-prompt`,
`download-images`). The current Creative AI page only has account/objective
filters + ad list + ad-preview modal + generate-ai-ads. The 6 endpoints
themselves work — testable via Swagger at `http://localhost:8000/docs`.

---

## How to run any app locally

Two terminals per app:

```bash
# Terminal 1 — backend
cd <app>/backend
cp .env.example .env       # then fill in secrets (see env vars table below)
uv sync
uv run uvicorn src.main:app --reload --port 8000

# Terminal 2 — frontend
cd <app>/frontend
cp .env.local.example .env.local
npm install --legacy-peer-deps
npm run dev
```

Visit <http://localhost:3000>. Swagger at <http://localhost:8000/docs>.

### Env vars per app (backend `.env`)

| App | Required env vars |
|---|---|
| `data-ai-analyst` | `GCP_PROJECT_ID` (default `funnel-clients`), `BIGQUERY_DATASET` (must contain `funnel_main`/`funnel_audience`/`funnel_conversions` tables), `OPENAI_API_KEY` |
| `creative-ai-analyst` | `GCP_PROJECT_ID=generative-ai-418805`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `FB_ACCESS_TOKEN`, optionally `GCS_BUCKET_AD_IMAGES` (default `kedet-ad-images`) |
| `competitive-ai` | `SPYFU_API_KEY`, `SERPAPI_KEY`, `FB_ACCESS_TOKEN` |

Local GCP auth: `gcloud auth application-default login` — sets up ADC; no JSON
key files anywhere.

### Reload gotcha

`uvicorn --reload` watches Python files only, **not `.env`**. After editing
`.env`, trigger reload by touching any `.py` file:
```bash
touch <app>/backend/src/main.py
```

---

## Reference: legacy Kedet source

Aman has the legacy Kedet code at `~/Projects/Kedets/` on his home Mac
(not in this repo, not on this office laptop unless he brings it). The two
relevant subdirs:

- `kedet-frontend/client/src/pages/{AI,CreativeAi,CompetitiveAnalysis}/` — original React pages
- `kedet_backend/src/routes/{aiRouter.js,creative-ai.js,competitive-analysis.js}` — original Express routes
- `kedet_backend/src/services/{creative-ai.js,competitive-analysis.js,gcs.js,fb.js,creative-ai-storage.js}` — original service layer

If a question comes up about what the original behavior was, the user can paste
the relevant snippet — don't speculate.

---

## Pre-commit hooks (already set up)

`gitleaks` runs on every commit — blocks any secret from landing in git history.
On a fresh clone:

```bash
brew install pre-commit gitleaks
pre-commit install
```

Without this, the secrets-leak protection only exists in CI / not at all.

---

## Recent context (last few sessions)

- 2026-04-25: scaffolded all three apps with FastAPI + Next.js skeleton.
- 2026-04-26: ported full backend logic faithfully to the original Kedet code
  for all three apps (Creative AI minus `file-upload/fbAdImages`).
- 2026-04-26: pushed initial drop to `tamantanwar/standalone`. Pre-commit
  hooks added at repo root.

Memory file at `~/.claude/projects/-Users-tagspecialist-Projects-Kedets/memory/`
on the home machine has more granular history but is local-only.
