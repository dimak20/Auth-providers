from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.settings import get_settings
from src.infra.db.models.users import Users
from src.users.domain import User
from src.users.exceptions import UserNotCreated
from src.users.interfaces import UserRepositoryInterface


class UserRepository(UserRepositoryInterface):
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._api_settings = get_settings()

    async def get_user(self, user_id: str, payload: dict) -> User:
        user = (await self._db.execute(
            select(Users)
            .where(Users.external_id == user_id)
        )).scalar_one_or_none()
        if user is None:
            user = await self.create_user(
                external_id=payload["sub"],
                email=payload.get("email")
            )
        return User(
            id=user.id,
            external_id=user.external_id,
            provider=user.provider,
            email=user.email,
            created_at=user.created_at,
            onboarded=user.onboarded
        )

    async def create_user(
            self, external_id: str,
            email: str | None,
        ) -> User:
        onboarded = bool(email)
        user_orm = Users(
            external_id=external_id,
            email=email,
            provider=self._api_settings.PROVIDER,
            onboarded=onboarded
        )

        self._db.add(user_orm)
        try:
            await self._db.commit()
        except Exception as e:
            raise UserNotCreated("Something is wrong with user creation") from e
        return User.from_orm(data=user_orm)

    async def update_user(
            self, user_id: UUID, payload: dict
        ) -> User:
        user_orm = (await self._db.execute(
            update(Users)
            .where(Users.id == user_id)
            .values(**payload)
            .returning(Users)
        )).scalar_one()
        await self._db.commit()
        return User.from_orm(user_orm)
