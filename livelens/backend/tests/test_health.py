from fastapi.testclient import TestClient

from app.main import app
from app.core.config import Settings


def test_healthcheck() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_placeholder_cloud_config_is_treated_as_unset() -> None:
    settings = Settings(
        google_cloud_project="your-gcp-project-id",
        storage_bucket="your-storage-bucket",
    )

    assert settings.has_firestore_config is False
    assert settings.has_cloud_storage_config is False
