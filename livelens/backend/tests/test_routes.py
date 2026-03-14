# backend/tests/test_routes.py
from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_respond_endpoint_removed():
    """POST /api/sessions/{id}/respond must no longer exist."""
    response = client.post("/api/sessions/fakeid/respond", json={"text": "hello"})
    assert response.status_code in (404, 405), (
        f"Expected 404 or 405 for removed /respond endpoint, got {response.status_code}"
    )


def test_execute_endpoint_removed():
    """POST /api/sessions/{id}/actions/execute must no longer exist."""
    response = client.post("/api/sessions/fakeid/actions/execute")
    assert response.status_code in (404, 405), (
        f"Expected 404 or 405 for removed /execute endpoint, got {response.status_code}"
    )


def test_upload_screenshot_passes_envelope_to_orchestrator():
    """upload_screenshot must pass the full envelope dict to incorporate_screen_analysis."""
    fake_envelope = {
        "summary": "A form is visible.",
        "checklist_items": [],
        "suggested_action": None,
    }

    start_resp = client.post("/api/sessions/start", json={"mode": "assist"})
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]

    with patch("app.api.routes.screen_analyzer") as mock_analyzer, \
         patch("app.api.routes.orchestrator") as mock_orch, \
         patch("app.api.routes.get_artifact_store") as mock_store_factory, \
         patch("app.api.routes.get_session_store") as mock_session_factory:

        from app.models.session import SessionState as _SessionState
        real_session = _SessionState(session_id=session_id, mode="assist")
        mock_session_store = MagicMock()
        mock_session_store.get.return_value = real_session
        mock_session_store.save.return_value = real_session
        mock_session_factory.return_value = mock_session_store
        mock_session = real_session

        mock_art_store = MagicMock()
        import asyncio
        async def fake_save(sid, f): return f"/artifacts/{sid}/img.png"
        mock_art_store.save_upload = fake_save
        mock_store_factory.return_value = mock_art_store

        mock_analyzer.analyze.return_value = fake_envelope
        mock_orch.incorporate_screen_analysis.return_value = real_session

        img_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        response = client.post(
            f"/api/sessions/{session_id}/screenshot",
            files={"file": ("screen.png", img_bytes, "image/png")},
        )

    mock_orch.incorporate_screen_analysis.assert_called_once()
    call_kwargs = mock_orch.incorporate_screen_analysis.call_args
    # Must be called with envelope kwarg (not summary= / checklist_seed=)
    assert "envelope" in call_kwargs.kwargs or (
        len(call_kwargs.args) >= 2 and isinstance(call_kwargs.args[1], dict)
    ), "incorporate_screen_analysis must receive the envelope dict"
