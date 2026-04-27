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

    gcp_project_id: str = "funnel-clients"
    bigquery_dataset: str = ""

    openai_api_key: str = ""


settings = Settings()
