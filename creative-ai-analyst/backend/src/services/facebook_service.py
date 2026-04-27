import asyncio
from typing import Any

import httpx

from src.config import settings

FB_GRAPH_BASE = "https://graph.facebook.com/v21.0"

AD_PREVIEW_FORMATS = [
    "MOBILE_FEED_STANDARD",
    "MARKETPLACE_MOBILE",
    "RIGHT_COLUMN_STANDARD",
    "FACEBOOK_STORY_MOBILE",
    "INSTANT_ARTICLE_STANDARD",
]


class FacebookError(Exception):
    """Raised when a Facebook Graph call fails."""


async def fetch_ad_previews(
    ad_id: str, access_token: str
) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30) as client:
        results: list[dict[str, Any]] = []
        for ad_format in AD_PREVIEW_FORMATS:
            url = f"{FB_GRAPH_BASE}/{ad_id}/previews"
            params = {"ad_format": ad_format, "access_token": access_token}
            try:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                body = resp.json()
                preview_list = body.get("data") or []
                preview = preview_list[0] if preview_list else None
                results.append(
                    {"ad_format": ad_format, "preview": preview, "error": None}
                )
            except httpx.HTTPError as exc:
                results.append(
                    {
                        "ad_format": ad_format,
                        "preview": None,
                        "error": str(exc),
                    }
                )
        return results


async def fetch_ad_previews_for_ads(
    ad_ids: list[str],
) -> dict[str, list[dict[str, Any]]]:
    """Fetch FB ad previews for many ad ids. Returns {ad_id: [preview, ...]}"""
    if not settings.fb_access_token:
        raise FacebookError("FB_ACCESS_TOKEN is not configured")

    tasks = [fetch_ad_previews(ad_id, settings.fb_access_token) for ad_id in ad_ids]
    results = await asyncio.gather(*tasks, return_exceptions=False)
    return dict(zip(ad_ids, results, strict=True))
