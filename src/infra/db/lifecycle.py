import asyncio
from functools import lru_cache
from typing import Any, Protocol, runtime_checkable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.core.settings import get_settings


@runtime_checkable
class DBLifecycle(Protocol):
    async def init(self) -> None:
        ...
    async def close(self) -> None:
        ...
    @property
    def session(self) -> Any:
        ...
    async def healthy(self) -> bool:
        ...

class SQLManager:
    def __init__(self, url: str) -> None:
        self._url = url
        self._engine: AsyncEngine | None = None

    async def init(self) -> None:
        self._engine = create_async_engine(
            url=self._url,
            echo=False, pool_recycle=3600,
            pool_size=30, max_overflow=50
        )
        self._sessionmaker: async_sessionmaker[AsyncSession] = async_sessionmaker(
            bind=self._engine, expire_on_commit=False
        )

    async def close(self) -> None:
        await self._engine.dispose()

    @property
    def session(self) -> async_sessionmaker[AsyncSession]:
        return self._sessionmaker

    async def healthy(self) -> bool:
        try:
            async with asyncio.timeout(2):
                async with self._engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
            return True
        except Exception:
            return False


@lru_cache
def get_active_manager() -> DBLifecycle:
    return SQLManager(get_settings().DATABASE_URL)
