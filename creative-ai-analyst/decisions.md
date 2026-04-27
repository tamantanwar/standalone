# Architectural Decisions

Each entry: the choice, the alternatives considered, the reason. This document is the
portfolio artifact — it proves the architecture is *defended*, not just shipped.

---

## D-001 — Polyrepo, three apps, one repo each

**Choice:** Three separate repos: `data-ai-analyst`, `creative-ai-analyst`, `competitive-ai`.

**Alternatives considered:**
- Monorepo with three services. Less duplication, atomic refactors across all three.
- Single mega-app with three modes. Simpler infra, harder to evolve independently.

**Reason:** Each app is a clean portfolio artifact with an isolated GitHub URL, README,
and decision log. The apps share zero runtime state and may diverge in access patterns
once different stakeholders own different ones. Boilerplate duplication (~200 lines of
Dockerfiles, CI configs, auth middleware per repo) is bounded; coupling cost in a
monorepo with three deploy targets is unbounded if boundaries leak.

---

## D-002 — FastAPI backend (not Flask, not Django)

**Choice:** FastAPI on Python 3.12+, served by uvicorn.

**Alternatives considered:**
- Flask: simpler, but async support is bolt-on; needs extensions for everything
  FastAPI does natively.
- Django: ORM-heavy framework optimized for traditional CRUD apps; overkill for
  services that mostly proxy to BigQuery and OpenAI.

**Reason:** Native async (critical for streaming OpenAI responses), Pydantic-based
request/response validation that doubles as auto-generated OpenAPI docs, zero
boilerplate for typed endpoints, first-class support for dependency injection.
Matches the AI-engineering job market's expected stack.

---

## D-003 — Next.js 15 (App Router) frontend (not plain React, not Streamlit)

**Choice:** Next.js 15 with App Router, TypeScript, Tailwind 4.

**Alternatives considered:**
- Streamlit: ships in days, but visual ceiling is low. Recognizable as an internal
  tool, not a polished product.
- Vanilla React + Vite + Express: more flexible, but requires hand-rolling SSR,
  routing, and bundling that Next.js gives for free.

**Reason:** The user is the warroom **sales team demoing to prospects** — visual polish
is part of the perceived product quality. Server components let data-fetching and
secrets-handling stay server-side without exposing keys to the browser. App Router's
streaming RSC pattern matches LLM token-streaming naturally.

---

## D-004 — Two Cloud Run services per app (not one combined service)

**Choice:** Each app deploys as two Cloud Run services: `*-backend` (FastAPI) and
`*-frontend` (Next.js). Frontend is the only public-facing service.

**Alternatives considered:**
- One Cloud Run service running both via reverse proxy. Single deploy target,
  simpler infra.
- Frontend in Vercel + backend on Cloud Run. Hosting fragmentation.

**Reason:** Service boundaries match language and concern boundaries. Each service
has its own SA, its own IAM, its own scaling characteristics, its own deploy
pipeline. Backend can be scaled independently when AI calls get heavy. Backend is
non-public — only the frontend SA can invoke it (see D-006). Defense in depth.

---

## D-005 — Workload Identity, no service-account JSON keys

**Choice:** Each Cloud Run service runs as a dedicated SA. Credentials are fetched
from the GCP metadata server at runtime via Application Default Credentials (ADC).
No JSON key files exist anywhere — not in repos, not in secrets, not on disk.

**Alternatives considered:**
- JSON service-account key in Secret Manager, mounted as `GOOGLE_APPLICATION_CREDENTIALS`.
  Works, but the key is a long-lived credential and a leak surface.
- User-impersonation flow. Requires interactive auth, doesn't suit headless services.

**Reason:** Long-lived JSON keys are the #1 cause of GCP credential leaks. Workload
Identity makes them obsolete: the runtime identity is bound to the workload itself,
no credential to leak. Bonus: same code works locally (where ADC picks up the
developer's `gcloud auth application-default login`) without code changes.

---

## D-006 — Service-to-service auth between frontend and backend

**Choice:** Backend is deployed with `--no-allow-unauthenticated`. The frontend's
SA is granted `roles/run.invoker` on the backend service. The frontend mints an
OIDC ID token (audience = backend URL) via the metadata server on each request,
passes it as `Authorization: Bearer <token>`. Cloud Run validates the token before
the request reaches the backend.

**Alternatives considered:**
- Public backend with shared API key. Anyone who finds the URL can hit it.
- VPC Service Controls / serverless VPC connector. Network-level isolation;
  significantly more infra and cost.
- Pass the user's session JWT through to backend. Couples backend's trust model
  to the frontend's auth library.

**Reason:** Defense in depth. Backend exposure is bounded to the frontend service's
identity, not the public internet. If a malicious user finds the backend URL,
they cannot invoke it without the frontend's SA. OIDC tokens are short-lived
(1h max), minted on-demand, and validated by Cloud Run's infra layer — no auth
code in the backend.

---

## D-007 — Google Secret Manager for all secrets

**Choice:** OpenAI API key, BigQuery dataset names, and any third-party API keys
live in Secret Manager. Each Cloud Run service's SA is granted
`roles/secretmanager.secretAccessor` on **only the secrets it needs**, not
project-wide.

**Alternatives considered:**
- Env vars set directly on the Cloud Run service. Visible in console to anyone
  with viewer role; no rotation; no audit log of access.
- Encrypted .env files in the repo. Decryption key has to live somewhere.

**Reason:** Secret Manager gives audit-logged, IAM-gated, rotatable storage.
Per-secret IAM enforces least privilege — a compromise of one service's SA
doesn't expose every secret in the project. Secrets are mounted as env vars at
container boot (rotation requires redeploy; acceptable for this scale).

---

## D-008 — `uv` for Python dependency management

**Choice:** `uv` (by Astral) for Python deps, `pyproject.toml` for declaration.

**Alternatives considered:**
- pip + requirements.txt. No lockfile by default, slow.
- Poetry. Mature, but slower than uv and requires its own venv conventions.
- pipenv. Effectively deprecated.

**Reason:** uv is 10–100× faster than pip/poetry, has a proper lockfile (`uv.lock`),
and is becoming the AI-engineering ecosystem default (Anthropic, OpenAI, many
YC AI companies use it). Built-in support for dependency groups (dev/test/prod)
without plugin gymnastics.

---

## D-009 — gitleaks pre-commit hook on every repo

**Choice:** `.pre-commit-config.yaml` runs gitleaks on every commit. Blocks commits
that contain secrets matching common patterns (GCP keys, OpenAI keys, generic
high-entropy strings).

**Reason:** Forced into the repo from day one because the legacy Kedet codebase
shipped two GCP service-account JSON keys to git history (rotated and deleted
during this project's discovery phase). The fix isn't policy — it's tooling that
makes the bug impossible to commit.
