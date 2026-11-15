from abc import ABC, abstractmethod
from uuid import UUID

from src.orders.domain import Order


class OrderRepositoryInterface(ABC):
    @abstractmethod
    async def get_order(self, order_id: UUID, user_id: UUID) -> Order:
        pass
    @abstractmethod
    async def get_orders(self, user_id: UUID) -> list[Order]:
        pass
    @abstractmethod
    async def create_order(self, order: Order) -> Order:
        pass

class OrderServiceInterface(ABC):
    @abstractmethod
    async def get_order(self, order_id: UUID, user_id: UUID) -> Order:
        pass
    @abstractmethod
    async def get_orders(self, user_id: UUID) -> list[Order]:
        pass
    @abstractmethod
    async def create_order(self, order: Order) -> Order:
        pass
    @abstractmethod
    def get_photo_upload_url(self, user_id: UUID, content_type: str) -> tuple[str, str]:
        pass
