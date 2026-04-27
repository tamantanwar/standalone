import asyncio
import base64
import io
import json
import zipfile
from typing import Any

import httpx

from src.services.bigquery_service import query
from src.services.gcs_service import download_file as gcs_download_file
from src.services.gcs_service import upload_image as gcs_upload_image
from src.services.gemini_service import audit_video
from src.services.openai_service import get_openai_client


CREATIVE_AI_TABLE = "generative-ai-418805.elt_meta_ads.creative_ai"
GCS_PUBLIC_HOST = "storage.googleapis.com/kedet-ad-images"
OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits"


def extract_ad_details(ad_name: str | None) -> dict[str, Any]:
    if not ad_name:
        return {}

    if " - " in ad_name:
        parts = ad_name.split(" - ")
    elif "_" in ad_name:
        parts = ad_name.split("_")
    else:
        parts = [ad_name]

    parts = [p.strip() for p in parts]

    def _get(idx: int) -> str | None:
        if idx >= len(parts):
            return None
        return parts[idx] or None

    return {
        "campaign_name": _get(0),
        "channel_name": _get(1),
        "location": _get(2),
        "audience": _get(3),
        "promotion": _get(4),
        "devices": _get(5),
        "ad_type": _get(6),
        "ad_name": parts[7] if len(parts) > 7 else ad_name,
    }


async def fetch_accounts() -> list[str]:
    sql = (
        f"SELECT DISTINCT account_name FROM `{CREATIVE_AI_TABLE}` "
        "WHERE account_name IS NOT NULL AND account_name != 'null'"
    )
    rows = await query(sql)
    return [r["account_name"] for r in rows if r.get("account_name")]


async def fetch_campaign_objectives(account_name: str) -> list[str]:
    sql = (
        "SELECT DISTINCT campaign_objective "
        f"FROM `{CREATIVE_AI_TABLE}` "
        "WHERE campaign_objective IS NOT NULL "
        "AND campaign_objective != 'null' "
        "AND account_name = @accountName"
    )
    rows = await query(sql, params={"accountName": account_name})
    return [r["campaign_objective"] for r in rows if r.get("campaign_objective")]


def _safe_div(num: float, denom: float) -> float:
    if not denom:
        return 0.0
    return num / denom


def _enrich_metrics(rows: list[dict[str, Any]], objective: str) -> None:
    if objective == "LINK_CLICKS":
        for row in rows:
            impressions = row.get("impressions") or 0
            clicks = row.get("clicks") or 0
            spend = row.get("spend") or 0
            row["CTR"] = round(_safe_div(clicks, impressions), 2)
            row["CPC"] = round(_safe_div(spend, clicks), 2)
            row["Clicks"] = clicks
    elif objective in {"OUTCOME_SALES", "OUTCOME_CONVERSIONS"}:
        for row in rows:
            spend = row.get("spend") or 0
            action_value = row.get("action_value_purchase") or 0
            action_purchase = row.get("action_purchase") or 0
            row["ROAS"] = round(_safe_div(action_value, spend) * 100, 2)
            row["CPA"] = round(_safe_div(spend, action_purchase), 2)
            row["total_revenue"] = action_value


def _rank(
    rows: list[dict[str, Any]],
    metric: str,
    ranking_type: str,
) -> list[dict[str, Any]]:
    if not rows or metric not in rows[0]:
        return rows

    if metric == "CPA" and ranking_type == "best":
        rows = [r for r in rows if (r.get("CPA") or 0) > 0]

    ascending = (
        ranking_type == "best" if metric == "CPA" else ranking_type == "least"
    )

    rows.sort(
        key=lambda r: r.get(metric, 0) or 0,
        reverse=not ascending,
    )
    return rows


