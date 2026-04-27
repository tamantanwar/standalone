# Deploying to Cloud Run

This repo deploys **6 Cloud Run services** — backend + frontend for each of
the three apps — using Cloud Run's "Continuously deploy from a repository"
GitHub integration. Cloud Run + Cloud Build auto-detect the `Dockerfile`
that already lives in each `<app>/<backend|frontend>/` folder, so there's
no separate `cloudbuild.yaml` to maintain.

| Service | Source dir | Allow unauth? | Notes |
|---|---|---|---|
| `data-ai-analyst-backend` | `data-ai-analyst/backend` | ❌ | FastAPI, BigQuery, OpenAI |
| `data-ai-analyst-frontend` | `data-ai-analyst/frontend` | ❌ | Next.js, IAM-gated |
| `creative-ai-analyst-backend` | `creative-ai-analyst/backend` | ❌ | FastAPI, BigQuery, GCS, OpenAI, Gemini, Meta |
| `creative-ai-analyst-frontend` | `creative-ai-analyst/frontend` | ❌ | Next.js, IAM-gated |
| `competitive-ai-backend` | `competitive-ai/backend` | ❌ | FastAPI, SpyFu, SerpAPI, Meta |
| `competitive-ai-frontend` | `competitive-ai/frontend` | ❌ | Next.js, IAM-gated |

`--no-allow-unauthenticated` everywhere. Frontends are reached by users via
Google sign-in (Cloud Run IAM `roles/run.invoker`). Frontend → backend uses
service-to-service OIDC tokens minted from the metadata server (already
implemented in `frontend/src/lib/backend-client.ts`).

---

## 1. One-time GCP setup

Cloud Run + Secret Manager + Cloud Build live in the **deploy project**
(`kedetapplication`). The data resources stay in their original projects:

- BigQuery `funnel-clients.<dataset>.funnel_*` lives in `funnel-clients`
- BigQuery `generative-ai-418805.elt_meta_ads.creative_ai` and the
  `kedet-ad-images` GCS bucket live in `generative-ai-418805`

The Cloud Run service accounts (created in the deploy project) get
**cross-project IAM** on the resources they need.

```bash
# Where Cloud Run, SAs, secrets, Artifact Registry live
DEPLOY_PROJECT=kedetapplication
REGION=us-central1

# Source-of-truth projects for data resources (unchanged)
DATA_PROJECT=funnel-clients
CREATIVE_PROJECT=generative-ai-418805

gcloud config set project $DEPLOY_PROJECT

# Enable the APIs Cloud Run + source-deploy need (in the deploy project)
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  bigquery.googleapis.com \
  storage.googleapis.com \
  generativelanguage.googleapis.com
```

### 1a. Service accounts (one per service)

Each Cloud Run service runs as its own least-privilege SA. Create all six
in the deploy project:

```bash
for s in \
  data-ai-analyst-backend  data-ai-analyst-frontend \
  creative-ai-analyst-backend  creative-ai-analyst-frontend \
  competitive-ai-backend  competitive-ai-frontend; do
  gcloud iam service-accounts create $s-sa \
    --display-name="$s Cloud Run SA"
done
```

### 1b. Cross-project IAM grants per backend SA

The SAs live in `kedetapplication`, but they need access to BigQuery /
GCS resources that live in **other projects**. Each binding is applied to
the resource's owning project, not the deploy project:

```bash
# data-ai-analyst-backend → BigQuery in funnel-clients (cross-project)
for role in roles/bigquery.dataViewer roles/bigquery.jobUser; do
  gcloud projects add-iam-policy-binding $DATA_PROJECT \
    --member=serviceAccount:data-ai-analyst-backend-sa@$DEPLOY_PROJECT.iam.gserviceaccount.com \
    --role=$role
done

# creative-ai-analyst-backend → BigQuery + GCS in generative-ai-418805 (cross-project)
for role in roles/bigquery.dataEditor roles/bigquery.jobUser; do
  gcloud projects add-iam-policy-binding $CREATIVE_PROJECT \
    --member=serviceAccount:creative-ai-analyst-backend-sa@$DEPLOY_PROJECT.iam.gserviceaccount.com \
    --role=$role
done
gcloud storage buckets add-iam-policy-binding gs://kedet-ad-images \
  --member=serviceAccount:creative-ai-analyst-backend-sa@$DEPLOY_PROJECT.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin

# competitive-ai-backend uses no GCP-internal services — no grants needed
```

