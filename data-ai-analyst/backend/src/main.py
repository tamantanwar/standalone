from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.config import settings
from src.routes import ai

app = FastAPI(
    title="Data AI Analyst",
    version="0.1.0",
    description="Natural language analytics over BigQuery, powered by LLMs.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(ai.router)


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


@app.get("/health", response_model=HealthResponse, tags=["meta"])
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=app.version,
        environment=settings.environment,
    )


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {"service": "data-ai-analyst", "docs": "/docs"}
