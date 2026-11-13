from abc import ABC, abstractmethod
from typing import Any, Protocol
from uuid import UUID

from src.users.domain import User


class AuthClient(Protocol):
    async def init_client(self):
        ...
    async def get_signing_key(self, token: str) -> Any:
        ...
    async def decode(self, token: str) -> dict[str, Any]:
        ...

class UserRepositoryInterface(ABC):
    @abstractmethod
    async def get_user(self, user_id: UUID, payload: dict) -> User:
        pass

    @abstractmethod
    async def create_user(self, user: User, payload: dict) -> User:
        pass

    @abstractmethod
    async def update_user(self, user_id: UUID, payload: dict) -> User:
        pass

class UserServiceInterface(ABC):
    @abstractmethod
    async def get_user(self, user_id: str, payload: dict) -> User:
        pass
    @abstractmethod
    async def onboard_user(self, user_id: UUID, payload: dict) -> User:
        pass
