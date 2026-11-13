from fastapi import APIRouter

from src.users.controllers import me, onboard_controller

router = APIRouter()

router.get("/me", status_code=200)(me)
router.patch("/me", status_code=200)(onboard_controller)