async def fetch_ads(
    *,
    account_name: str,
    objective: str,
    ranking_metric: str | None,
    ranking_type: str | None,
    ads_with_title: bool,
    location: str | None,
    promotion: str | None,
) -> dict[str, Any]:
    sql = (
        "SELECT * "
        f"FROM `{CREATIVE_AI_TABLE}` "
        "WHERE campaign_objective = @objective "
        "AND account_name = @accountName"
    )
    rows = await query(
        sql,
        params={"objective": objective, "accountName": account_name},
    )

    enriched: list[dict[str, Any]] = []
    for row in rows:
        details = extract_ad_details(row.get("ad_name"))
        new_row: dict[str, Any] = {**row, **details}
        new_row["image_url"] = row.get("display_image_url") or row.get("image_url")
        enriched.append(new_row)

    if ads_with_title:
        enriched = [
            r
            for r in enriched
            if (r.get("title") or "").strip() and (r.get("body") or "").strip()
        ]

    _enrich_metrics(enriched, objective)

    if ranking_metric:
        enriched = _rank(enriched, ranking_metric, ranking_type or "best")

    locations = sorted({r["location"] for r in enriched if r.get("location")})
    promotions = sorted({r["promotion"] for r in enriched if r.get("promotion")})

    if location:
        enriched = [r for r in enriched if r.get("location") == location]
    if promotion:
        enriched = [r for r in enriched if r.get("promotion") == promotion]

    return {
        "ads": enriched[:10],
        "locations": locations,
        "promotions": promotions,
    }


async def generate_ai_ads(
    *,
    ads: list[dict[str, Any]],
    objective: str,
    location: str | None,
    promotion: str | None,
) -> list[dict[str, Any]]:
    best = [
        a
        for a in ads
        if (a.get("title") or "").strip() and (a.get("body") or "").strip()
    ]
    if not best:
        raise ValueError("No valid ads with title and body provided.")

    historical_titles = ", ".join(a["title"] for a in best)
    historical_bodies = ", ".join(a["body"] for a in best)

    prompt = (
        f"Based on these best-performing ad titles: {historical_titles}\n"
        f"And these best-performing ad bodies: {historical_bodies}\n\n"
        "Generate exactly 5 ad variations, each following these rules:\n"
        '- Each variation must be an object containing the keys: "title", "body", and "score".\n'
        "- Title (headline) must be 27 characters or less.\n"
        "- Description (body) must be 27 characters or less.\n"
        f"- Ensure each variation aligns with {objective}.\n"
        f"- If provided, include location: {location or 'N/A'} and promotion: {promotion or 'N/A'}.\n"
        "- Rank each ad variation with a score out of 100 based on expected performance.\n"
        "- Ad copy must be concise, engaging, and compelling while following the character limits.\n"
        "- Return ONLY a valid JSON array of objects, with no surrounding text or markdown."
    )

    openai = get_openai_client()
    completion = await openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        response_format={"type": "json_object"},
    )

    raw = completion.choices[0].message.content or ""
    parsed: Any
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse AI response: {exc}") from exc

    # Some responses come back as { "ads": [...] } when JSON object mode is on.
    # Normalize to list.
    if isinstance(parsed, dict):
        for value in parsed.values():
            if isinstance(value, list):
                parsed = value
                break
    if not isinstance(parsed, list):
        raise ValueError("AI response is not a list of ad variations.")

    formatted: list[dict[str, Any]] = []
    for idx, ad in enumerate(parsed, start=1):
        if not isinstance(ad, dict):
            continue
        title = (ad.get("title") or "").strip()
        body = (ad.get("body") or "").strip()
        score = ad.get("score")
        formatted.append(
            {
                "title": title or f"Error in AI-generated ad {idx}",
                "body": body or f"Error in AI-generated ad {idx}",
                "score": f"{score}/100" if score is not None else "N/A",
            }
        )

    return formatted


# ===========================================================================
# Image generation/editing — gpt-image-1
# ===========================================================================


async def _download_image_bytes(
    url: str, *, timeout: float = 30.0
) -> tuple[bytes, str]:
    """
    Returns (bytes, content_type). For GCS URLs, uses authenticated SDK
    download. For Facebook CDN URLs, mimics the original axios call with
    curl-like headers. Otherwise plain GET.
    """
    if GCS_PUBLIC_HOST in url:
        parts = url.split(f"{GCS_PUBLIC_HOST}/")
        if len(parts) > 1:
            file_path = parts[1]
            data = await gcs_download_file(file_path)
            content_type = "image/jpeg"
            if file_path.endswith(".png"):
                content_type = "image/png"
            elif file_path.endswith(".webp"):
                content_type = "image/webp"
            elif file_path.endswith(".gif"):
                content_type = "image/gif"
            return data, content_type

    if "fbcdn.net" in url:
        headers = {"User-Agent": "curl/7.68.0", "Accept": "*/*"}
        async with httpx.AsyncClient(
            timeout=timeout, follow_redirects=True, verify=False
        ) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "image/jpeg")
            return resp.content, content_type

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "image/*",
    }
    async with httpx.AsyncClient(
        timeout=timeout, follow_redirects=True
    ) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/jpeg")
        return resp.content, content_type


