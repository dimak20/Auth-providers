from contextlib import asynccontextmanager
from logging.handlers import QueueListener

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.health import router as health_router
from src.api.v1.deps import get_auth_client
from src.api.v1.routes import router
from src.core.settings import get_settings
from src.core.setup_loger import configure_logging
from src.infra.db.lifecycle import get_active_manager
from src.infra.media.client import create_s3_clients
from src.infra.redis.client import create_redis_client
from src.users.exc_handlers import insufficient_scope, invalid_token
from src.users.exceptions import InsufficientScopeException, InvalidTokenException


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger: QueueListener = configure_logging()
    app.state.auth = get_auth_client()
    app.state.db_manager = get_active_manager()
    app.state.redis = create_redis_client()
    app.state.s3_internal, app.state.s3_public = create_s3_clients()

    await app.state.db_manager.init()
    await app.state.auth.init_client()

    yield

    await app.state.db_manager.close()
    await app.state.redis.aclose()
    logger.stop()


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)
    app.include_router(health_router)
    app.include_router(router=router, prefix="/api/v1")


    origins = get_settings().CORS_ORIGINS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(InvalidTokenException, invalid_token) # type: ignore
    app.add_exception_handler(InsufficientScopeException, insufficient_scope) # type: ignore
    return app

app = create_app()

@app.middleware("http")
async def no_store(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("Cache-Control", "no-store")
    return response