**Note:** the `kedet-ad-images` bucket binding requires that you (or
whoever runs this) have `storage.admin` on the bucket. If you don't, ask
the owner of `generative-ai-418805` to run that single command for you.

### 1c. Frontend → backend invoker

Each frontend SA needs `roles/run.invoker` on its corresponding backend
service. (Add this **after** the backend service exists — see step 3.)

```bash
for app in data-ai-analyst creative-ai-analyst competitive-ai; do
  gcloud run services add-iam-policy-binding $app-backend \
    --region=$REGION \
    --member=serviceAccount:$app-frontend-sa@$DEPLOY_PROJECT.iam.gserviceaccount.com \
    --role=roles/run.invoker
done
```

### 1d. Secrets in Secret Manager

```bash
# Common pattern: echo -n "VALUE" | gcloud secrets create NAME --data-file=-
gcloud secrets create openai-api-key   --replication-policy=automatic
gcloud secrets create gemini-api-key   --replication-policy=automatic
gcloud secrets create fb-access-token  --replication-policy=automatic
gcloud secrets create spyfu-api-key    --replication-policy=automatic
gcloud secrets create serpapi-key      --replication-policy=automatic
# Add a version to each (do this in the console or with `gcloud secrets versions add`)
```

Per-secret SA grants (only the SAs that need it):

```bash
# OPENAI_API_KEY → both AI backends
for app in data-ai-analyst creative-ai-analyst; do
  gcloud secrets add-iam-policy-binding openai-api-key \
    --member=serviceAccount:$app-backend-sa@$DEPLOY_PROJECT.iam.gserviceaccount.com \
    --role=roles/secretmanager.secretAccessor
done

# Gemini + Meta → creative-ai-analyst-backend only
for s in gemini-api-key fb-access-token; do
  gcloud secrets add-iam-policy-binding $s \
    --member=serviceAccount:creative-ai-analyst-backend-sa@$DEPLOY_PROJECT.iam.gserviceaccount.com \
    --role=roles/secretmanager.secretAccessor
done

# SpyFu + SerpAPI + Meta → competitive-ai-backend
for s in spyfu-api-key serpapi-key fb-access-token; do
  gcloud secrets add-iam-policy-binding $s \
    --member=serviceAccount:competitive-ai-backend-sa@$DEPLOY_PROJECT.iam.gserviceaccount.com \
    --role=roles/secretmanager.secretAccessor
done
```

---

## 2. Connect GitHub to Cloud Run (one-time)

In the Cloud Run console:

1. **Create service** → choose **"Continuously deploy from a repository
   (source or function)"**.
2. Click **Set up with Cloud Build** → authorize the Google Cloud Build
   GitHub App on `tamantanwar/standalone`.
3. After auth, Cloud Run can target a specific subdirectory of the repo as
   the build context. Repeat the steps below six times (once per service).

---

## 3. Deploy each service

Repeat the **Create service** flow six times with the values from this
table. After all six are deployed, run step 1c (the frontend→backend
invoker bindings).

### data-ai-analyst-backend

| Field | Value |
|---|---|
| Source | `tamantanwar/standalone`, branch `main`, **build context** `data-ai-analyst/backend` |
| Build type | Dockerfile (auto-detected) |
| Region | `us-central1` |
| Authentication | **Require authentication** |
| CPU / Memory | 1 vCPU / 1 GiB |
| Concurrency | 40 |
| Min/Max instances | 0 / 10 |
| Timeout | 300s |
| Service account | `data-ai-analyst-backend-sa` |
| Env vars | `ENVIRONMENT=production`, `GCP_PROJECT_ID=funnel-clients`, `BIGQUERY_DATASET=<your dataset>` |
| Secrets | `OPENAI_API_KEY` ← `openai-api-key:latest` |

### data-ai-analyst-frontend

| Field | Value |
|---|---|
| Source | `tamantanwar/standalone`, branch `main`, **build context** `data-ai-analyst/frontend` |
| Build type | Dockerfile (auto-detected) |
| Region | `us-central1` |
| Authentication | **Require authentication** |
| CPU / Memory | 1 vCPU / 512 MiB |
| Concurrency | 80 |
| Min/Max instances | 0 / 10 |
| Timeout | 60s |
| Service account | `data-ai-analyst-frontend-sa` |
| Env vars | `NODE_ENV=production`, `BACKEND_URL=<paste data-ai-analyst-backend URL after it deploys>` |

### creative-ai-analyst-backend

