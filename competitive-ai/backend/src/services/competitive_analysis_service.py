import asyncio
import logging
import re
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import httpx

from src.config import settings

logger = logging.getLogger(__name__)

MONTH_MAP = {
    1: "January",
    2: "February",
    3: "March",
    4: "April",
    5: "May",
    6: "June",
    7: "July",
    8: "August",
    9: "September",
    10: "October",
    11: "November",
    12: "December",
}

SPYFU_BASE = "https://www.spyfu.com/apis"
SERPAPI_BASE = "https://serpapi.com/search"
FB_GRAPH_BASE = "https://graph.facebook.com/v21.0"
SEARCHAPI_BASE = "https://www.searchapi.io/api/v1/search"

# SpyFu uses "UK"; Meta and LinkedIn expect ISO 3166-1 alpha-2 ("GB").
META_COUNTRY_MAP = {"UK": "GB"}

LINKEDIN_CACHE_TTL_S = 24 * 3600  # each LinkedIn search costs a credit


# User-facing labels: provider names must never reach the UI (logs only).
PUBLIC_LABELS = {
    "SpyFu": "Competitor data",
    "SerpAPI": "Google ad data",
    "Facebook Ads Library": "Facebook ad data",
    "SearchAPI": "Advertiser lookup",
    "SearchAPI LinkedIn": "LinkedIn ad data",
}

FB_AD_LIBRARY_URL = "https://www.facebook.com/ads/library/?id={ad_id}"


class CompetitiveAnalysisError(Exception):
    """
    Raised when an upstream API call fails. Messages are shown to users, so they
    must not name the underlying data provider or include request details.
    """


def _not_configured(source: str, env_var: str) -> CompetitiveAnalysisError:
    logger.error("%s is not configured (%s missing)", source, env_var)
    return CompetitiveAnalysisError(
        f"{PUBLIC_LABELS[source]} service is not configured"
    )


def clean_domain(domain: str) -> str:
    """Normalise user input like 'https://www.Example.com/path' to 'example.com'."""
    value = domain.strip().lower()
    if "://" not in value:
        value = f"//{value}"
    host = urlsplit(value).hostname or ""
    return host.removeprefix("www.")


def to_meta_country(country_code: str) -> str:
    code = country_code.strip().upper()
    return META_COUNTRY_MAP.get(code, code)


async def _get_json(
    source: str, url: str, params: dict[str, Any], request_timeout: float
) -> dict[str, Any]:
    """
    GET a JSON endpoint without letting the request URL (which carries the API
    key as a query param) reach error messages or logs. `source` names the
    provider for logs; errors raised use its public label.
    """
    label = PUBLIC_LABELS[source]
    async with httpx.AsyncClient(timeout=request_timeout) as client:
        try:
            resp = await client.get(url, params=params)
        except httpx.TimeoutException as exc:
            logger.warning("%s request timed out", source)
            raise CompetitiveAnalysisError(f"{label} request timed out") from exc
        except httpx.HTTPError as exc:
            logger.warning("%s request failed: %s", source, type(exc).__name__)
            raise CompetitiveAnalysisError(f"{label} request failed") from exc

    if resp.is_error:
        logger.warning(
            "%s returned HTTP %s: %s", source, resp.status_code, resp.text[:500]
        )
        raise CompetitiveAnalysisError(f"{label} service returned HTTP {resp.status_code}")

    try:
        body = resp.json()
    except ValueError as exc:
        logger.warning("%s returned non-JSON body: %s", source, resp.text[:500])
        raise CompetitiveAnalysisError(f"{label} service returned an invalid response") from exc

    if not isinstance(body, dict):
        raise CompetitiveAnalysisError(f"{label} service returned an unexpected response")
    return body