def _ext_from_content_type(content_type: str, fallback_url: str = "") -> str:
    if content_type and content_type != "application/octet-stream":
        return content_type.split("/")[-1]
    if fallback_url.endswith((".jpg", ".jpeg")):
        return "jpeg"
    if fallback_url.endswith(".png"):
        return "png"
    if fallback_url.endswith(".webp"):
        return "webp"
    return "png"


async def _openai_image_edit(
    *,
    image_bytes: bytes,
    image_filename: str,
    image_content_type: str,
    prompt: str,
    size: str,
    api_key: str,
) -> str:
    """POST to OpenAI's /v1/images/edits, return the base64 image string."""
    files = {"image": (image_filename, image_bytes, image_content_type)}
    data = {"prompt": prompt, "model": "gpt-image-1", "size": size}
    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            OPENAI_IMAGE_EDITS_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            files=files,
            data=data,
        )
        resp.raise_for_status()
        body = resp.json()
    return body["data"][0]["b64_json"]


async def _update_stored_image_url(
    ad_id: str, account_name: str, gcs_url: str
) -> None:
    """UPDATE the creative_ai BQ table with the new stored_image_url."""
    sql = (
        f"UPDATE `{CREATIVE_AI_TABLE}` "
        "SET stored_image_url = @gcsUrl "
        "WHERE ad_id = @adId AND account_name = @accountName"
    )
    try:
        await query(
            sql,
            params={
                "gcsUrl": gcs_url,
                "adId": ad_id,
                "accountName": account_name,
            },
        )
    except Exception as exc:
        # Same as original — log but don't fail the request
        print(f"Failed to update stored_image_url: {exc}")


async def generate_variant(
    *,
    image_urls: list[str],
    prompt: str | None,
    account_name: str,
    ad_id: str | None,
) -> list[dict[str, Any]]:
    if not image_urls:
        raise ValueError("Array of image URLs is required")
    if not account_name:
        raise ValueError("Account name is required for storage")

    from src.config import settings

    api_key = settings.openai_api_key
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    final_prompt = prompt or "Generate a variant of this image"
    results: list[dict[str, Any]] = []

    for image_url in image_urls:
        try:
            image_bytes, content_type = await _download_image_bytes(image_url)
            extension = _ext_from_content_type(content_type, image_url)
            b64_image = await _openai_image_edit(
                image_bytes=image_bytes,
                image_filename=f"input.{extension}",
                image_content_type=content_type,
                prompt=final_prompt,
                size="1536x1024",
                api_key=api_key,
            )

            gcs_url: str | None = None
            try:
                upload_result = await gcs_upload_image(
                    b64_image,
                    account_name,
                    f"variant-{int(asyncio.get_event_loop().time() * 1000)}.png",
                    content_type="image/png",
                    metadata={
                        "originalUrl": image_url,
                        "operation": "generateVariant",
                        "adId": ad_id or "unknown",
                        "prompt": prompt or "",
                    },
                )
                gcs_url = upload_result["publicUrl"]

                if ad_id and gcs_url:
                    await _update_stored_image_url(ad_id, account_name, gcs_url)
            except Exception as exc:
                print(f"Failed to upload to GCS: {exc}")

            results.append(
                {
                    "imageUrl": image_url,
                    "image": b64_image,
                    "operation": "generateNewVariant",
                    "gcsUrl": gcs_url,
                }
            )
        except Exception as exc:
            results.append(
                {
                    "imageUrl": image_url,
                    "error": f"Failed to generate variant: {exc}",
                    "operation": "generateNewVariant",
                }
            )

    return results


