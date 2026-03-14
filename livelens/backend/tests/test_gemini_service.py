# backend/tests/test_gemini_service.py
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_service(api_key: str = ""):
    """Instantiate GeminiService with a mocked settings object."""
    mock_settings = MagicMock()
    mock_settings.gemini_api_key = api_key
    mock_settings.gemini_model = "gemini-1.5-flash"
    with patch("app.services.gemini_service.get_settings", return_value=mock_settings):
        with patch("app.services.gemini_service.genai"):
            from app.services.gemini_service import GeminiService
            return GeminiService()


# ---------------------------------------------------------------------------
# analyze_screenshot_structured
# ---------------------------------------------------------------------------

def test_analyze_screenshot_structured_fallback_disabled():
    """Returns safe envelope when Gemini is disabled (no API key)."""
    service = _make_service(api_key="")
    result = service.analyze_screenshot_structured(Path("/nonexistent/image.png"))

    assert "summary" in result
    assert result["checklist_items"] == []
    assert result["suggested_action"] is None


def test_analyze_screenshot_structured_fallback_missing_file(tmp_path):
    """Returns _MISSING_FILE_FALLBACK when the image file does not exist (enabled service)."""
    from app.services.gemini_service import GeminiService
    service = GeminiService.__new__(GeminiService)
    service.enabled = True
    service.model = MagicMock()
    service.model_name = "gemini-1.5-flash"

    missing = tmp_path / "missing.png"  # never created
    result = service.analyze_screenshot_structured(missing)

    assert "summary" in result
    assert result["checklist_items"] == []
    assert result["suggested_action"] is None
    assert "not available" in result["summary"]


def test_analyze_screenshot_structured_live(tmp_path):
    """Parses Gemini JSON response into the envelope dict."""
    fake_image = tmp_path / "screen.png"
    fake_image.write_bytes(b"fake-png-data")

    gemini_response = {
        "summary": "Login form with username and password fields visible.",
        "checklist_items": [
            {"label": "Fill in username", "detail": "Required field", "completed": False}
        ],
        "suggested_action": {
            "type": "click",
            "target": "Sign In button",
            "reason": "Credentials appear filled — sign in is the next step.",
        },
    }

    mock_model = MagicMock()
    mock_model.generate_content.return_value.text = json.dumps(gemini_response)

    from app.services.gemini_service import GeminiService
    service = GeminiService.__new__(GeminiService)
    service.enabled = True
    service.model = mock_model
    service.model_name = "gemini-1.5-flash"

    with patch("app.services.gemini_service.genai") as mock_genai:
        mock_genai.GenerationConfig = MagicMock(return_value={})
        result = service.analyze_screenshot_structured(fake_image)

    assert result["summary"] == gemini_response["summary"]
    assert len(result["checklist_items"]) == 1
    assert result["suggested_action"]["target"] == "Sign In button"


def test_analyze_screenshot_structured_bad_json(tmp_path):
    """Falls back to safe envelope when Gemini returns invalid JSON."""
    fake_image = tmp_path / "screen.png"
    fake_image.write_bytes(b"fake-png-data")

    mock_model = MagicMock()
    mock_model.generate_content.return_value.text = "not valid json at all"

    from app.services.gemini_service import GeminiService
    service = GeminiService.__new__(GeminiService)
    service.enabled = True
    service.model = mock_model
    service.model_name = "gemini-1.5-flash"

    result = service.analyze_screenshot_structured(fake_image)

    assert "summary" in result
    assert result["checklist_items"] == []
    assert result["suggested_action"] is None


# ---------------------------------------------------------------------------
# respond_structured
# ---------------------------------------------------------------------------

def test_respond_structured_fallback_disabled():
    """Returns safe dict when Gemini is disabled."""
    service = _make_service(api_key="")
    result = service.respond_structured("help me", "login form visible", "agent: hello")

    assert "response_text" in result
    assert result["suggested_action"] is None


def test_respond_structured_live():
    """Parses Gemini JSON into response dict."""
    gemini_response = {
        "response_text": "Click the sign-in button to proceed.",
        "suggested_action": {
            "type": "click",
            "target": "Sign In button",
            "reason": "Next logical step.",
        },
    }

    mock_model = MagicMock()
    mock_model.generate_content.return_value.text = json.dumps(gemini_response)

    from app.services.gemini_service import GeminiService
    service = GeminiService.__new__(GeminiService)
    service.enabled = True
    service.model = mock_model
    service.model_name = "gemini-1.5-flash"

    result = service.respond_structured("help me sign in", "login form", "user: help me")

    assert result["response_text"] == gemini_response["response_text"]
    assert result["suggested_action"]["target"] == "Sign In button"


def test_respond_structured_bad_json():
    """Falls back to safe dict on invalid JSON."""
    mock_model = MagicMock()
    mock_model.generate_content.return_value.text = "oops"

    from app.services.gemini_service import GeminiService
    service = GeminiService.__new__(GeminiService)
    service.enabled = True
    service.model = mock_model
    service.model_name = "gemini-1.5-flash"

    result = service.respond_structured("anything", "screen", "transcript")

    assert "response_text" in result
    assert result["suggested_action"] is None
    assert "temporarily unavailable" in result["response_text"]


def test_respond_structured_fallback_with_key_but_unavailable_model():
    """When a key exists but Gemini is unavailable, fallback should not ask to add a key."""
    from app.services.gemini_service import GeminiService

    service = GeminiService.__new__(GeminiService)
    service.enabled = False
    service.model = None
    service.model_name = "gemini-1.5-flash"
    service.has_api_key = True

    result = service.respond_structured("help", "screen", "transcript")

    assert "response_text" in result
    assert "temporarily unavailable" in result["response_text"]
    assert "Add a Gemini API key" not in result["response_text"]


# ---------------------------------------------------------------------------
# generate_summary_structured
# ---------------------------------------------------------------------------

def test_generate_summary_structured_fallback_disabled():
    """Returns structured text when Gemini is disabled."""
    from app.models.session import ChecklistItem, SessionState
    from uuid import uuid4

    service = _make_service(api_key="")
    session = SessionState(
        session_id="abc",
        checklist=[
            ChecklistItem(id=uuid4().hex, label="Step A", completed=True),
            ChecklistItem(id=uuid4().hex, label="Step B", completed=False),
        ],
    )
    result = service.generate_summary_structured(session)

    assert "Step A" in result
    assert "Step B" in result


def test_generate_summary_structured_live():
    """Returns Gemini paragraph when enabled."""
    from app.models.session import SessionState

    expected = "The user successfully completed the login form and is ready to submit."

    mock_model = MagicMock()
    mock_model.generate_content.return_value.text = expected

    from app.services.gemini_service import GeminiService
    service = GeminiService.__new__(GeminiService)
    service.enabled = True
    service.model = mock_model
    service.model_name = "gemini-1.5-flash"

    session = SessionState(session_id="abc")
    result = service.generate_summary_structured(session)

    assert result == expected
    mock_model.generate_content.assert_called_once()
