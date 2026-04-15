from minio import Minio
from minio.error import S3Error
from app.core.config import settings
from typing import Optional
import io

_client: Optional[Minio] = None


def get_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=False,
        )
    return _client


def ensure_bucket():
    client = get_client()
    if not client.bucket_exists(settings.MINIO_BUCKET):
        client.make_bucket(settings.MINIO_BUCKET)


def upload_file(object_key: str, data: bytes, content_type: str) -> None:
    client = get_client()
    ensure_bucket()
    client.put_object(
        settings.MINIO_BUCKET,
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )


def get_presigned_url(object_key: str, expires_seconds: int = 3600) -> str:
    from datetime import timedelta
    client = get_client()
    url = client.presigned_get_object(
        settings.MINIO_BUCKET,
        object_key,
        expires=timedelta(seconds=expires_seconds),
    )
    # Replace internal Docker hostname with public-facing URL via nginx /storage/ proxy
    public_base = getattr(settings, 'MINIO_PUBLIC_URL', None)
    if public_base:
        internal = f"http://{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/"
        url = url.replace(internal, f"{public_base.rstrip('/')}/storage/{settings.MINIO_BUCKET}/")
    return url


def get_file_content(object_key: str) -> bytes:
    client = get_client()
    response = client.get_object(settings.MINIO_BUCKET, object_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def delete_file(object_key: str) -> None:
    client = get_client()
    try:
        client.remove_object(settings.MINIO_BUCKET, object_key)
    except S3Error:
        pass