async def edit_image(
    *,
    image_urls: list[str],
    prompt: str,
    account_name: str,
    ad_id: str | None,
) -> list[dict[str, Any]]:
    if not image_urls:
        raise ValueError("Array of image URLs is required")
    if not account_name:
        raise ValueError("Account name is required for storage")

    from src.config import settings

    api_key = settings.openai_api_key
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    supported = {"image/jpeg", "image/png", "image/webp"}
    results: list[dict[str, Any]] = []

    for image_url in image_urls:
        try:
            image_bytes, content_type = await _download_image_bytes(
                image_url, timeout=10.0
            )

            if not content_type or content_type == "application/octet-stream":
                if image_url.endswith((".jpg", ".jpeg")):
                    content_type = "image/jpeg"
                elif image_url.endswith(".png"):
                    content_type = "image/png"
                elif image_url.endswith(".webp"):
                    content_type = "image/webp"
                else:
                    content_type = "image/png"

            if content_type not in supported:
                results.append(
                    {
                        "imageUrl": image_url,
                        "error": (
                            f"Unsupported image format: {content_type}. "
                            "Only JPEG, PNG, and WebP are supported."
                        ),
                    }
                )
                continue

            size_mb = len(image_bytes) / (1024 * 1024)
            if size_mb > 4:
                results.append(
                    {
                        "imageUrl": image_url,
                        "error": (
                            f"Image too large ({size_mb:.2f}MB). "
                            "Maximum size is 4MB."
                        ),
                    }
                )
                continue

            extension = content_type.split("/")[-1]
            b64_image = await _openai_image_edit(
                image_bytes=image_bytes,
                image_filename=f"image.{extension}",
                image_content_type=content_type,
                prompt=prompt,
                size="1024x1024",
                api_key=api_key,
            )

            gcs_url: str | None = None
            try:
                upload_result = await gcs_upload_image(
                    b64_image,
                    account_name,
                    f"edited-{int(asyncio.get_event_loop().time() * 1000)}.png",
                    content_type="image/png",
                    metadata={
                        "originalUrl": image_url,
                        "operation": "editImage",
                        "adId": ad_id or "unknown",
                        "prompt": prompt,
                    },
                )
                gcs_url = upload_result["publicUrl"]

                if ad_id and gcs_url:
                    await _update_stored_image_url(ad_id, account_name, gcs_url)
            except Exception as exc:
                print(f"Failed to upload to GCS: {exc}")

            results.append(
                {
                    "imageUrl": image_url,
                    "image": b64_image,
                    "prompt": prompt,
                    "operation": "editImage",
                    "gcsUrl": gcs_url,
                }
            )
        except httpx.HTTPStatusError as exc:
            error_message = "Failed to process image"
            try:
                error_body = exc.response.json()
                error_message = error_body.get("error", {}).get(
                    "message", error_message
                )
            except Exception:
                pass
            results.append(
                {
                    "imageUrl": image_url,
                    "error": error_message,
                    "operation": "editImage",
                }
            )
        except Exception as exc:
            results.append(
                {
                    "imageUrl": image_url,
                    "error": str(exc),
                    "operation": "editImage",
                }
            )

    return results


# ===========================================================================
# Audit (image with GPT-4o vision, video with Gemini)
# ===========================================================================


