from typing import Any

import httpx

from src.config import settings

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


class CompetitiveAnalysisError(Exception):
    """Raised when an upstream API call fails."""


def _clean_domain(domain: str) -> str:
    return (
        domain.strip()
        .replace("https://", "")
        .replace("http://", "")
        .replace("www.", "")
        .rstrip("/")
    )


async def fetch_ppc_competitors(
    domain: str, country_code: str
) -> list[dict[str, Any]]:
    if not settings.spyfu_api_key:
        raise CompetitiveAnalysisError("SPYFU_API_KEY is not configured")

    cleaned = _clean_domain(domain)
    url = f"{SPYFU_BASE}/competitors_api/v2/ppc/getTopCompetitors"
    params: dict[str, Any] = {
        "domain": cleaned,
        "startingRow": 1,
        "pageSize": 5,
        "countryCode": country_code,
        "api_key": settings.spyfu_api_key,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise CompetitiveAnalysisError(
                f"SpyFu PPC competitors request failed: {exc}"
            ) from exc

    body = resp.json()
    return body.get("results", []) or []


async def fetch_domain_stats(
    domain: str, country_code: str, time_period: int
) -> list[dict[str, Any]]:
    if not settings.spyfu_api_key:
        raise CompetitiveAnalysisError("SPYFU_API_KEY is not configured")

    url = f"{SPYFU_BASE}/domain_stats_api/v2/getAllDomainStats"
    params: dict[str, Any] = {
        "domain": domain,
        "countryCode": country_code,
        "api_key": settings.spyfu_api_key,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise CompetitiveAnalysisError(
                f"SpyFu domain stats request failed: {exc}"
            ) from exc

    body = resp.json()
    results: list[dict[str, Any]] = body.get("results", []) or []
    if time_period and time_period > 0:
        results = results[-time_period:]

    for entry in results:
        month = entry.get("searchMonth")
        if isinstance(month, int):
            entry["searchMonth"] = MONTH_MAP.get(month, str(month))

    return results


async def fetch_google_ad_creatives(domain: str) -> list[dict[str, Any]]:
    if not settings.serpapi_key:
        raise CompetitiveAnalysisError("SERPAPI_KEY is not configured")

    params: dict[str, Any] = {
        "engine": "google_ads_transparency_center",
        "text": domain,
        "api_key": settings.serpapi_key,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.get(SERPAPI_BASE, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise CompetitiveAnalysisError(
                f"SerpAPI request failed: {exc}"
            ) from exc

    body = resp.json()
    return body.get("ad_creatives", []) or []


async def fetch_facebook_ad_creatives(
    domain: str, country_code: str
) -> list[dict[str, Any]]:
    if not settings.fb_access_token:
        raise CompetitiveAnalysisError("FB_ACCESS_TOKEN is not configured")

    url = f"{FB_GRAPH_BASE}/ads_archive"
    params: dict[str, Any] = {
        "ad_reached_countries": country_code,
        "search_terms": domain,
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
    }

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise CompetitiveAnalysisError(
                f"Facebook Ads Library request failed: {exc}"
            ) from exc

    body = resp.json()
    return body.get("data", []) or []
