import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    external_id: str
    email: str | None
    onboarded: bool
    provider: str
    created_at: datetime

class UserOnboard(BaseModel):
    email: str
