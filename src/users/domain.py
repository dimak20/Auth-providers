import datetime
import uuid
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class User:
    id: uuid.UUID
    external_id: str
    provider: str
    email: str | None
    created_at: datetime.datetime
    onboarded: bool

    @classmethod
    def from_orm(cls, data):
        return cls(
            id=data.id,
            external_id=data.external_id,
            provider=data.provider,
            email=data.email,
            created_at=data.created_at,
            onboarded=data.onboarded
        )
