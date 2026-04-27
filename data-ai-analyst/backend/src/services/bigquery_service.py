import asyncio
from functools import lru_cache
from typing import Any

from google.cloud import bigquery

from src.config import settings


@lru_cache(maxsize=1)
def get_client() -> bigquery.Client:
    return bigquery.Client(project=settings.gcp_project_id)


async def get_table_schema(dataset: str, table: str) -> list[bigquery.SchemaField]:
    def _fetch() -> list[bigquery.SchemaField]:
        client = get_client()
        table_ref = client.dataset(dataset).table(table)
        return list(client.get_table(table_ref).schema)

    return await asyncio.to_thread(_fetch)


async def validate_query(sql: str) -> None:
    """Dry-run the query to validate. Raises on invalid SQL."""

    def _validate() -> None:
        client = get_client()
        job_config = bigquery.QueryJobConfig(dry_run=True, use_query_cache=False)
        client.query(sql, job_config=job_config).result()

    await asyncio.to_thread(_validate)


async def run_query(sql: str) -> list[dict[str, Any]]:
    def _run() -> list[dict[str, Any]]:
        client = get_client()
        rows = client.query(sql).result()
        result: list[dict[str, Any]] = []
        for row in rows:
            d = dict(row)
            for key, value in d.items():
                if hasattr(value, "isoformat"):
                    d[key] = value.isoformat()
            result.append(d)
        return result

    return await asyncio.to_thread(_run)
