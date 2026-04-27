from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict

from src.services.creative_ai_service import (
    _download_image_bytes,
    audit_creative,
    build_zip_of_images,
    compare_creatives,
    determine_action,
    edit_image,
    fetch_accounts,
    fetch_ads,
    fetch_campaign_objectives,
    generate_ai_ads,
    generate_variant,
)
from src.services.facebook_service import (
    FacebookError,
    fetch_ad_previews_for_ads,
)

router = APIRouter(prefix="/creative-ai", tags=["creative-ai"])


# ---------- accounts ----------


@router.get("/accounts", response_model=list[str])
async def list_accounts() -> list[str]:
    try:
        return await fetch_accounts()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------- campaign objectives ----------


@router.get("/campaign-objectives", response_model=list[str])
async def list_campaign_objectives(
    accountName: str = Query(..., min_length=1),  # noqa: N803
) -> list[str]:
    try:
        return await fetch_campaign_objectives(accountName)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------- ads ----------


class AdsResponse(BaseModel):
    ads: list[dict[str, Any]]
    locations: list[str]
    promotions: list[str]


@router.get("/ads", response_model=AdsResponse)
async def list_ads(
    accountName: str = Query(..., min_length=1),  # noqa: N803
    objective: str = Query(..., min_length=1),
    rankingMetric: str | None = Query(None),  # noqa: N803
    rankingType: str | None = Query(None),  # noqa: N803
    adsWithTitle: bool = Query(False),  # noqa: N803
    location: str | None = Query(None),
    promotion: str | None = Query(None),
) -> AdsResponse:
    try:
        result = await fetch_ads(
            account_name=accountName,
            objective=objective,
            ranking_metric=rankingMetric,
            ranking_type=rankingType,
            ads_with_title=adsWithTitle,
            location=location,
            promotion=promotion,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return AdsResponse(**result)


# ---------- ad preview ----------


class AdPreviewItem(BaseModel):
    ad_id: str


class AdPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ads: list[AdPreviewItem]


@router.post("/ad-preview")
async def ad_preview(
    request: AdPreviewRequest,
) -> dict[str, list[dict[str, Any]]]:
    if not request.ads:
        raise HTTPException(
            status_code=400,
            detail="ads must be a non-empty array of objects with ad_id",
        )

    ad_ids = [item.ad_id for item in request.ads if item.ad_id]
    if not ad_ids:
        raise HTTPException(status_code=400, detail="No valid ad_ids provided")

    try:
        return await fetch_ad_previews_for_ads(ad_ids)
    except FacebookError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# ---------- generate AI ads ----------


class GenerateAiAdsRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    ads: list[dict[str, Any]]
    objective: str
    location: str | None = None
    promotion: str | None = None


class GenerateAiAdsResponse(BaseModel):
    ai_ads: list[dict[str, Any]]


@router.post("/generate-ai-ads", response_model=GenerateAiAdsResponse)
async def generate_ai_ads_route(
    request: GenerateAiAdsRequest,
) -> GenerateAiAdsResponse:
    try:
        ai_ads = await generate_ai_ads(
            ads=request.ads,
            objective=request.objective,
            location=request.location,
            promotion=request.promotion,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return GenerateAiAdsResponse(ai_ads=ai_ads)


# ---------- generate variant (gpt-image-2) ----------


class GenerateVariantRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    imageUrls: list[str]  # noqa: N815
    prompt: str | None = None
    accountName: str  # noqa: N815
    adId: str | None = None  # noqa: N815


@router.post("/generate-variant")
async def generate_variant_route(
    request: GenerateVariantRequest,
) -> dict[str, list[dict[str, Any]]]:
    try:
        results = await generate_variant(
            image_urls=request.imageUrls,
            prompt=request.prompt,
            account_name=request.accountName,
            ad_id=request.adId,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"results": results}


# ---------- edit image (gpt-image-2) ----------


class EditImageRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    imageUrls: list[str]  # noqa: N815
    prompt: str
    accountName: str  # noqa: N815
    adId: str | None = None  # noqa: N815


@router.post("/edit-image")
async def edit_image_route(
    request: EditImageRequest,
) -> dict[str, list[dict[str, Any]]]:
    try:
        results = await edit_image(
            image_urls=request.imageUrls,
            prompt=request.prompt,
            account_name=request.accountName,
            ad_id=request.adId,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"results": results}


# ---------- audit (GPT-5.4 for images, Gemini for video) ----------


class AuditRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    imageUrls: list[str] = []  # noqa: N815
    videoUrls: list[str] = []  # noqa: N815
    prompt: str | None = None
    adIds: list[str] | None = None  # noqa: N815


@router.post("/audit")
async def audit_route(
    request: AuditRequest,
) -> dict[str, list[dict[str, Any]]]:
    try:
        results = await audit_creative(
            image_urls=request.imageUrls,
            video_urls=request.videoUrls,
            prompt=request.prompt,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"results": results}


# ---------- compare two creatives ----------


class CompareRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    imageUrls: list[str]  # noqa: N815
    prompt: str | None = None


@router.post("/compare")
async def compare_route(
    request: CompareRequest,
) -> dict[str, list[dict[str, Any]]]:
    try:
        results = await compare_creatives(
            image_urls=request.imageUrls, prompt=request.prompt
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"results": results}


# ---------- NL prompt router ----------


class ProcessPromptRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    prompt: str
    imageUrls: list[str] = []  # noqa: N815
    videoUrls: list[str] = []  # noqa: N815
    accountName: str | None = None  # noqa: N815
    adId: str | None = None  # noqa: N815


@router.post("/process-prompt")
async def process_prompt_route(
    request: ProcessPromptRequest,
) -> dict[str, Any]:
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    action = determine_action(request.prompt)
    if not action:
        raise HTTPException(
            status_code=400,
            detail="Could not determine action from prompt",
        )

    try:
        if action == "generate-variant":
            if not request.accountName:
                raise HTTPException(
                    status_code=400,
                    detail="accountName is required for generate-variant",
                )
            results = await generate_variant(
                image_urls=request.imageUrls,
                prompt=request.prompt,
                account_name=request.accountName,
                ad_id=request.adId,
            )
            return {"action": action, "results": results}
        if action == "edit-image":
            if not request.accountName:
                raise HTTPException(
                    status_code=400,
                    detail="accountName is required for edit-image",
                )
            results = await edit_image(
                image_urls=request.imageUrls,
                prompt=request.prompt,
                account_name=request.accountName,
                ad_id=request.adId,
            )
            return {"action": action, "results": results}
        if action == "audit":
            results = await audit_creative(
                image_urls=request.imageUrls,
                video_urls=request.videoUrls,
                prompt=request.prompt,
            )
            return {"action": action, "results": results}
        if action == "compare":
            results = await compare_creatives(
                image_urls=request.imageUrls,
                prompt=request.prompt,
            )
            return {"action": action, "results": results}
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    raise HTTPException(status_code=400, detail="Unhandled action")


# ---------- download images as ZIP ----------


class DownloadImagesRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    imageUrls: list[str]  # noqa: N815


@router.post("/download-images")
async def download_images_route(request: DownloadImagesRequest) -> Response:
    if not request.imageUrls:
        raise HTTPException(
            status_code=400, detail="imageUrls must be a non-empty array."
        )
    try:
        zip_bytes = await build_zip_of_images(request.imageUrls)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=ad_preview_images.zip"
        },
    )


# ---------- image proxy (browser-friendly fetch for GCS / fbcdn URLs) ----------


@router.get("/image-proxy")
async def image_proxy(url: str = Query(..., min_length=1)) -> Response:
    """
    Proxy an ad-creative image so the frontend can render it without the
    browser needing public GCS read access or the fbcdn referer/IP allowlist.
    Reuses the same download path used by audit/variant/edit.
    """
    try:
        image_bytes, content_type = await _download_image_bytes(url, timeout=30.0)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return Response(
        content=image_bytes,
        media_type=content_type or "image/jpeg",
        headers={"Cache-Control": "private, max-age=600"},
    )
