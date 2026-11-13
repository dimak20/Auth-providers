from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.health import router as health_router
from src.api.v1.deps import get_auth_client
from src.api.v1.routes import router
from src.infra.db.lifecycle import get_active_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.auth = get_auth_client()
    app.state.db_manager = get_active_manager()

    await app.state.db_manager.init()
    await app.state.auth.init_client()

    yield

    await app.state.db_manager.close()

def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)
    app.include_router(health_router)
    app.include_router(router=router, prefix="/api/v1")


    origins = [
    "http://localhost:5173",
    "http://localhost:5174",
]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return app

app = create_app()
