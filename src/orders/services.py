import uuid
from dataclasses import asdict
from datetime import datetime
from uuid import UUID, uuid4

import structlog
from redis.asyncio import Redis

from src.infra.media.interfaces import StorageMediaInterface
from src.infra.redis.strategies import get_xfetch
from src.orders.domain import Order
from src.orders.exceptions import OrderNotCreated, OrderNotFound, UnsupportedMediaType
from src.orders.interfaces import OrderRepositoryInterface, OrderServiceInterface

log = structlog.get_logger("orders_service")
EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

class OrderService(OrderServiceInterface):
    def __init__(self, order_repo: OrderRepositoryInterface, redis: Redis, media: StorageMediaInterface) -> None:
        self._order_repo = order_repo
        self._redis = redis
        self._media = media

    async def create_order(self, order: Order) -> Order:
        if order.photo_key:
            if not order.photo_key.startswith(f"uploads/{order.user_id}"):
                raise ValueError()
            is_uploaded = await self._media.head(order.photo_key)
            if not is_uploaded:
                raise ValueError()

        new_order = await self._order_repo.create_order(order=order)

        if not new_order:
            raise OrderNotCreated

        if new_order.photo_key:
            new_order.photo_url = self._media.presign_get(new_order.photo_key, 300)

        await self._redis.delete(f"orders:{new_order.user_id}")
        return new_order

    def get_photo_upload_url(self, user_id: UUID, content_type: str) -> tuple[str, str]:
        if content_type not in EXT:
            raise ValueError()
        key = f"uploads/{user_id}/{uuid.uuid4().hex}.{EXT[content_type]}"
        return self._media.presign_put(key=key, content_type=content_type, expires=300), key

    async def get_orders(self, user_id: UUID) -> list[Order]:
        key = f"orders:{user_id}"
        loader = lambda: self._order_repo.get_orders(user_id=user_id)
        encode = lambda xs: [asdict(x) for x in xs]
        decode = lambda xs: [
            Order(
                qty=x["qty"], cents_total=x["cents_total"], user_id=UUID(x["user_id"]),
                id=UUID(x["id"]) if x["id"] else None,
                created_at=datetime.fromisoformat(x["created_at"]) if x["created_at"] else None,
                photo_key=x.get("photo_key")
            )
            for x in xs
        ]

        try:
            orders = await get_xfetch(
                redis=self._redis, key=key, ttl=60, loader=loader, encode=encode, decode=decode
            )
        except Exception:
            log.warning("error from cache", exc_info=True)
            orders = await loader()


        for order in orders:
            if order.photo_key:
                order.photo_url = self._media.presign_get(order.photo_key, 300)

        return orders

    async def get_order(self, order_id: UUID, user_id: UUID) -> Order:
        order = await self._order_repo.get_order(user_id=user_id, order_id=order_id)
        if order is None:
            raise OrderNotFound()
        if order.photo_key:
            order.photo_url = self._media.presign_get(order.photo_key, 300)

        return order

    def _build_order_photo_key(self, order_id: UUID, content_type: str) -> str:
        ext = EXT.get(content_type)
        if ext is None:
            raise UnsupportedMediaType(content_type)
        return f"orders/{order_id}/{uuid4().hex}.{ext}"
