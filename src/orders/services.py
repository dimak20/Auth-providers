from uuid import UUID

from src.orders.domain import Order
from src.orders.exceptions import OrderNotCreated, OrderNotFound
from src.orders.interfaces import OrderRepositoryInterface, OrderServiceInterface


class OrderService(OrderServiceInterface):
    def __init__(self, order_repo: OrderRepositoryInterface) -> None:
        self._order_repo = order_repo

    async def create_order(self, order: Order) -> Order:
        new_order = await self._order_repo.create_order(order=order)
        if not new_order:
            raise OrderNotCreated

        return new_order

    async def get_orders(self, user_id: UUID) -> list[Order]:
        orders = await self._order_repo.get_orders(user_id=user_id)

        return orders

    async def get_order(self, order_id: UUID, user_id: UUID) -> Order:
        order = await self._order_repo.get_order(user_id=user_id, order_id=order_id)
        if order is None:
            raise OrderNotFound()

        return order
