import boto3
from botocore.config import Config

from src.core.settings import get_settings

s = get_settings().S3
def create_s3_clients():
    regional = f"https://s3.{s.REGION}.amazonaws.com"
    cfg = Config(
        signature_version="s3v4",
        s3={"addressing_style": "path"} if s.ENDPOINT_URL else {},
        retries={"max_attempts": 3, "mode": "standard"},
    )
    common = dict(
        region_name=s.REGION,
        aws_access_key_id=s.ACCESS_KEY_ID,
        aws_secret_access_key=s.SECRET_ACCESS_KEY,
        config=cfg,
    )
    internal = boto3.client("s3", endpoint_url=s.ENDPOINT_URL or regional, **common)
    public = boto3.client("s3", endpoint_url=s.PUBLIC_ENDPOINT_URL or s.ENDPOINT_URL or regional, **common)
    return internal, public

def generate_presigned_put(client, key, content_type):
    return client.generate_presigned_url(
        "put_object",
        Params={"Bucket": s.BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=300,
    )

def generate_presigned_get(client, key, content_type):
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": s.BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=300,
    )
