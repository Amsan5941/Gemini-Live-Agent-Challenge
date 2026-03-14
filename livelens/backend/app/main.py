from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(
    title="LiveLens Backend",
    version="0.1.0",
    description="Voice-first workflow copilot backend for the Gemini Live Agent Challenge.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.mount("/artifacts", StaticFiles(directory=settings.local_storage_path), name="artifacts")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

