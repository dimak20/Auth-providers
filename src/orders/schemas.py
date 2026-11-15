from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.orders.domain import Order


class OrderCreate(BaseModel):
    qty: int
    price_cents: int
    url_key: str | None = None

    def to_domain(self, user_id: UUID) -> Order:
        return Order(
            qty=self.qty,
            cents_total=self.price_cents,
            user_id=user_id,
            photo_key=self.url_key
        )

class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    qty: int
    price_cents: int = Field(validation_alias="cents_total")
    user_id: UUID
    created_at: datetime
    photo_url: str | None = None

class UploadUrlIn(BaseModel):
    content_type: Literal["image/jpeg", "image/png", "image/webp"]   # белый список сразу в схеме

class UploadUrlOut(BaseModel):
    upload_url: str
    key: str
