from abc import ABC, abstractmethod


class StorageMediaInterface(ABC):
    @abstractmethod
    def presign_put(self, key: str, content_type, expires) -> str:
        pass
    @abstractmethod
    def presign_get(self, key: str, expires) -> str:
        pass
    @abstractmethod
    async def head(self, key: str) -> bool:
        pass
