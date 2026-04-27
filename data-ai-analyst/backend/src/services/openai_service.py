from functools import lru_cache

from openai import AsyncOpenAI

from src.config import settings


@lru_cache(maxsize=1)
def get_openai_client() -> AsyncOpenAI:
    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured. "
            "Set via .env locally or Google Secret Manager in production."
        )
    return AsyncOpenAI(api_key=settings.openai_api_key)
