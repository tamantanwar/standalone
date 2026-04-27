import asyncio
import time
from typing import Any

import httpx

from src.config import settings

GEMINI_UPLOAD_URL = (
    "https://generativelanguage.googleapis.com/upload/v1beta/files"
)
GEMINI_MODEL_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)
GEMINI_FILES_URL = "https://generativelanguage.googleapis.com/v1beta/files"


def _key() -> str:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return settings.gemini_api_key


async def upload_video(video_bytes: bytes, mime_type: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=120) as client:
        files = {"file": ("video", video_bytes, mime_type)}
        resp = await client.post(
            f"{GEMINI_UPLOAD_URL}?key={_key()}", files=files
        )
        resp.raise_for_status()
        return resp.json().get("file", {})


async def wait_for_file_active(
    file_id: str, max_retries: int = 10, interval_seconds: float = 2.0
) -> None:
    url = f"{GEMINI_FILES_URL}/{file_id}?key={_key()}"
    async with httpx.AsyncClient(timeout=30) as client:
        for _ in range(max_retries):
            resp = await client.get(url)
            resp.raise_for_status()
            state = resp.json().get("state")
            if state == "ACTIVE":
                return
            await asyncio.sleep(interval_seconds)
    raise RuntimeError(
        f"File {file_id} did not become ACTIVE after {max_retries} retries"
    )


async def generate_content_for_video(
    file_uri: str, mime_type: str, prompt: str | None
) -> dict[str, Any]:
    system_prompt = """You are a highly analytical and experienced creative strategist and ad auditor specializing in video content. Your task is to provide a comprehensive visual and textual audit of the provided ad video.
Output your analysis in a structured JSON format. DO NOT include any text outside of the JSON.
The JSON must contain the following keys:
{
  "overallVisualScore": number (out of 10, decimal allowed, indicating overall visual effectiveness),
  "visualSummary": string (a concise summary of the visual ad video),
  "visualAnalysisSections": array of objects (each object represents a category of analysis),
  "overallVisualEffectiveness": object (containing strengths, areas for improvement, predictions, resonance),
  "visualConclusion": string (overall concluding remarks about the visual video creative)
}

Each object in "visualAnalysisSections" should have:
{
  "title": string (e.g., "Imagery & Composition", "Pacing & Flow", "Color & Lighting", "Text Overlays", "Branding"),
  "category": string (e.g., "imagery_composition", "pacing_flow", "color_lighting", "text_overlays", "branding"),
  "items": array of objects (detailed analysis points within the category)
}

Each item in "items" should have:
{
  "name": string (e.g., "Key Scenes", "Average Shot Length", "Headline Text", "Call to Action Text", "Logo Text", "Color Palette", "Logo Visibility Over Time"),
  "analysis": string (detailed analysis of this specific item),
  "sentiment": string ("positive", "neutral", "negative"),
  "metrics": object (optional, include quantifiable visual/textual metrics like "dominantColors" [array of HEX codes], "pacing" [e.g., "fast", "moderate", "slow"], "averageShotLengthSeconds": number, "readabilityScore" [number], "fontSizeEstimate": string, "fontColor": string, "fontFamilyEstimate": string, "brandVisibilityPercentage": number [0-1]).
  "detectedElements": array of objects (optional, include detected objects or text with bounding boxes and temporal data). Each object:
    {"label": string, "text_content": string (if text detected), "box": [x1, y1, x2, y2] (relative coordinates 0-1), "confidence": number (0-1), "timestamp": string (MM:SS, indicating when the element appears), "duration": string (HH:MM:SS, for how long it's visible), "attributes": object (e.g., {"emotion": "joy", "object_action": "running", "is_bold": boolean, "is_uppercase": boolean})}
}
If 'text_content' is present for a detected element, provide inferred 'fontSizeEstimate', 'fontColor', 'fontFamilyEstimate' in its parent 'metrics' object as well.

"overallVisualEffectiveness" should contain:
{
  "strengths": array of strings (list bullet points of visual/textual strengths),
  "areasForVisualImprovement": array of strings (list bullet points of visual/textual areas for improvement),
  "abTestSuggestionsVisual": array of objects (concrete visual/textual A/B test ideas for video),
  "predictedVisualPerformance": object (predictions related to visual/textual impact - e.g., "visualEngagementScore": number [0-10], "attentionRetentionRate": string ["%"], "visualMemorabilityScore": number [0-10], "benchmarkComparison": string),
  "targetAudienceVisualFit": object (scores for how well the visual and on-creative text fits specific personas - e.g., "familiesWithYoungChildren": number [0-10])
}

For "abTestSuggestionsVisual", each object should have:
{"type": string (e.g., "video_pacing", "scene_order", "color_grading", "text_animation", "on_screen_text_change"), "suggestion": string (a natural language suggestion for the prompt to generate this variant, e.g., "Increase the pace of scenes in the first 10 seconds.", "Change the call to action text to 'Book Your Adventure Now!'", "Make the headline text bolder and white.")}

Analyze all visual elements and any text that is *present within the video frames*. Provide bounding box coordinates for all detected objects and text, including temporal information.
Consider the typical goal of an ad creative to be visually appealing, attention-grabbing, and relevant to its implied product/service.
If the user provides an additional 'prompt', incorporate it into the detailed analysis where relevant."""

    user_prompt = (
        "Perform a comprehensive audit of this ad video. Analyze imagery, composition, "
        "color, lighting, pacing, branding, and all visible text. Provide quantifiable "
        "metrics, bounding boxes for detected elements and text (with timestamps), "
        "and actionable suggestions."
    )
    if prompt:
        user_prompt += f" Additional context: {prompt}"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": system_prompt},
                    {"fileData": {"fileUri": file_uri, "mimeType": mime_type}},
                    {"text": user_prompt},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "topK": 40,
            "topP": 0.95,
            "responseMimeType": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            f"{GEMINI_MODEL_URL}?key={_key()}",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        body = resp.json()

    try:
        raw = body["candidates"][0]["content"]["parts"][0]["text"]
        import json

        return json.loads(raw)
    except (KeyError, IndexError, ValueError) as exc:
        return {
            "error": f"Failed to parse Gemini response: {exc}",
            "rawContent": body,
        }


async def audit_video(video_url: str, prompt: str | None) -> dict[str, Any]:
    """Download a video from URL, upload to Gemini, wait for ACTIVE, run audit."""
    async with httpx.AsyncClient(timeout=180, follow_redirects=True) as client:
        resp = await client.get(video_url)
        resp.raise_for_status()
        video_bytes = resp.content
        content_type = resp.headers.get("content-type", "video/mp4")

    if not content_type.startswith("video/"):
        # Fallback by extension
        if video_url.endswith(".mov"):
            content_type = "video/quicktime"
        elif video_url.endswith(".webm"):
            content_type = "video/webm"
        else:
            content_type = "video/mp4"

    file_info = await upload_video(video_bytes, content_type)
    file_uri: str = file_info.get("uri", "")
    gemini_mime_type: str = file_info.get("mimeType", content_type)
    file_id = file_uri.rsplit("/", 1)[-1]

    await wait_for_file_active(file_id)
    return await generate_content_for_video(file_uri, gemini_mime_type, prompt)
