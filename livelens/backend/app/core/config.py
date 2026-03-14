from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    port: int = 8000
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    google_cloud_project: str = ""
    firestore_collection: str = "livelens_sessions"
    storage_bucket: str = ""
    use_firestore_emulator: bool = False
    use_local_storage: bool = True
    local_storage_path: Path = Field(default_factory=lambda: Path("storage"))
    playwright_headless: bool = True
    browser_target_url: str = ""
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.local_storage_path.mkdir(parents=True, exist_ok=True)
    return settings
