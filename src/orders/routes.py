from fastapi import APIRouter

from src.orders.controllers import (
    create_order_controller,
    get_order_controller,
    get_orders_controller,
)

router = APIRouter()

router.get("/{order_id}", status_code=200)(get_order_controller)
router.post("", status_code=201)(create_order_controller)
router.get("", status_code=200)(get_orders_controller)
