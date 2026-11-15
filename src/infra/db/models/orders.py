import datetime
import uuid
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from src.infra.db.models.base import Base


class Orders(Base):
    __tablename__ = "orders"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    qty: Mapped[int] = mapped_column(Integer)
    cents_total: Mapped[int]
    photo_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    __table_args__ = (
        CheckConstraint("qty > 0", name="check qty not negative"),
        CheckConstraint("cents_total > 0", name="check cents not negative")
    )