_AUDIT_SYSTEM_PROMPT = """You are a highly analytical and experienced creative strategist and ad auditor. Your task is to provide a comprehensive visual and textual audit of the provided ad creative.
Output your analysis in a structured JSON format. DO NOT include any text outside of the JSON.
The JSON must contain the following keys:
{
  "overallVisualScore": number (out of 10, decimal allowed, indicating overall visual effectiveness),
  "visualSummary": string (a concise summary of the visual ad),
  "visualAnalysisSections": array of objects (each object represents a category of analysis),
  "overallVisualEffectiveness": object (containing strengths, areas for improvement, predictions, resonance),
  "visualConclusion": string (overall concluding remarks about the visual creative)
}

Each object in "visualAnalysisSections" should have:
{
  "title": string (e.g., "Imagery & Composition", "Color & Lighting", "Text Overlays", "Branding"),
  "category": string (e.g., "imagery_composition", "color_lighting", "text_overlays", "branding"),
  "items": array of objects (detailed analysis points within the category)
}

Each item in "items" should have:
{
  "name": string (e.g., "Subject Matter", "Background/Scene", "Headline Text", "Call to Action Text", "Logo Text", "Color Scheme", "Logo Placement"),
  "analysis": string (detailed analysis of this specific item),
  "sentiment": string ("positive", "neutral", "negative"),
  "metrics": object (optional, include quantifiable visual/textual metrics like "dominantColors" [array of HEX codes], "colorHarmonyScore" [0-1], "averageContrastRatio" [number], "readabilityScore" [number], "fontSizeEstimate": string, "fontColor": string, "fontFamilyEstimate": string, "logoVisibilityScore" [0-1], "logoAreaRatio" [0-1]).
  "detectedElements": array of objects (optional, include detected objects or text with bounding boxes and attributes). Each object:
    {"label": string, "text_content": string (if text detected), "box": [x1, y1, x2, y2] (relative coordinates 0-1, top-left then bottom-right), "confidence": number (0-1), "attributes": object (e.g., {"emotion": "joy", "gender": "male", "age_group": "adult", "is_bold": boolean, "is_uppercase": boolean})}
}
If 'text_content' is present for a detected element, provide inferred 'fontSizeEstimate', 'fontColor', 'fontFamilyEstimate' in its parent 'metrics' object as well.

"overallVisualEffectiveness" should contain:
{
  "strengths": array of strings (list bullet points of visual/textual strengths),
  "areasForVisualImprovement": array of strings (list bullet points of visual/textual areas for improvement),
  "abTestSuggestionsVisual": array of objects (concrete visual/textual A/B test ideas),
  "predictedVisualPerformance": object (predictions related to visual impact - e.g., "visualEngagementScore": number [0-10], "visualMemorabilityScore": number [0-10], "benchmarkComparison": string),
  "targetAudienceVisualFit": object (scores for how well the visual and on-creative text fits specific personas - e.g., "familiesWithYoungChildren": number [0-10])
}

For "abTestSuggestionsVisual", each object should have:
{"type": string (e.g., "image_variant", "color_filter", "logo_size", "text_font", "text_color", "text_position", "headline_change"), "suggestion": string (a natural language suggestion for the prompt to generate this variant, e.g., "Apply a warmer filter to this image.", "Change the headline text to 'Ski Season Blowout Sale!'.")}

Analyze all visual elements and any text that is *present within the image itself*. Provide bounding box coordinates for all detected objects and text.
Consider the typical goal of an ad creative to be visually appealing, attention-grabbing, and relevant to its implied product/service.
If the user provides an additional 'prompt', incorporate it into the detailed analysis where relevant."""


async def audit_creative(
    *,
    image_urls: list[str],
    video_urls: list[str],
    prompt: str | None,
) -> list[dict[str, Any]]:
    if not image_urls and not video_urls:
        raise ValueError("An array of image URLs or video URLs is required")

    openai = get_openai_client()
    results: list[dict[str, Any]] = []

    for image_url in image_urls:
        try:
            image_bytes, content_type = await _download_image_bytes(
                image_url, timeout=30.0
            )
            b64 = base64.b64encode(image_bytes).decode("ascii")
            data_url = f"data:{content_type};base64,{b64}"

            user_prompt = (
                "Perform a comprehensive audit of this ad creative image. "
                "Analyze imagery, composition, color, lighting, branding, and "
                "all visible text. Provide quantifiable metrics, bounding boxes "
                "for detected elements and text, and actionable suggestions."
            )
            if prompt:
                user_prompt += f" Additional context: {prompt}"

            completion = await openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": _AUDIT_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": data_url},
                            },
                        ],
                    },
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
            )

            raw = completion.choices[0].message.content or "{}"
            try:
                audit_data = json.loads(raw)
            except json.JSONDecodeError:
                audit_data = {
                    "error": "Failed to parse AI audit response.",
                    "rawContent": raw,
                }

            results.append(
                {
                    "imageUrl": image_url,
                    "result": audit_data,
                    "operation": "auditOnly",
                }
            )
        except Exception as exc:
            suggestion = ""
            if "fbcdn.net" in image_url:
                suggestion = (
                    "Facebook image URLs expire quickly and are IP-restricted. "
                    "If your ETL pipeline stores images in GCS, use the stored "
                    "image URL instead."
                )
            results.append(
                {
                    "imageUrl": image_url,
                    "error": str(exc),
                    "operation": "auditOnly",
                    **({"suggestion": suggestion} if suggestion else {}),
                }
            )

    for video_url in video_urls:
        try:
            audit_data = await audit_video(video_url, prompt)
            results.append(
                {
                    "videoUrl": video_url,
                    "result": audit_data,
                    "operation": "auditOnly",
                }
            )
        except Exception as exc:
            results.append(
                {
                    "videoUrl": video_url,
                    "error": f"Failed to process video: {exc}",
                    "operation": "auditOnly",
                }
            )

    return results


