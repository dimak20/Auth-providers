import uuid
from datetime import datetime

from sqlalchemy import UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from src.infra.db.models.base import Base


class Users(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    external_id: Mapped[str] = mapped_column(index=True)
    provider: Mapped[str]
    email: Mapped[str | None]
    onboarded: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        UniqueConstraint("provider", "external_id"),
    )
