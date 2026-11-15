from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.settings import Settings, get_settings
from src.infra.db.sessions import get_session
from src.infra.media.interfaces import StorageMediaInterface
from src.infra.media.s3 import S3Storage
from src.orders.interfaces import OrderRepositoryInterface, OrderServiceInterface
from src.orders.repositories import OrderRepository
from src.orders.services import OrderService
from src.users.auth import AUTH_CLIENTS, verify_token
from src.users.domain import User
from src.users.interfaces import (
    AuthClient,
    UserRepositoryInterface,
    UserServiceInterface,
)
from src.users.repositories import UserRepository
from src.users.services import UserService

#auth
api_settings: Settings = get_settings()
def get_auth_client() -> AuthClient:
    auth_cls = AUTH_CLIENTS[api_settings.PROVIDER]
    return auth_cls(
        domain=api_settings.AUTH_DOMAIN,
        issuer=api_settings.ISSUER,
        issuer_path=api_settings.ISSUER_PATH,
        audience=api_settings.API_AUDIENCE,
        algorithms=api_settings.ALGORITHMS
    )

#repos
async def get_user_repo(
        db: Annotated[AsyncSession, Depends(get_session)]
    ) -> UserRepositoryInterface:
    return UserRepository(db=db)

async def get_order_repo(
        db: Annotated[AsyncSession, Depends(get_session)]
    ) -> OrderRepositoryInterface:
    return OrderRepository(db=db)

def get_storage(
        request: Request
):
    return S3Storage(
        bucket=api_settings.S3.BUCKET,
        client_public=request.app.state.s3_public,
        client_internal=request.app.state.s3_internal
    )

#services
async def get_user_service(
        user_repo: Annotated[UserRepositoryInterface, Depends(get_user_repo)]
    ) -> UserServiceInterface:
    return UserService(user_repo=user_repo)

async def get_order_service(
        r: Request,
        order_repo: Annotated[OrderRepositoryInterface, Depends(get_order_repo)],
        storage: Annotated[StorageMediaInterface, Depends(get_storage)]
    ) -> OrderServiceInterface:
    return OrderService(order_repo=order_repo, redis=r.app.state.redis, media=storage)

async def get_current_user(
        payload: Annotated[dict, Depends(verify_token)],
        user_service: Annotated[UserServiceInterface, Depends(get_user_service)]
) -> User:
    return await user_service.get_user(user_id=payload["sub"], payload=payload)
