import re
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from src.config import settings
from src.services.bigquery_service import get_table_schema, run_query, validate_query
from src.services.openai_service import get_openai_client

router = APIRouter(prefix="/ai", tags=["ai"])


class AskRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_question: str = Field(..., alias="userQuestion", min_length=1)
    dataset_name: str | None = Field(None, alias="datasetName")


class AskResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rows: list[dict[str, Any]]
    human_response: str = Field(..., serialization_alias="humanResponse")
    sql: str
    table: str


TABLE_MAPPINGS: list[tuple[tuple[str, ...], str]] = [
    (
        ("age", "gender", "city", "region", "demography", "location"),
        "funnel_audience",
    ),
    (
        ("conversion", "product breakdown", "best conversion name", "best ad name"),
        "funnel_conversions",
    ),
]
DEFAULT_TABLE = "funnel_main"


def _select_table(question: str) -> str:
    q = question.lower()
    for keywords, table in TABLE_MAPPINGS:
        if any(kw in q for kw in keywords):
            return table
    return DEFAULT_TABLE


def _extract_sql(response_text: str) -> str | None:
    match = re.search(r"```sql\s*\n([\s\S]*?)\n\s*```", response_text)
    if match:
        return match.group(1).strip()
    match = re.search(r"```\s*\n([\s\S]*?)\n\s*```", response_text)
    if match:
        return match.group(1).strip()
    return None


@router.post("/ask", response_model=AskResponse, response_model_by_alias=True)
async def ask(request: AskRequest) -> AskResponse:
    dataset = request.dataset_name or settings.bigquery_dataset
    if not dataset:
        raise HTTPException(
            status_code=400,
            detail="No BigQuery dataset configured (set BIGQUERY_DATASET or pass datasetName).",
        )

    table = _select_table(request.user_question)

    try:
        schema_fields = await get_table_schema(dataset, table)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch schema for {dataset}.{table}: {exc}",
        ) from exc

    schema_str = ", ".join(f"{f.name}: {f.field_type}" for f in schema_fields)

    system_message = (
        "You are a helpful assistant that translates natural language questions "
        f"into SQL queries. The table schema is: {schema_str}"
    )
    query_prompt = (
        f"Translate the following question into a BigQuery SQL query using the dataset "
        f"'{dataset}' and table '{table}': {request.user_question}"
    )

    openai = get_openai_client()
    try:
        sql_completion = await openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": query_prompt},
            ],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {exc}") from exc

    response_text = sql_completion.choices[0].message.content or ""
    sql_query = _extract_sql(response_text)
    if not sql_query:
        raise HTTPException(
            status_code=500,
            detail="Failed to extract SQL query from OpenAI response.",
        )

    try:
        await validate_query(sql_query)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Generated SQL failed validation: {exc}",
        ) from exc

    try:
        rows = await run_query(sql_query)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Query execution failed: {exc}",
        ) from exc

    if rows:
        results_str = "\n\n".join(
            "\n".join(f"{k}: {v}" for k, v in row.items()) for row in rows
        )
    else:
        results_str = "No rows returned."

    analysis_prompt = (
        f"Given the following query results:\n\n{results_str}\n\n"
        f"and the user's question:\n\n{request.user_question}\n\n"
        f"Provide an insightful, analytical response, including recommendations "
        f"and predictions if applicable."
    )

    try:
        analysis_completion = await openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful assistant named Kedet that provides "
                        "data analysis and insights based on query results."
                    ),
                },
                {"role": "user", "content": analysis_prompt},
            ],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {exc}") from exc

    human_response = (analysis_completion.choices[0].message.content or "").strip()

    return AskResponse(
        rows=rows,
        human_response=human_response,
        sql=sql_query,
        table=table,
    )
