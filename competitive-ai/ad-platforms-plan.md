# Ad Platforms Expansion — Architecture Plan

Status: proposal · 2026-11-24

Goal: extend Kedet Competitive Analysis beyond Google and Facebook ads to
LinkedIn, TikTok and other ad platforms, without exposing which data providers
we use.

---

## 1. What's available (research summary)

| Platform | Source options | Coverage | Auth / access | Verdict |
|---|---|---|---|---|
| **LinkedIn** | Official `rest/adLibrary` (gated product, poorly documented, reported 404s) · **SearchAPI.io `linkedin_ad_library`** | Ads since Jun 2023, kept 1 yr after last impression. Impressions/targeting only for EU ads | Official: app review. SearchAPI: API key | **Add (Phase 1) via SearchAPI** |
| **TikTok** | Official Commercial Content API (application + approval) · **SearchAPI.io `tiktok_ads_library`** (+ advertiser search, ad details) | **EEA, Switzerland, UK only** | Official: research-style application. SearchAPI: API key | **Add (Phase 1) via SearchAPI**, labelled UK/EU-only |
| **Microsoft / Bing** | Official **Microsoft Ad Library API** | **EU/EEA only**, 1-yr retention, 1–3 day lag | Public, no sign-up; dev token for higher limits | **Add (Phase 2), direct** |
| **Snapchat** | Official **Ads Gallery API** (`adsapi.snapchat.com/v1/ads_library`) | EU + political ads | No OAuth needed | **Add (Phase 2), direct** |
| **YouTube** | Already in Google Ads Transparency results (video format) | Global | Existing | **Add as a filter**, not a new source |
| Pinterest | No official repository API — scrapers only | EU | — | Defer (ToS / breakage risk) |
| X (Twitter) | No official API — aggregators/scrapers only | EU | — | Defer |
| Amazon | No public ad library | — | — | Not possible |

**Key constraint:** outside Google and LinkedIn, ad libraries exist because of the
EU Digital Services Act, so coverage is mostly **EU/UK only**. For US/CA/IN
prospects, LinkedIn is the only new platform with real data.

**Meta coverage fix:** Our current Meta source (Graph `/ads_archive`) returns
only political/issue ads outside the EU/UK. SearchAPI's `meta_ad_library` engine
reads the public Ad Library, which shows commercial ads in every country. Moving
Facebook to it would fix the empty results for US prospects. *This changes
original Kedet behaviour. Decide before Phase 1.*

**Why SearchAPI.io as the aggregator:** one key covers LinkedIn, TikTok, Meta and
Google Transparency. Billing is per search (shared credit pool across engines,
roughly 25 ads per page). A `searchapi-key` secret **already exists** in
`kedetapplication`. There is also a `SEARCHAPI_KEY` secret; confirm which one is
current. Keep SerpAPI for Google for now, so we change one thing at a time.

---

## 2. Target architecture

```
Frontend (Next.js)                       Backend (FastAPI)
──────────────────                       ─────────────────────────────────────────
Platform chips ◄── GET /ad-platforms ──► PlatformRegistry
 (dynamic list,                            │  key, public label, countries,
  coverage hints)                          │  enabled (= secret present)
                                           ▼
Ad grid        ◄── GET /ads?platform=… ─► AdSourceAdapter (one per platform)
 (one component,     &advertiser=…           ├─ GoogleAdapter     (SerpAPI)       existing
  platform badge)    &country=…              ├─ FacebookAdapter   (Graph → SearchAPI?)
                                             ├─ LinkedInAdapter   (SearchAPI)     new
"All platforms" ◄── GET /ads?platform=all    ├─ TikTokAdapter     (SearchAPI)     new
 tab, per-platform     (fan-out, partial     ├─ MicrosoftAdapter  (official)      new
 status                 results)             └─ SnapchatAdapter   (official)      new
                                           ▼
                                         NormalizedAd  +  TTL cache  +  AdvertiserResolver
```

### 2.1 Adapter contract (`backend/src/services/ad_sources/`)

```python
class AdSourceAdapter(Protocol):
    key: str                      # "linkedin"
    label: str                    # "LinkedIn"  (public; never the provider name)
    countries: set[str] | None    # None = global; else ISO-2 allowlist (GB, DE, FR, …)
    def enabled(self) -> bool: ...                       # its secret is configured
    async def search(self, q: AdQuery) -> list[NormalizedAd]: ...
```

Each adapter owns its provider URL, auth, country-code mapping (UK→GB etc.),
error sanitising (reusing `_get_json` + `PUBLIC_LABELS`), and mapping the
provider response to `NormalizedAd`.

### 2.2 Normalised ad shape (one UI component for every platform)

```python
class NormalizedAd(BaseModel):
    id: str
    platform: str                 # "linkedin"
    advertiser: str | None
    format: Literal["text", "image", "video", "carousel", "other"]
    headline: str | None
    body: str | None
    media_url: str | None         # image or video thumbnail
    landing_url: str | None
    preview_url: str | None       # public permalink only — never tokenised URLs
    first_shown: date | None
    last_shown: date | None
    impressions: Range | None     # often EU-only
    regions: list[str] = []
    extras: dict[str, Any] = {}   # platform-specific fields for the detail modal
```

