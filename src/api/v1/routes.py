from fastapi import APIRouter

from src.orders.routes import router as order_router
from src.users.routes import router as user_router

router = APIRouter()
router.include_router(user_router, prefix="/users")
router.include_router(order_router, prefix="/orders")
