FROM python:3.14-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0 \
    UV_NO_DEV=1

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /bin/
WORKDIR /app

COPY pyproject.toml uv.lock alembic.ini entrypoint.sh ./
RUN uv sync --locked

COPY migrations ./migrations
COPY src ./src

FROM python:3.14-slim AS runner
ENV PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

RUN useradd --create-home app
WORKDIR /app
COPY --from=builder --chown=app:app /app /app

USER app
EXPOSE 8000
ENTRYPOINT [ "./entrypoint.sh" ]
CMD ["gunicorn", "src.main:app", "-k", "uvicorn_worker.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000"]
# CMD ["sleep", "1000"]