Strip provider-identifying fields (e.g. `serpapi_*`, SearchAPI metadata) in the
adapter. This extends the rule we already apply to Google and Facebook.

### 2.3 Advertiser resolution (the real hard part)

Platforms search by different keys. Google uses a domain. LinkedIn and TikTok use
an advertiser or company name. Meta uses a page name or keyword. Microsoft uses an
advertiser name.

`AdvertiserResolver.resolve(domain) -> AdvertiserIdentity`:
1. Use the `advertiser` name from the Google Transparency results we already fetch.
   It is the verified legal name.
2. Fall back to a name derived from the domain (`acme-shoes.com` → "Acme Shoes").
3. Show the resolved name in the UI with an **editable field**, so the salesperson
   can correct it before searching other platforms.
4. For TikTok, use SearchAPI's advertiser-search engine to turn the name into an
   `advertiser_token`.

### 2.4 Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /competitive-analysis/ad-platforms` | List of `{key, label, enabled, countries}` that drives the UI chips and the "UK/EU only" hints |
| `GET /competitive-analysis/ads?platform=&advertiser=&domain=&country=` | Normalised ads for one platform, or `platform=all` for a parallel fan-out returning `{results: {platform: {status, ads, message}}}` |
| `GET /competitive-analysis/adCreatives` (existing) | **Keep unchanged** until the frontend moves over, then deprecate |

### 2.5 Caching and cost control
- An in-memory TTL cache (24 h) keyed by `(platform, advertiser, country)`, so
  repeat searches during a demo cost nothing.
- Cloud Run instances are ephemeral, so if hit rates matter, move the cache to
  Firestore or Memorystore later. Start in memory.
- Only search platforms that cover the selected country. Don't spend credits on
  TikTok for US.

### 2.6 Country handling
The current country list is `US, CA, IN, UK`. Add the main EU markets
(DE, FR, NL, ES, IT, IE, SE…) so the EU-only platforms are usable. Each adapter
maps codes to its own format. A platform that doesn't cover the selected country
appears as a disabled chip with a tooltip ("Available for UK/EU markets").

### 2.7 Secrets and IAM
- Reuse `searchapi-key` and grant the backend service account
  `secretAccessor` on that secret only.
- Microsoft needs no key (optional dev token later). Snapchat needs no key.
- Add `SEARCHAPI_KEY` to `config.py` and the Secret Manager fallback map, and
  mount it via `--set-secrets` on Cloud Run.
- An adapter whose secret is missing reports `enabled: false`, and the UI hides it.

---

## 3. Phased delivery

| Phase | Scope | Effort |
|---|---|---|
| **0** | Decide: move Facebook to SearchAPI (fixes US coverage)? Confirm which SearchAPI secret is current. Check SearchAPI plan credits | decision |
| **1** | Adapter package and registry, `NormalizedAd`, wrap the existing Google and Facebook sources as adapters, add **LinkedIn** and **TikTok** via SearchAPI, `/ad-platforms` and `/ads` endpoints, advertiser resolver, tests with mocked transports | ~3–4 days |
| **2** | Frontend: dynamic platform chips, unified ad grid with platform badge, editable advertiser name, EU countries | ~2–3 days |
| **3** | **Microsoft** and **Snapchat** direct adapters, YouTube/video filter on Google | ~2 days |
| **4** | "All platforms" fan-out view with per-platform status, TTL cache, credit usage logging | ~2 days |
| Later | Pinterest / X if an official API appears. Persistent cache. Ad-change alerts per competitor | — |

## 4. Risks

- **Aggregator dependency:** SearchAPI is a third-party scraper of public
  libraries. Mitigation: the adapter boundary means we can move one platform to
  its official API (LinkedIn, TikTok approval) without touching the UI.
- **EU-only data** may look thin in US demos. Mitigation: coverage hints in the
  UI. LinkedIn and Google remain global.
- **Advertiser matching errors** (common brand names). Mitigation: the editable
  advertiser field, plus showing the matched advertiser on each result.
- **Cost growth** with the "All platforms" fan-out. Mitigation: country-aware
  skipping, cache, per-request credit logging.

## Sources
- LinkedIn Ad Library API (third-party guide): https://zenabm.com/blog/linkedin-ads-library-api
- LinkedIn Marketing API tiers: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/marketing-tiers
- LinkedIn Ad Library coverage: https://www.swydo.com/?p=19056 · https://netlab-eco-ufrj.github.io/data_not_found/chapters/appendices/linkedin.html
- TikTok Commercial Content API: https://developers.tiktok.com/products/commercial-content-api · https://support.tiktok.com/en/account-and-privacy/personalized-ads-and-data/commercial-content-library
- SearchAPI LinkedIn: https://www.searchapi.io/docs/linkedin-ad-library-api
- SearchAPI TikTok: https://www.searchapi.io/docs/tiktok-ads-library-api
- SearchAPI pricing model (competitor comparison): https://metapi.io/compare/searchapi
- Microsoft Ad Library API: https://learn.microsoft.com/en-us/advertising/guides/ad-library-api · https://help.ads.microsoft.com/apex/index/3/en/60180
- Snapchat Ads Gallery API: https://developers.snap.com/api/marketing-api/Ads-Gallery-Api/using-the-api
- Pinterest (no official repository API): https://netlab-eco-ufrj.github.io/data_not_found/chapters/appendices/pinterest.html
