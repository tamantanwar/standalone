import asyncio
import base64
import re
import time
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any

from google.cloud import storage

from src.config import settings


@lru_cache(maxsize=1)
def get_storage_client() -> storage.Client:
    return storage.Client(project=settings.gcp_project_id)


def _get_bucket() -> storage.Bucket:
    return get_storage_client().bucket(settings.gcs_bucket_ad_images)


_BASE64_DATA_URL = re.compile(r"^data:image/\w+;base64,")


async def upload_image(
    image_data: bytes | str,
    account_name: str,
    file_name: str,
    *,
    content_type: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, str]:
    """
    Upload bytes (or base64 string) to GCS at ad-images/{account_name}/{...}.
    Mirrors the original gcs.js uploadImage.
    """

    def _upload() -> dict[str, str]:
        if isinstance(image_data, str):
            base64_data = _BASE64_DATA_URL.sub("", image_data)
            buffer = base64.b64decode(base64_data)
        else:
            buffer = image_data

        timestamp = int(time.time() * 1000)
        unique_id = uuid.uuid4().hex[:8]
        path = Path(file_name)
        extension = path.suffix or ".jpg"
        base_name = path.stem
        final_name = f"{base_name}-{timestamp}-{unique_id}{extension}"
        file_path = f"ad-images/{account_name}/{final_name}"

        bucket = _get_bucket()
        blob = bucket.blob(file_path)

        all_metadata = dict(metadata or {})
        all_metadata.update(
            {
                "uploadedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "accountName": account_name,
            }
        )
        blob.metadata = {k: str(v) for k, v in all_metadata.items()}

        blob.upload_from_string(
            buffer,
            content_type=content_type or "image/jpeg",
        )
        try:
            blob.make_public()
        except Exception:
            pass

        public_url = (
            f"https://storage.googleapis.com/{settings.gcs_bucket_ad_images}/{file_path}"
        )
        return {
            "publicUrl": public_url,
            "fileName": final_name,
            "filePath": file_path,
            "bucket": settings.gcs_bucket_ad_images,
        }

    return await asyncio.to_thread(_upload)


async def download_file(file_path: str) -> bytes:
    def _download() -> bytes:
        bucket = _get_bucket()
        blob = bucket.blob(file_path)
        return blob.download_as_bytes()

    return await asyncio.to_thread(_download)
