from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.orders.domain import Order


class OrderCreate(BaseModel):
    qty: int
    price_cents: int

    def to_domain(self, user_id: UUID) -> Order:
        return Order(
            qty=self.qty,
            cents_total=self.price_cents,
            user_id=user_id
        )

class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    qty: int
    price_cents: int = Field(validation_alias="cents_total")
    user_id: UUID
    created_at: datetime
