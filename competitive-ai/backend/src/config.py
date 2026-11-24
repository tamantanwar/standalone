import logging

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """
    Settings load from env vars (and `.env` in development).

    In production on Cloud Run, env vars are populated from Google Secret Manager
    at container boot via `--set-secrets`. In local dev, any API key left blank is
    fetched from Secret Manager at startup using Application Default Credentials
    (`gcloud auth application-default login`), provided `GCP_PROJECT_ID` is set.
    Never read secrets from disk.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    environment: str = "development"

    cors_origins: list[str] = ["http://localhost:3000"]

    # GCP project holding the Secret Manager secrets (used only for the fallback)
    gcp_project_id: str = ""

    # Third-party API credentials
    spyfu_api_key: str = ""
    serpapi_key: str = ""
    fb_access_token: str = ""
    # Cloud Run mounts it as SEARCHAPI_KEY; local .env uses SEARCH_API_KEY.
    search_api_key: str = Field(
        default="", validation_alias=AliasChoices("SEARCH_API_KEY", "SEARCHAPI_KEY")
    )

    # Secret Manager secret names for the fallback
    spyfu_api_key_secret: str = "spyfu-api-key"  # noqa: S105 (secret name, not value)
    serpapi_key_secret: str = "serpapi-key"  # noqa: S105 (secret name, not value)
    fb_access_token_secret: str = "fb-access-token"  # noqa: S105 (secret name, not value)
    search_api_key_secret: str = "searchapi-key"  # noqa: S105 (secret name, not value)


# setting attribute -> attribute holding its Secret Manager secret name
_SECRET_FIELDS = {
    "spyfu_api_key": "spyfu_api_key_secret",
    "serpapi_key": "serpapi_key_secret",
    "fb_access_token": "fb_access_token_secret",
    "search_api_key": "search_api_key_secret",
}


def _fill_missing_from_secret_manager(s: Settings) -> None:
    missing = [field for field in _SECRET_FIELDS if not getattr(s, field)]
    if not missing or not s.gcp_project_id:
        return

    try:
        from google.cloud import secretmanager

        client = secretmanager.SecretManagerServiceClient()
    except Exception as exc:
        logger.warning("Secret Manager client unavailable (%s); keys stay unset", exc)
        return

    for field in missing:
        secret_id = getattr(s, _SECRET_FIELDS[field])
        name = f"projects/{s.gcp_project_id}/secrets/{secret_id}/versions/latest"
        try:
            response = client.access_secret_version(request={"name": name})
        except Exception as exc:
            logger.warning(
                "Could not load secret %s from project %s: %s",
                secret_id,
                s.gcp_project_id,
                type(exc).__name__,
            )
            continue
        setattr(s, field, response.payload.data.decode("utf-8").strip())
        logger.info("Loaded %s from Secret Manager", secret_id)


settings = Settings()
_fill_missing_from_secret_manager(settings)
