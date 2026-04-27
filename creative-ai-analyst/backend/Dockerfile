# syntax=docker/dockerfile:1.7

FROM python:3.12-slim

# Install uv (Astral)
COPY --from=ghcr.io/astral-sh/uv:0.5.4 /uv /usr/local/bin/uv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# Install dependencies first (cached layer until pyproject.toml changes)
COPY pyproject.toml uv.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev 2>/dev/null \
    || uv sync --no-install-project --no-dev

# Copy source
COPY src ./src

# Cloud Run injects PORT (default 8080)
ENV PORT=8080
EXPOSE 8080

# Production command (docker-compose overrides with --reload for local dev)
CMD ["sh", "-c", "uv run --no-dev uvicorn src.main:app --host 0.0.0.0 --port ${PORT}"]
