import asyncio
from functools import lru_cache
from typing import Any

from google.cloud import bigquery

from src.config import settings


@lru_cache(maxsize=1)
def get_client() -> bigquery.Client:
    return bigquery.Client(project=settings.gcp_project_id)


async def query(
    sql: str,
    *,
    params: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    def _run() -> list[dict[str, Any]]:
        client = get_client()

        if params:
            query_params = [
                bigquery.ScalarQueryParameter(k, _bq_type_for(v), v)
                for k, v in params.items()
            ]
            job_config = bigquery.QueryJobConfig(query_parameters=query_params)
            job = client.query(sql, job_config=job_config)
        else:
            job = client.query(sql)

        rows = job.result()
        result: list[dict[str, Any]] = []
        for row in rows:
            d = dict(row)
            for key, value in d.items():
                if hasattr(value, "isoformat"):
                    d[key] = value.isoformat()
            result.append(d)
        return result

    return await asyncio.to_thread(_run)


def _bq_type_for(value: Any) -> str:
    if isinstance(value, bool):
        return "BOOL"
    if isinstance(value, int):
        return "INT64"
    if isinstance(value, float):
        return "FLOAT64"
    return "STRING"
