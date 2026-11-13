from typing import Annotated

from fastapi import Depends, Security

from src.api.v1.deps import get_current_user, get_user_service
from src.users.domain import User
from src.users.interfaces import UserServiceInterface
from src.users.schemas import UserOnboard, UserOut
from src.users.scopes import Scope


async def me(user: Annotated[User, Security(get_current_user, scopes=[])]) -> UserOut:
    return UserOut(
        id=user.id, email=user.email,
        external_id=user.external_id, created_at=user.created_at,
        onboarded=user.onboarded, provider=user.provider
    )

async def onboard_controller(
    data: UserOnboard,
    user: Annotated[User, Security(get_current_user, scopes=[Scope.USERS_WRITE])],
    user_service: Annotated[UserServiceInterface, Depends(get_user_service)]
) -> UserOut:
    updater_user = await user_service.onboard_user(user.id, data.model_dump())

    return UserOut.model_validate(updater_user)