async def fetch_ppc_competitors(
    domain: str, country_code: str
) -> list[dict[str, Any]]:
    if not settings.spyfu_api_key:
        raise _not_configured("SpyFu", "SPYFU_API_KEY")

    body = await _get_json(
        "SpyFu",
        f"{SPYFU_BASE}/competitors_api/v2/ppc/getTopCompetitors",
        {
            "domain": clean_domain(domain),
            "startingRow": 1,
            "pageSize": 5,
            "countryCode": country_code,
            "api_key": settings.spyfu_api_key,
        },
        request_timeout=30,
    )
    return body.get("results", []) or []


async def fetch_domain_stats(
    domain: str, country_code: str, time_period: int
) -> list[dict[str, Any]]:
    if not settings.spyfu_api_key:
        raise _not_configured("SpyFu", "SPYFU_API_KEY")

    body = await _get_json(
        "SpyFu",
        f"{SPYFU_BASE}/domain_stats_api/v2/getAllDomainStats",
        {
            "domain": domain,
            "countryCode": country_code,
            "api_key": settings.spyfu_api_key,
        },
        request_timeout=30,
    )
    results: list[dict[str, Any]] = body.get("results", []) or []
    if time_period and time_period > 0:
        results = results[-time_period:]

    for entry in results:
        month = entry.get("searchMonth")
        if isinstance(month, int):
            entry["searchMonth"] = MONTH_MAP.get(month, str(month))

    return results


async def fetch_competitor_stats(
    competitors: list[dict[str, Any]], country_code: str, time_period: int
) -> list[dict[str, Any]]:
    """
    Fetch stats for all competitors in parallel. A competitor whose stats fail
    is skipped (and logged) rather than failing the whole response; if every
    lookup fails, the first error is raised.
    """
    domains = [c["domain"] for c in competitors if c.get("domain")]
    if not domains:
        return []

    outcomes = await asyncio.gather(
        *(fetch_domain_stats(d, country_code, time_period) for d in domains),
        return_exceptions=True,
    )

    stats: list[dict[str, Any]] = []
    errors: list[CompetitiveAnalysisError] = []
    for comp_domain, outcome in zip(domains, outcomes, strict=True):
        if isinstance(outcome, CompetitiveAnalysisError):
            logger.warning("Skipping stats for %s: %s", comp_domain, outcome)
            errors.append(outcome)
            continue
        if isinstance(outcome, BaseException):
            raise outcome
        for month_data in outcome:
            month_data["domain"] = comp_domain
        stats.extend(outcome)

    if errors and len(errors) == len(domains):
        raise errors[0]
    return stats


async def fetch_google_ad_creatives(domain: str) -> list[dict[str, Any]]:
    if not settings.serpapi_key:
        raise _not_configured("SerpAPI", "SERPAPI_KEY")

    body = await _get_json(
        "SerpAPI",
        SERPAPI_BASE,
        {
            "engine": "google_ads_transparency_center",
            "text": clean_domain(domain),
            "api_key": settings.serpapi_key,
        },
        request_timeout=60,
    )
    creatives: list[dict[str, Any]] = body.get("ad_creatives", []) or []
    # Drop provider-specific fields (e.g. `serpapi_details_link`).
    return [
        {k: v for k, v in c.items() if not k.lower().startswith("serpapi")}
        for c in creatives
    ]


# ---------------------------------------------------------------------------
# Facebook page resolution
#
# Meta's /ads_archive can't search by advertiser name, and keyword search
# (search_terms) matches ad text, so it mostly misses the competitor's own ads.
# We resolve domain -> Facebook page ID via SearchAPI's page search (1 credit,
# cached), then query /ads_archive by search_page_ids (free).
# ---------------------------------------------------------------------------

# Multi-part public suffixes we commonly see; enough to pick the brand label.
_MULTI_PART_SUFFIXES = (
    "co.uk", "org.uk", "ac.uk", "com.au", "net.au", "co.in", "co.nz",
    "com.br", "co.jp", "com.mx", "co.za", "com.sg",
)

