from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import os

class Settings(BaseSettings):
    # API Keys
    OPENROUTER_API_KEY: str | None = None

    # Project Settings
    PROJECT_NAME: str = "LeaseIQ AI"
    UPLOAD_DIR: str = "temp_uploads"

    # AI Model (OpenRouter)
    AI_MODEL: str = "google/gemini-2.0-flash-001"

    # Allow extra env vars like port, jwt_secret
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="allow"
    )

@lru_cache()
def get_settings():
    settings = Settings()

    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    return settings
