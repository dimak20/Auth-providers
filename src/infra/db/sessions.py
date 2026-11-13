from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import (
    AsyncSession,
)

from src.infra.db.lifecycle import DBLifecycle, get_active_manager


async def get_session(manager: Annotated[DBLifecycle, Depends(get_active_manager)]) -> AsyncSession: # type: ignore
    async with manager.session() as db:
        try:
            yield db # type: ignore
            await db.commit()
        except Exception:
            await db.rollback()
            raise