PAGE_CACHE_TTL_S = 7 * 24 * 3600  # page IDs are stable
PAGE_CACHE_MISS_TTL_S = 6 * 3600  # retry unresolved domains sooner


@dataclass(frozen=True)
class MetaPage:
    page_id: str
    name: str


_page_cache: dict[str, tuple[float, MetaPage | None]] = {}


def _normalise_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def brand_query(domain: str) -> str:
    """'https://www.warbyparker.co.uk/x' -> 'warbyparker'."""
    host = clean_domain(domain)
    for suffix in _MULTI_PART_SUFFIXES:
        if host.endswith(f".{suffix}"):
            host = host.removesuffix(f".{suffix}")
            break
    else:
        host = host.rsplit(".", 1)[0] if "." in host else host
    return host.rsplit(".", 1)[-1]


def pick_meta_page(query: str, pages: list[dict[str, Any]]) -> MetaPage | None:
    """
    Choose the brand's page from page-search results. Only accept a page whose
    name, alias or Instagram handle matches the domain's brand label; among
    matches prefer verified pages, then the most likes. No match -> None (the
    caller falls back to keyword search rather than showing the wrong brand).
    """
    target = _normalise_name(query)
    if not target:
        return None

    def matches(page: dict[str, Any]) -> bool:
        handles = (page.get("name"), page.get("page_alias"), page.get("ig_username"))
        return any(h and _normalise_name(str(h)) == target for h in handles)

    candidates = [p for p in pages if p.get("page_id") and matches(p)]
    if not candidates:
        return None

    best = max(
        candidates,
        key=lambda p: (
            p.get("verification") == "BLUE_VERIFIED",
            int(p.get("likes") or 0),
        ),
    )
    return MetaPage(page_id=str(best["page_id"]), name=str(best.get("name") or ""))


async def resolve_meta_page(domain: str) -> MetaPage | None:
    """Best-effort domain -> Facebook page. Never raises; None means unresolved."""
    query = brand_query(domain)
    if not query or not settings.search_api_key:
        return None

    cached = _page_cache.get(query)
    if cached and cached[0] > time.monotonic():
        return cached[1]

    try:
        body = await _get_json(
            "SearchAPI",
            SEARCHAPI_BASE,
            {
                "engine": "meta_ad_library_page_search",
                "q": query,
                "api_key": settings.search_api_key,
            },
            request_timeout=30,
        )
    except CompetitiveAnalysisError:
        return None  # already logged; don't cache transient failures

    page = pick_meta_page(query, body.get("page_results", []) or [])
    ttl = PAGE_CACHE_TTL_S if page else PAGE_CACHE_MISS_TTL_S
    _page_cache[query] = (time.monotonic() + ttl, page)
    logger.info("Resolved Facebook page for %s: %s", query, page)
    return page


async def fetch_facebook_ad_creatives(
    domain: str, country_code: str, ad_status: str = "ALL"
) -> list[dict[str, Any]]:
    """
    `ad_status`: "ALL" (running now + past) or "ACTIVE" (running now only).
    "ALL" matches Meta's effective default, i.e. the original behaviour.
    """
    if not settings.fb_access_token:
        raise _not_configured("Facebook Ads Library", "FB_ACCESS_TOKEN")

    page = await resolve_meta_page(domain)
    if page:
        ads = await _query_ads_archive(
            {"search_page_ids": f'["{page.page_id}"]'}, country_code, ad_status
        )
        if ads:
            return _tag(ads, "page")
        logger.info(
            "Page %s has no ads for %s/%s; falling back to keyword search",
            page,
            country_code,
            ad_status,
        )

    # No page resolved, or the page has no ads: original keyword search. These
    # can include other advertisers, so they're tagged for the UI to label.
    ads = await _query_ads_archive(
        {"search_terms": clean_domain(domain)}, country_code, ad_status
    )
    return _tag(ads, "keyword")


