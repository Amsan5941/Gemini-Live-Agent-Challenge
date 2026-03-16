from __future__ import annotations

from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from google.cloud import storage

from app.core.config import Settings, get_settings


class ArtifactStore(ABC):
    @abstractmethod
    async def save_upload(self, session_id: str, file: UploadFile) -> str:
        raise NotImplementedError


class LocalArtifactStore(ArtifactStore):
    def __init__(self, settings: Settings) -> None:
        self.base_path = settings.local_storage_path

    async def save_upload(self, session_id: str, file: UploadFile) -> str:
        session_dir = self.base_path / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        extension = Path(file.filename or "upload.png").suffix or ".png"
        filename = f"{uuid4().hex}{extension}"
        destination = session_dir / filename
        content = await file.read()
        destination.write_bytes(content)
        return f"/artifacts/{session_id}/{filename}"


class CloudArtifactStore(ArtifactStore):
    def __init__(self, settings: Settings) -> None:
        self.bucket = storage.Client(project=settings.google_cloud_project).bucket(settings.storage_bucket)

    async def save_upload(self, session_id: str, file: UploadFile) -> str:
        extension = Path(file.filename or "upload.png").suffix or ".png"
        blob_name = f"{session_id}/{uuid4().hex}{extension}"
        blob = self.bucket.blob(blob_name)
        blob.upload_from_string(await file.read(), content_type=file.content_type or "image/png")
        return blob.public_url


@lru_cache(maxsize=1)
def get_artifact_store() -> ArtifactStore:
    settings = get_settings()
    if settings.has_cloud_storage_config and not settings.use_local_storage:
        try:
            return CloudArtifactStore(settings)
        except Exception:
            return LocalArtifactStore(settings)
    return LocalArtifactStore(settings)

