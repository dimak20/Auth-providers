from functools import lru_cache
from urllib.parse import quote_plus

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class RedisSettings(BaseModel):
    HOST: str
    PORT: int
    USERNAME: str | None = None
    PASSWORD: str | None = None
    SSL: bool = False
    DECODE_RESPONSES: bool = True
    MAX_CONNECTIONS: int = 50
    HEALTH_CHECK_INTERVAL: int = 30
    CLUSTER: bool = False

class S3Settings(BaseModel):
    BUCKET: str
    REGION: str
    ENDPOINT_URL: str | None = None
    PUBLIC_ENDPOINT_URL: str | None = None
    ACCESS_KEY_ID: str | None = None
    SECRET_ACCESS_KEY: str | None = None

class Settings(BaseSettings):
    ENVIRONMENT: str = "STAGE"
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
    CORS_ORIGINS: list
    REDIS: RedisSettings
    S3: S3Settings

    model_config = SettingsConfigDict(
        extra="ignore",
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
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
