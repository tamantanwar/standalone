from typing import Any

from fastapi import APIRouter, HTTPException, Query

from src.services.competitive_analysis_service import (
    CompetitiveAnalysisError,
    fetch_domain_stats,
    fetch_facebook_ad_creatives,
    fetch_google_ad_creatives,
    fetch_ppc_competitors,
)

router = APIRouter(prefix="/competitive-analysis", tags=["competitive-analysis"])


@router.get("/competitors")
async def get_competitors(
    domain: str = Query(..., min_length=1),
    countryCode: str = Query(..., min_length=2, max_length=4),  # noqa: N803
    timePeriod: int = Query(1, ge=1, le=24),  # noqa: N803
) -> dict[str, list[dict[str, Any]]]:
    try:
        competitors = await fetch_ppc_competitors(domain, countryCode)
    except CompetitiveAnalysisError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    stats_data: list[dict[str, Any]] = []
    for comp in competitors:
        comp_domain = comp.get("domain")
        if not comp_domain:
            continue
        try:
            comp_data = await fetch_domain_stats(
                comp_domain, countryCode, timePeriod
            )
        except CompetitiveAnalysisError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        for month_data in comp_data:
            month_data["domain"] = comp_domain
        stats_data.extend(comp_data)

    return {"competitors": competitors, "statsData": stats_data}


@router.get("/adCreatives")
async def get_ad_creatives(
    domain: str = Query(..., min_length=1),
    adSource: str = Query(..., pattern="^(Google|Facebook)$"),  # noqa: N803
    countryCode: str | None = Query(None),  # noqa: N803
) -> dict[str, list[dict[str, Any]]]:
    try:
        if adSource == "Google":
            creatives = await fetch_google_ad_creatives(domain)
        else:
            if not countryCode:
                raise HTTPException(
                    status_code=400,
                    detail="countryCode is required for Facebook ads",
                )
            creatives = await fetch_facebook_ad_creatives(domain, countryCode)
    except CompetitiveAnalysisError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"adCreatives": creatives}
