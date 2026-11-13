from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROVIDER: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int = 5432
    AUTH_DOMAIN: str
    API_AUDIENCE: str
    ISSUER: str
    ALGORITHMS: list
    ISSUER_PATH: str

    model_config = SettingsConfigDict(
        extra="ignore",
      env_file=".env",
      env_file_encoding="utf-8",
    )
    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{quote_plus(self.POSTGRES_PASSWORD)}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

@lru_cache
def get_settings():
    return Settings() # type: ignore