| Field | Value |
|---|---|
| Build context | `creative-ai-analyst/backend` |
| Region | `us-central1` |
| Authentication | **Require authentication** |
| CPU / Memory | 2 vCPU / 2 GiB *(image generation is RAM-hungry)* |
| Concurrency | 20 |
| Timeout | 600s *(gpt-image-2 + Gemini video can take >2 min)* |
| Service account | `creative-ai-analyst-backend-sa` |
| Env vars | `ENVIRONMENT=production`, `GCP_PROJECT_ID=generative-ai-418805`, `GCS_BUCKET_AD_IMAGES=kedet-ad-images`, `OPENAI_CHAT_MODEL=gpt-5.4-mini`, `OPENAI_IMAGE_MODEL=gpt-image-2` |
| Secrets | `OPENAI_API_KEY` ← `openai-api-key:latest`, `GEMINI_API_KEY` ← `gemini-api-key:latest`, `FB_ACCESS_TOKEN` ← `fb-access-token:latest` |

### creative-ai-analyst-frontend

| Field | Value |
|---|---|
| Build context | `creative-ai-analyst/frontend` |
| Region | `us-central1` |
| Authentication | **Require authentication** |
| CPU / Memory | 1 vCPU / 512 MiB |
| Concurrency | 80 |
| Timeout | 300s *(audit / variant proxy can be long)* |
| Service account | `creative-ai-analyst-frontend-sa` |
| Env vars | `NODE_ENV=production`, `BACKEND_URL=<creative-ai-analyst-backend URL>` |

### competitive-ai-backend

| Field | Value |
|---|---|
| Build context | `competitive-ai/backend` |
| Region | `us-central1` |
| Authentication | **Require authentication** |
| CPU / Memory | 1 vCPU / 1 GiB |
| Concurrency | 40 |
| Timeout | 300s |
| Service account | `competitive-ai-backend-sa` |
| Env vars | `ENVIRONMENT=production` |
| Secrets | `SPYFU_API_KEY` ← `spyfu-api-key:latest`, `SERPAPI_KEY` ← `serpapi-key:latest`, `FB_ACCESS_TOKEN` ← `fb-access-token:latest` |

### competitive-ai-frontend

| Field | Value |
|---|---|
| Build context | `competitive-ai/frontend` |
| Region | `us-central1` |
| Authentication | **Require authentication** |
| CPU / Memory | 1 vCPU / 512 MiB |
| Concurrency | 80 |
| Timeout | 60s |
| Service account | `competitive-ai-frontend-sa` |
| Env vars | `NODE_ENV=production`, `BACKEND_URL=<competitive-ai-backend URL>` |

---

## 4. After-deploy steps

### 4a. Wire the frontend `BACKEND_URL`

When you create a frontend service Cloud Run won't yet know its backend's
URL. Two ways to handle it:

- Deploy the backend first, copy its URL, then create the frontend with
  `BACKEND_URL` already set, **or**
- Create the frontend with a placeholder and edit the env var afterwards
  (Cloud Run console → service → "Edit & deploy new revision" → Variables).

The frontend `getServiceToServiceAuthHeaders` mints OIDC tokens with the
backend URL as the audience, so the env var has to match the backend
service URL exactly (incl. the random Cloud Run suffix).

### 4b. Apply the frontend → backend invoker grants (step 1c above)

This needs to run *after* the backend service exists. If you forget,
the frontend will get `403 PERMISSION_DENIED` calling the backend.

### 4c. Grant end-users frontend access

```bash
USER_EMAIL=you@yourdomain.com
for app in data-ai-analyst creative-ai-analyst competitive-ai; do
  gcloud run services add-iam-policy-binding $app-frontend \
    --region=$REGION \
    --member=user:$USER_EMAIL \
    --role=roles/run.invoker
done
```

For a team, swap `user:` → `group:team@yourdomain.com`.

---

## 5. Subsequent deploys

Every push to `main` triggers a Cloud Build re-deploy of the touched
service automatically — no console clicks needed. Cloud Build only rebuilds
services whose source dir changed, so a frontend-only PR doesn't redeploy
backends.

To manually redeploy a service without pushing: Cloud Run console →
service → **Edit & deploy new revision** → keep all settings → Deploy.

---

## 6. Local dev still works

Source-deploy doesn't change anything about local development — keep using
the per-app two-terminal flow documented in each `README.md`. The
`Dockerfile`s are shared between local Docker and Cloud Run; the
`docker-compose.yml`s use the `dev` build target (hot-reload).
