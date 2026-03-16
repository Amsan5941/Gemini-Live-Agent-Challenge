# backend/app/api/routes.py
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.models.session import (
    ConfirmActionRequest,
    SessionState,
    UtteranceRequest,
)
from app.services.orchestrator import orchestrator
from app.services.screen_analyzer import screen_analyzer
from app.services.session_store import get_session_store
from app.services.storage_service import get_artifact_store


router = APIRouter()


def _get_session_or_404(store, session_id: str) -> SessionState:
    try:
        return store.get(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc


@router.post("/sessions/start", response_model=SessionState)
async def start_session() -> SessionState:
    store = get_session_store()
    session = orchestrator.build_initial_session()
    return store.create(session)


@router.get("/sessions/{session_id}", response_model=SessionState)
async def get_session(session_id: str) -> SessionState:
    store = get_session_store()
    try:
        return store.get(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc


@router.post("/sessions/{session_id}/screenshot", response_model=SessionState)
async def upload_screenshot(session_id: str, file: UploadFile = File(...)) -> SessionState:
    settings = get_settings()
    store = get_session_store()
    artifact_store = get_artifact_store()
    session = _get_session_or_404(store, session_id)
    file_url = await artifact_store.save_upload(session_id, file)
    session.preview_image_url = file_url

    local_path = settings.local_storage_path / session_id / Path(file_url).name
    envelope = screen_analyzer.analyze(local_path)
    updated = orchestrator.incorporate_screen_analysis(session=session, envelope=envelope)
    return store.save(updated)


@router.post("/sessions/{session_id}/analyze", response_model=SessionState)
async def analyze_screen(session_id: str) -> SessionState:
    settings = get_settings()
    store = get_session_store()
    session = _get_session_or_404(store, session_id)
    if not session.preview_image_url:
        raise HTTPException(status_code=400, detail="No screenshot uploaded")

    local_path = settings.local_storage_path / session_id / Path(session.preview_image_url).name
    envelope = screen_analyzer.analyze(local_path)
    updated = orchestrator.incorporate_screen_analysis(session=session, envelope=envelope)
    return store.save(updated)


@router.post("/sessions/{session_id}/utterance", response_model=SessionState)
async def send_utterance(session_id: str, payload: UtteranceRequest) -> SessionState:
    store = get_session_store()
    session = _get_session_or_404(store, session_id)
    updated = orchestrator.handle_utterance(session, payload.text)
    return store.save(updated)


@router.post("/sessions/{session_id}/actions/confirm", response_model=SessionState)
async def confirm_action(session_id: str, payload: ConfirmActionRequest) -> SessionState:
    store = get_session_store()
    session = _get_session_or_404(store, session_id)
    updated = orchestrator.confirm_action(session, payload.approved)
    return store.save(updated)


@router.post("/sessions/{session_id}/finalize", response_model=SessionState)
async def finalize_session(session_id: str) -> SessionState:
    store = get_session_store()
    session = _get_session_or_404(store, session_id)
    updated = orchestrator.finalize(session)
    return store.save(updated)
