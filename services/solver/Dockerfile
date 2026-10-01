FROM python:3.12-slim AS base
RUN pip install --no-cache-dir uv==0.8.17
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY solver ./solver
RUN uv sync --frozen --no-dev

RUN useradd --system --uid 10001 solver
USER solver
EXPOSE 8000
CMD ["/app/.venv/bin/uvicorn", "solver.api:app", "--host", "0.0.0.0", "--port", "8000"]
