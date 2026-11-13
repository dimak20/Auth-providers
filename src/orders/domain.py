from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class Order:
    qty: int
    cents_total: int
    user_id: UUID
    id: UUID | None = None
    created_at: datetime | None = None

    @classmethod
    def from_orm(cls, data) -> Order:
        return cls(
            id=data.id,
            created_at=data.created_at,
            user_id=data.user_id,
            qty=data.qty,
            cents_total=data.cents_total
        )
