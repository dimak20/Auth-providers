from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.infra.db.models.orders import Orders
from src.orders.domain import Order
from src.orders.interfaces import OrderRepositoryInterface


class OrderRepository(OrderRepositoryInterface):
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create_order(self, order: Order) -> Order:
        order_orm = Orders(
            cents_total=order.cents_total,
            qty=order.qty,
            user_id=order.user_id,
            photo_key=order.photo_key

        )
        self._db.add(order_orm)
        await self._db.commit()
        return Order.from_orm(order_orm)

    async def get_orders(self, user_id: str) -> list[Order]:
        orders_orm = (
            await self._db.scalars(
                select(Orders)
                .where(Orders.user_id == user_id)
            )
        ).all()
        return [Order.from_orm(o_orm) for o_orm in orders_orm]
    async def get_order(self, order_id: int, user_id: str) -> Order | None:
        order_orm = (await self._db.execute(select(Orders).where(Orders.id == order_id, Orders.user_id == user_id))).scalar_one_or_none()
        return Order.from_orm(order_orm) if order_orm else None
