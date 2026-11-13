from uuid import UUID

from src.users.domain import User
from src.users.interfaces import UserRepositoryInterface, UserServiceInterface


class UserService(UserServiceInterface):
    def __init__(self, user_repo: UserRepositoryInterface) -> None:
        self._user_repo = user_repo

    async def get_user(self, user_id: UUID, payload: dict) -> User:
        return await self._user_repo.get_user(user_id=user_id, payload=payload)

    async def onboard_user(self, user_id: UUID, payload: dict) -> User:
        payload["onboarded"] = True
        return await self._user_repo.update_user(user_id=user_id, payload=payload)
