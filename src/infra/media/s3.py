import asyncio

from botocore.exceptions import ClientError

from src.infra.media.interfaces import StorageMediaInterface


class S3Storage(StorageMediaInterface):
    def __init__(self, bucket, client_public, client_internal):
        self._bucket = bucket
        self._client_public = client_public
        self._client_internal = client_internal

    def presign_put(self, key: str, content_type: str, expires: int = 300) -> str:
        return self._client_public.generate_presigned_url(
            "put_object",
            Params={"Bucket": self._bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires,
        )

    def presign_get(self, key: str, expires: int = 3600) -> str:
        return self._client_public.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires,
        )

    async def head(self, key: str) -> dict | None:
        try:
            r = await asyncio.to_thread(
                self._client_internal.head_object, Bucket=self._bucket, Key=key
            )
        except ClientError as e:
            if e.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
                return None
            raise
        return {"size": r["ContentLength"], "content_type": r.get("ContentType")}
