from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Settings load from env vars (and `.env` in development).

    In production on Cloud Run, env vars are populated from Google Secret Manager
    at container boot via `--set-secrets`. Never read secrets from disk.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    environment: str = "development"

    cors_origins: list[str] = ["http://localhost:3000"]

    # GCP
    gcp_project_id: str = "generative-ai-418805"

    # GCS bucket for ad image artifacts
    gcs_bucket_ad_images: str = "kedet-ad-images"

    # API credentials
    openai_api_key: str = ""
    gemini_api_key: str = ""
    fb_access_token: str = ""

    # OpenAI model selection. Override in .env to roll back if a model is
    # deprecated or behaves differently. As of April 2026:
    #   - chat/vision: gpt-5.4-mini (gpt-4o was retired April 3, 2026)
    #   - image edit:  gpt-image-2 (released April 21, 2026)
    openai_chat_model: str = "gpt-5.4-mini"
    openai_image_model: str = "gpt-image-2"


settings = Settings()
