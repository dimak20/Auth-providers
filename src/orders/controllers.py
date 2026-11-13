from typing import Annotated
from uuid import UUID

from fastapi import Depends, Security

from src.api.v1.deps import get_current_user, get_order_service
from src.orders.interfaces import OrderServiceInterface
from src.orders.schemas import OrderCreate, OrderOut
from src.users.domain import User
from src.users.scopes import Scope


async def create_order_controller(
        user: Annotated[User, Security(get_current_user, scopes=[Scope.USERS_WRITE])],
        data: OrderCreate,
        service: Annotated[OrderServiceInterface, Depends(get_order_service)]
) -> OrderOut:
    order_domain = await service.create_order(order=data.to_domain(user_id=user.id))
    return OrderOut.model_validate(order_domain)

async def get_order_controller(
        order_id: UUID,
        user: Annotated[User, Security(get_current_user, scopes=[])],
        service: Annotated[OrderServiceInterface, Depends(get_order_service)]
) -> OrderOut:
    order_domain = await service.get_order(order_id=order_id, user_id=user.id)
    return OrderOut.model_validate(order_domain)

async def get_orders_controller(
        user: Annotated[User, Security(get_current_user, scopes=[])],
        service: Annotated[OrderServiceInterface, Depends(get_order_service)]
) -> list[OrderOut]:
    orders_domain = await service.get_orders(user_id=user.id)
    return [OrderOut.model_validate(o) for o in orders_domain]