def _tag(ads: list[dict[str, Any]], match_type: str) -> list[dict[str, Any]]:
    """`match_type`: "page" = competitor's own page, "keyword" = text match."""
    for ad in ads:
        ad["match_type"] = match_type
    return ads


async def _query_ads_archive(
    search: dict[str, str], country_code: str, ad_status: str
) -> list[dict[str, Any]]:
    body = await _get_json(
        "Facebook Ads Library",
        f"{FB_GRAPH_BASE}/ads_archive",
        {
            "ad_reached_countries": f'["{to_meta_country(country_code)}"]',
            **search,
            "ad_active_status": ad_status,
            "access_token": settings.fb_access_token,
            "fields": ",".join(
                [
                    "id",
                    "ad_creative_bodies",
                    "ad_creative_link_titles",
                    "ad_creative_link_descriptions",
                    "ad_creative_link_captions",
                    "ad_snapshot_url",
                    "ad_delivery_start_time",
                    "ad_delivery_stop_time",
                    "page_id",
                    "page_name",
                    "publisher_platforms",
                    "languages",
                    "bylines",
                    "currency",
                    "impressions",
                    "spend",
                    "estimated_audience_size",
                ]
            ),
        },
        request_timeout=60,
    )
    ads: list[dict[str, Any]] = body.get("data", []) or []
    # Meta's ad_snapshot_url embeds our access token; replace it with the public
    # Ads Library permalink so the token never reaches the browser.
    for ad in ads:
        ad.pop("ad_snapshot_url", None)
        if ad.get("id"):
            ad["ad_snapshot_url"] = FB_AD_LIBRARY_URL.format(ad_id=ad["id"])
    return ads


# ---------------------------------------------------------------------------
# LinkedIn Ad Library (via SearchAPI)
# ---------------------------------------------------------------------------

_linkedin_cache: dict[tuple[str, str], tuple[float, list[dict[str, Any]]]] = {}


async def fetch_linkedin_ad_creatives(
    domain: str, country_code: str | None
) -> list[dict[str, Any]]:
    """
    Search LinkedIn's Ad Library by advertiser name. LinkedIn needs the display
    name ("Warby Parker", not "warbyparker"), so we reuse the Facebook page
    lookup (cached, shared with Facebook) and fall back to the domain label.
    The advertiser search is fuzzy (it also returns partners/agencies), so each
    ad is tagged `match_type` "page" (advertiser name matches the brand) or
    "keyword" (related advertiser), with the competitor's own ads first.
    """
    if not settings.search_api_key:
        raise _not_configured("SearchAPI LinkedIn", "SEARCH_API_KEY")

    brand = brand_query(domain)
    page = await resolve_meta_page(domain)
    query = page.name if page and page.name else brand
    country = to_meta_country(country_code) if country_code else ""
    cache_key = (query, country)
    cached = _linkedin_cache.get(cache_key)
    if cached and cached[0] > time.monotonic():
        return [dict(ad) for ad in cached[1]]

    params: dict[str, Any] = {
        "engine": "linkedin_ad_library",
        "advertiser": query,
        "api_key": settings.search_api_key,
    }
    if country:
        params["country"] = country

    body = await _get_json("SearchAPI LinkedIn", SEARCHAPI_BASE, params, request_timeout=60)

    own_names = {_normalise_name(brand), _normalise_name(query)}
    ads: list[dict[str, Any]] = []
    for raw in body.get("ads", []) or []:
        advertiser = raw.get("advertiser") or {}
        name = advertiser.get("name") if isinstance(advertiser, dict) else None
        ad = {k: v for k, v in raw.items() if k != "position"}  # provider field
        ad["match_type"] = (
            "page" if name and _normalise_name(str(name)) in own_names else "keyword"
        )
        ads.append(ad)

    ads.sort(key=lambda a: a["match_type"] != "page")  # own ads first, stable
    _linkedin_cache[cache_key] = (time.monotonic() + LINKEDIN_CACHE_TTL_S, ads)
    return [dict(ad) for ad in ads]