# ===========================================================================
# Compare two images (GPT-4o vision)
# ===========================================================================


_COMPARE_SYSTEM_PROMPT = """You are a professional creative strategist and ad auditor specialized in visual and textual comparison.
Compare the visual and all on-creative textual aspects of the two provided ad creatives. Focus on imagery, composition, color, lighting, branding elements, and all visible text.
Output your analysis in a structured JSON format. DO NOT include any text outside of the JSON.
The JSON must contain:
{
  "comparisonSummary": string,
  "visualSimilarities": array of strings,
  "visualDifferences": array of strings,
  "image1Analysis": object (structured analysis of image 1, similar to single audit output structure, including text),
  "image2Analysis": object (structured analysis of image 2, similar to single audit output structure, including text),
  "recommendation": string (which creative is stronger and why, based on visual and textual aspects),
  "abTestSuggestionsVisual": array of objects (new visual/textual A/B test ideas based on the comparison).
}"""


async def compare_creatives(
    *,
    image_urls: list[str],
    prompt: str | None,
) -> list[dict[str, Any]]:
    if not image_urls or len(image_urls) != 2:
        raise ValueError("Exactly two image URLs are required for comparison")

    openai = get_openai_client()
    results: list[dict[str, Any]] = []

    try:
        data_urls: list[str] = []
        for image_url in image_urls:
            try:
                image_bytes, content_type = await _download_image_bytes(
                    image_url, timeout=30.0
                )
                b64 = base64.b64encode(image_bytes).decode("ascii")
                data_urls.append(f"data:{content_type};base64,{b64}")
            except Exception:
                # If download fails, fall back to the original URL (matches
                # the JS implementation's behaviour).
                data_urls.append(image_url)

        user_prompt = (
            "Compare these two ad creatives visually and based on their "
            "on-creative text."
        )
        if prompt:
            user_prompt += f" Additional context: {prompt}"

        completion = await openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _COMPARE_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": data_urls[0]},
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": data_urls[1]},
                        },
                    ],
                },
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        raw = completion.choices[0].message.content or "{}"
        try:
            comparison = json.loads(raw)
        except json.JSONDecodeError:
            comparison = {
                "error": "Failed to parse AI comparison response.",
                "rawContent": raw,
            }

        results.append(
            {
                "result": comparison,
                "operation": "compare",
                "imageUrls": image_urls,
            }
        )
    except Exception as exc:
        results.append(
            {
                "imageUrl": ", ".join(image_urls),
                "error": str(exc),
                "operation": "compare",
            }
        )

    return results


# ===========================================================================
# NL prompt router (process-prompt) and zip download
# ===========================================================================


def determine_action(prompt: str) -> str | None:
    lower = prompt.lower()
    if "new variant" in lower:
        return "generate-variant"
    if "edit image" in lower or "edit" in lower:
        return "edit-image"
    if "audit" in lower or "suggest" in lower:
        return "audit"
    if "compare" in lower:
        return "compare"
    return None


async def build_zip_of_images(image_urls: list[str]) -> bytes:
    if not image_urls:
        raise ValueError("imageUrls must be a non-empty array")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for index, url in enumerate(image_urls, start=1):
            try:
                async with httpx.AsyncClient(
                    timeout=60, follow_redirects=True
                ) as client:
                    resp = await client.get(url)
                    resp.raise_for_status()
                zf.writestr(f"image_{index}.jpg", resp.content)
            except Exception as exc:
                zf.writestr(
                    f"error_{index}.txt", f"Failed to download {url}: {exc}"
                )

    buffer.seek(0)
    return buffer.read()
