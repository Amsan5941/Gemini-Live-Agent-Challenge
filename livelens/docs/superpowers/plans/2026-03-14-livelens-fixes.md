# LiveLens Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 7 code quality issues in the LiveLens backend so every area reaches excellent.

**Architecture:** Three structured Gemini methods replace plain-text + keyword-matching; the orchestrator drops all hardcoded logic and delegates to those methods; two dead/redundant routes are deleted; README links are fixed.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2, google-generativeai 0.8.3, pytest, httpx

---

## File Structure

| File | Change |
|---|---|
| `backend/app/services/gemini_service.py` | Add `analyze_screenshot_structured`, `respond_structured`, `generate_summary_structured` |
| `backend/app/services/screen_analyzer.py` | Remove keyword matching; delegate entirely to `analyze_screenshot_structured` |
| `backend/app/services/orchestrator.py` | Add `_complete_checklist_item`; refactor `incorporate_screen_analysis`, `handle_utterance`, `finalize`; delete `record_execution_result`; remove `summary_generator` import |
| `backend/app/services/summary_generator.py` | Delete |
| `backend/app/api/routes.py` | Remove `/respond` and `/actions/execute` endpoints; update two `incorporate_screen_analysis` call sites; remove `action_executor` / `ActionExecutionResult` imports |
| `README.md` | Fix 5 broken paths; remove 2 deleted endpoints from API routes list |
| `backend/tests/test_gemini_service.py` | New — unit tests for the three structured methods |
| `backend/tests/test_screen_analyzer.py` | New — unit tests for the refactored analyzer |
| `backend/tests/test_orchestrator.py` | New — unit tests for helper + refactored methods |
| `backend/tests/test_routes.py` | New — integration tests for route changes and call-site fixes |

---

## Setup (run once before starting tasks)

```bash
cd /Users/amsan/Gemini-Live-Agent-Challenge/livelens/backend
source .venv/bin/activate
pip install pytest pytest-asyncio httpx
```

All test commands assume the working directory is `livelens/backend` and the venv is active.

---

## Chunk 1: GeminiService — Structured Methods

### Task 1: Tests for `analyze_screenshot_structured` fallback paths

**Files:**
- Create: `backend/tests/test_gemini_service.py`

- [ ] **Step 1: Create the test file with fallback tests**

```python
# backend/tests/test_gemini_service.py
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

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
    # Use __new__ with enabled=True so we test the missing-file branch,
    # not the disabled branch.
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
    # Verify we got the missing-file message, not the disabled message
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

    # Use __new__ to bypass __init__ entirely — avoids module-level reload side-effects
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
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
cd /Users/amsan/Gemini-Live-Agent-Challenge/livelens/backend
pytest tests/test_gemini_service.py -v 2>&1 | head -40
```

Expected: All tests fail with `AttributeError` — the new methods don't exist yet.

---

### Task 2: Implement `analyze_screenshot_structured`, `respond_structured`, `generate_summary_structured`

**Files:**
- Modify: `backend/app/services/gemini_service.py`

- [ ] **Step 1: Replace the file contents**

```python
# backend/app/services/gemini_service.py
from __future__ import annotations

import json
from pathlib import Path

import google.generativeai as genai

from app.core.config import get_settings
from app.models.session import SessionState

# ---------------------------------------------------------------------------
# Fallback envelopes — returned when Gemini is disabled or parse fails
# ---------------------------------------------------------------------------

_ANALYZE_FALLBACK: dict[str, object] = {
    "summary": (
        "Visible screenshot received. Fallback analysis mode is active — "
        "richer Gemini visual grounding needs a valid GEMINI_API_KEY."
    ),
    "checklist_items": [],
    "suggested_action": None,
}

_MISSING_FILE_FALLBACK: dict[str, object] = {
    "summary": (
        "Screenshot upload was recorded, but the local image file was not available for deep analysis. "
        "LiveLens can still continue with transcript guidance and checklist tracking."
    ),
    "checklist_items": [],
    "suggested_action": None,
}

_RESPOND_FALLBACK: dict[str, object] = {
    "response_text": (
        "I can help with the visible workflow. Based on the current screen, I will keep guidance concise, "
        "grounded, and step-by-step. Add a Gemini API key for richer multimodal reasoning."
    ),
    "suggested_action": None,
}


class GeminiService:
    def __init__(self) -> None:
        settings = get_settings()
        self.model_name = settings.gemini_model
        self.enabled = bool(settings.gemini_api_key)
        if self.enabled:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(self.model_name)
        else:
            self.model = None

    # ------------------------------------------------------------------
    # Legacy plain-text methods (kept for backward compatibility)
    # ------------------------------------------------------------------

    def analyze_screenshot(self, image_path: Path) -> str:
        """Plain-text screenshot analysis. Kept for compatibility."""
        result = self.analyze_screenshot_structured(image_path)
        return str(result["summary"])

    def respond(self, prompt: str) -> str:
        """Plain-text response. Kept for compatibility."""
        if not self.enabled or self.model is None:
            return str(_RESPOND_FALLBACK["response_text"])
        response = self.model.generate_content(prompt)
        return response.text

    # ------------------------------------------------------------------
    # Structured methods — return typed dicts with JSON envelopes
    # ------------------------------------------------------------------

    def analyze_screenshot_structured(self, image_path: Path) -> dict[str, object]:
        """
        Analyze a screenshot and return a structured envelope:
          {
            "summary": str,
            "checklist_items": list[dict],
            "suggested_action": dict | None
          }
        Falls back to _MISSING_FILE_FALLBACK or _ANALYZE_FALLBACK on error.
        """
        if not image_path.exists():
            return dict(_MISSING_FILE_FALLBACK)

        if not self.enabled or self.model is None:
            return dict(_ANALYZE_FALLBACK)

        prompt = (
            "You are LiveLens, a grounded UI copilot. Analyze this screenshot and return ONLY valid JSON "
            "matching this exact schema:\n"
            '{"summary": "plain-English description of visible UI state", '
            '"checklist_items": [{"label": "...", "detail": "...", "completed": false}], '
            '"suggested_action": {"type": "click|type|scroll|select", '
            '"target": "exact visible label or button text", '
            '"reason": "one sentence grounded in visible evidence"} or null}\n'
            "Rules: describe only visible evidence. Do not hallucinate fields. "
            "suggested_action must be null if no clear next step is visible."
        )

        try:
            response = self.model.generate_content(
                [{"mime_type": "image/png", "data": image_path.read_bytes()}, prompt],
                generation_config=genai.GenerationConfig(response_mime_type="application/json"),
            )
            parsed = json.loads(response.text)
            return {
                "summary": str(parsed.get("summary", "")),
                "checklist_items": list(parsed.get("checklist_items", [])),
                "suggested_action": parsed.get("suggested_action"),
            }
        except Exception:
            return dict(_ANALYZE_FALLBACK)

    def respond_structured(
        self,
        utterance_text: str,
        screen_summary: str,
        transcript_excerpt: str,
    ) -> dict[str, object]:
        """
        Generate a grounded response to a user utterance.
        Returns:
          {"response_text": str, "suggested_action": dict | None}
        Falls back to _RESPOND_FALLBACK on error.
        """
        if not self.enabled or self.model is None:
            return dict(_RESPOND_FALLBACK)

        prompt = (
            "You are LiveLens, a voice-first workflow copilot. Keep responses concise and spoken-friendly.\n"
            f"Current screen: {screen_summary}\n"
            f"Recent transcript:\n{transcript_excerpt}\n"
            f"User said: {utterance_text}\n\n"
            "Return ONLY valid JSON matching this exact schema:\n"
            '{"response_text": "spoken-friendly reply (1-3 sentences)", '
            '"suggested_action": {"type": "click|type|scroll|select", '
            '"target": "exact visible label", "reason": "one sentence"} or null}\n'
            "suggested_action must be null unless the user is explicitly asking to take an action "
            "and a specific visible target is clearly identifiable."
        )

        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(response_mime_type="application/json"),
            )
            parsed = json.loads(response.text)
            return {
                "response_text": str(parsed.get("response_text", "")),
                "suggested_action": parsed.get("suggested_action"),
            }
        except Exception:
            return dict(_RESPOND_FALLBACK)

    def generate_summary_structured(self, session: SessionState) -> str:
        """
        Generate a natural-language session summary.
        Returns a plain string (not JSON).
        Falls back to structured text when Gemini is disabled or session has no context.
        """
        completed = [item.label for item in session.checklist if item.completed]
        remaining = [item.label for item in session.checklist if not item.completed]

        # Fallback when Gemini is off, or session has no checklist AND no transcript
        # (a fully-completed checklist still has context worth summarising via Gemini)
        no_context = not completed and not remaining and not session.transcript
        if not self.enabled or self.model is None or no_context:
            return self._fallback_summary(session)

        transcript_lines = "\n".join(
            f"{m.speaker}: {m.text}" for m in session.transcript[-6:]
        )
        prompt = (
            "You are LiveLens. Write a single concise paragraph summarising this workflow session.\n"
            f"Completed steps: {completed}\n"
            f"Remaining steps: {remaining}\n"
            f"Recent transcript:\n{transcript_lines}\n"
            "Focus on what was accomplished, what is still needed, and any blockers. "
            "Be direct and factual. Do not add commentary."
        )

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception:
            return self._fallback_summary(session)

    def _fallback_summary(self, session: SessionState) -> str:
        completed = [item.label for item in session.checklist if item.completed]
        remaining = [item.label for item in session.checklist if not item.completed]
        warnings: list[str] = []
        if session.suggested_action:
            warnings.append("A suggested action is still pending confirmation.")
        if session.screen_summary:
            warnings.append("Summary is grounded only in the latest uploaded screenshot.")
        return "\n".join([
            "Completed steps: " + (", ".join(completed) if completed else "none yet"),
            "Remaining tasks: " + (", ".join(remaining) if remaining else "none"),
            "Warnings or blockers: " + (", ".join(warnings) if warnings else "none"),
        ])


gemini_service = GeminiService()
```

- [ ] **Step 2: Run the tests**

```bash
cd /Users/amsan/Gemini-Live-Agent-Challenge/livelens/backend
pytest tests/test_gemini_service.py -v
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/amsan/Gemini-Live-Agent-Challenge/livelens/backend
git add tests/test_gemini_service.py app/services/gemini_service.py
git commit -m "feat: add structured Gemini response methods with JSON envelopes"
```

---

## Chunk 2: ScreenAnalyzer + Orchestrator Refactor

### Task 3: Tests for `ScreenAnalyzer`

**Files:**
- Create: `backend/tests/test_screen_analyzer.py`

- [ ] **Step 1: Write the test file**

```python
# backend/tests/test_screen_analyzer.py
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch


def test_analyze_returns_envelope_keys():
    """analyze() returns dict with the three required envelope keys."""
    expected_envelope = {
        "summary": "A login form is visible.",
        "checklist_items": [{"label": "Fill username", "detail": "", "completed": False}],
        "suggested_action": None,
    }

    with patch("app.services.screen_analyzer.gemini_service") as mock_gemini:
        mock_gemini.analyze_screenshot_structured.return_value = expected_envelope
        from app.services.screen_analyzer import ScreenAnalyzer
        analyzer = ScreenAnalyzer()
        result = analyzer.analyze(Path("/fake/path.png"))

    assert result["summary"] == expected_envelope["summary"]
    assert result["checklist_items"] == expected_envelope["checklist_items"]
    assert result["suggested_action"] is None


def test_analyze_no_keyword_matching():
    """analyze() does not add any checklist items beyond what Gemini returns."""
    # Even if Gemini summary mentions "resume" and "submit",
    # no extra items should be added by keyword matching.
    gemini_envelope = {
        "summary": "resume upload and submit button visible",
        "checklist_items": [],
        "suggested_action": None,
    }

    with patch("app.services.screen_analyzer.gemini_service") as mock_gemini:
        mock_gemini.analyze_screenshot_structured.return_value = gemini_envelope
        from app.services.screen_analyzer import ScreenAnalyzer
        analyzer = ScreenAnalyzer()
        result = analyzer.analyze(Path("/fake/path.png"))

    # Should be exactly what Gemini returned — no keyword-injected items
    assert result["checklist_items"] == []


def test_analyze_passes_path_to_gemini():
    """analyze() passes the image path directly to gemini_service."""
    expected_path = Path("/sessions/abc/screenshot.png")
    fallback = {"summary": "x", "checklist_items": [], "suggested_action": None}

    with patch("app.services.screen_analyzer.gemini_service") as mock_gemini:
        mock_gemini.analyze_screenshot_structured.return_value = fallback
        from app.services.screen_analyzer import ScreenAnalyzer
        analyzer = ScreenAnalyzer()
        analyzer.analyze(expected_path)

    mock_gemini.analyze_screenshot_structured.assert_called_once_with(expected_path)
```

- [ ] **Step 2: Run to confirm they fail**

```bash
pytest tests/test_screen_analyzer.py -v
```

Expected: Tests pass or fail depending on current implementation. `test_analyze_no_keyword_matching` should FAIL because keyword matching is still present.

---

### Task 4: Refactor `ScreenAnalyzer`

**Files:**
- Modify: `backend/app/services/screen_analyzer.py`

- [ ] **Step 1: Replace the file**

```python
# backend/app/services/screen_analyzer.py
from __future__ import annotations

from pathlib import Path

from app.services.gemini_service import gemini_service


class ScreenAnalyzer:
    def analyze(self, image_path: Path) -> dict[str, object]:
        """
        Analyze a screenshot via Gemini and return the structured envelope:
          {"summary": str, "checklist_items": list[dict], "suggested_action": dict | None}
        """
        return gemini_service.analyze_screenshot_structured(image_path)


screen_analyzer = ScreenAnalyzer()
```

- [ ] **Step 2: Run screen analyzer tests**

```bash
pytest tests/test_screen_analyzer.py -v
```

Expected: All 3 tests pass.

- [ ] **Step 3: Run the full test suite to check nothing regressed**

```bash
pytest -v
```

Expected: All tests pass.

---

### Task 5: Tests for `Orchestrator`

**Files:**
- Create: `backend/tests/test_orchestrator.py`

- [ ] **Step 1: Write the test file**

```python
# backend/tests/test_orchestrator.py
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.models.session import (
    AgentMessage,
    ChecklistItem,
    SessionState,
    SuggestedAction,
)
from app.services.orchestrator import Orchestrator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_session() -> SessionState:
    return SessionState(
        session_id="test-session",
        checklist=[
            ChecklistItem(id=uuid4().hex, label="Capture the current step", completed=False),
            ChecklistItem(id=uuid4().hex, label="Clarify the immediate goal", completed=False),
        ],
    )


# ---------------------------------------------------------------------------
# _complete_checklist_item
# ---------------------------------------------------------------------------

def test_complete_checklist_item_marks_matching_label():
    orch = Orchestrator()
    session = _base_session()
    orch._complete_checklist_item(session, "Capture the current step")
    assert session.checklist[0].completed is True
    assert session.checklist[1].completed is False


def test_complete_checklist_item_silent_noop_for_missing_label():
    """No IndexError or exception when label is not found."""
    orch = Orchestrator()
    session = _base_session()
    orch._complete_checklist_item(session, "Label that does not exist")
    assert session.checklist[0].completed is False
    assert session.checklist[1].completed is False


def test_complete_checklist_item_does_not_double_complete():
    orch = Orchestrator()
    session = _base_session()
    session.checklist[0].completed = True
    orch._complete_checklist_item(session, "Capture the current step")
    # Still True — idempotent
    assert session.checklist[0].completed is True


# ---------------------------------------------------------------------------
# incorporate_screen_analysis
# ---------------------------------------------------------------------------

def test_incorporate_screen_analysis_sets_summary():
    orch = Orchestrator()
    session = _base_session()
    envelope = {"summary": "Login form visible.", "checklist_items": [], "suggested_action": None}
    updated = orch.incorporate_screen_analysis(session, envelope)
    assert updated.screen_summary == "Login form visible."


def test_incorporate_screen_analysis_appends_checklist_items():
    orch = Orchestrator()
    session = _base_session()
    envelope = {
        "summary": "Form visible.",
        "checklist_items": [{"label": "Fill email", "detail": "Required", "completed": False}],
        "suggested_action": None,
    }
    updated = orch.incorporate_screen_analysis(session, envelope)
    labels = [i.label for i in updated.checklist]
    assert "Fill email" in labels


def test_incorporate_screen_analysis_marks_capture_step_complete():
    orch = Orchestrator()
    session = _base_session()
    envelope = {"summary": "x", "checklist_items": [], "suggested_action": None}
    updated = orch.incorporate_screen_analysis(session, envelope)
    capture = next(i for i in updated.checklist if i.label == "Capture the current step")
    assert capture.completed is True


def test_incorporate_screen_analysis_sets_suggested_action_from_envelope():
    orch = Orchestrator()
    session = _base_session()
    envelope = {
        "summary": "Form with Submit button.",
        "checklist_items": [],
        "suggested_action": {
            "type": "click",
            "target": "Submit button",
            "reason": "Form appears complete.",
        },
    }
    updated = orch.incorporate_screen_analysis(session, envelope)
    assert updated.suggested_action is not None
    assert updated.suggested_action.target == "Submit button"
    assert updated.phase == "awaiting_confirmation"


def test_incorporate_screen_analysis_no_action_keeps_idle():
    orch = Orchestrator()
    session = _base_session()
    envelope = {"summary": "x", "checklist_items": [], "suggested_action": None}
    updated = orch.incorporate_screen_analysis(session, envelope)
    assert updated.suggested_action is None
    assert updated.phase == "idle"


# ---------------------------------------------------------------------------
# handle_utterance
# ---------------------------------------------------------------------------

def test_handle_utterance_appends_messages():
    orch = Orchestrator()
    session = _base_session()
    respond_result = {"response_text": "Click the submit button.", "suggested_action": None}

    with patch("app.services.orchestrator.gemini_service") as mock_gemini:
        mock_gemini.respond_structured.return_value = respond_result
        updated = orch.handle_utterance(session, "Help me finish this")

    speakers = [m.speaker for m in updated.transcript]
    assert "user" in speakers
    assert "agent" in speakers


def test_handle_utterance_uses_respond_structured_not_keywords():
    """handle_utterance must call respond_structured — not do keyword matching."""
    orch = Orchestrator()
    session = _base_session()
    respond_result = {"response_text": "Got it.", "suggested_action": None}

    with patch("app.services.orchestrator.gemini_service") as mock_gemini:
        mock_gemini.respond_structured.return_value = respond_result
        orch.handle_utterance(session, "click next continue help me finish")

    mock_gemini.respond_structured.assert_called_once()


def test_handle_utterance_sets_suggested_action_from_gemini():
    orch = Orchestrator()
    session = _base_session()
    session.mode = "act"
    respond_result = {
        "response_text": "I'll click Next for you.",
        "suggested_action": {"type": "click", "target": "Next button", "reason": "Form ready."},
    }

    with patch("app.services.orchestrator.gemini_service") as mock_gemini:
        mock_gemini.respond_structured.return_value = respond_result
        updated = orch.handle_utterance(session, "go to next step")

    assert updated.suggested_action is not None
    assert updated.suggested_action.target == "Next button"
    assert updated.phase == "awaiting_confirmation"


def test_handle_utterance_no_action_sets_speaking_phase():
    orch = Orchestrator()
    session = _base_session()
    respond_result = {"response_text": "Here is your guidance.", "suggested_action": None}

    with patch("app.services.orchestrator.gemini_service") as mock_gemini:
        mock_gemini.respond_structured.return_value = respond_result
        updated = orch.handle_utterance(session, "what does this field mean?")

    assert updated.phase == "speaking"
    assert updated.suggested_action is None


def test_handle_utterance_marks_clarify_goal_complete():
    orch = Orchestrator()
    session = _base_session()
    respond_result = {"response_text": "Sure.", "suggested_action": None}

    with patch("app.services.orchestrator.gemini_service") as mock_gemini:
        mock_gemini.respond_structured.return_value = respond_result
        updated = orch.handle_utterance(session, "help me finish")

    clarify = next(i for i in updated.checklist if i.label == "Clarify the immediate goal")
    assert clarify.completed is True


# ---------------------------------------------------------------------------
# finalize
# ---------------------------------------------------------------------------

def test_finalize_uses_generate_summary_structured():
    orch = Orchestrator()
    session = _base_session()

    with patch("app.services.orchestrator.gemini_service") as mock_gemini:
        mock_gemini.generate_summary_structured.return_value = "All done."
        updated = orch.finalize(session)

    mock_gemini.generate_summary_structured.assert_called_once_with(session)
    assert updated.latest_summary == "All done."


def test_record_execution_result_does_not_exist():
    """record_execution_result must be removed from Orchestrator."""
    orch = Orchestrator()
    assert not hasattr(orch, "record_execution_result"), (
        "record_execution_result should be deleted — it was only used by the removed /execute endpoint"
    )
```

- [ ] **Step 2: Run to confirm failures**

```bash
pytest tests/test_orchestrator.py -v 2>&1 | tail -30
```

Expected: Many failures — the new methods don't exist yet.

---

### Task 6: Refactor `Orchestrator`

**Files:**
- Modify: `backend/app/services/orchestrator.py`

- [ ] **Step 1: Replace the file**

```python
# backend/app/services/orchestrator.py
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.models.session import (
    ActionLogItem,
    AgentMessage,
    ChecklistItem,
    SessionMode,
    SessionState,
    SuggestedAction,
)
from app.services.action_executor import ActionExecutionResult, action_executor
from app.services.gemini_service import gemini_service


class Orchestrator:
    def build_initial_session(self, mode: SessionMode) -> SessionState:
        session_id = uuid4().hex
        return SessionState(
            session_id=session_id,
            mode=mode,
            phase="idle",
            transcript=[
                AgentMessage(
                    id=uuid4().hex,
                    speaker="agent",
                    text="I'm LiveLens. Upload the current screen and ask what you want to finish.",
                    created_at=datetime.now(timezone.utc),
                )
            ],
            checklist=[
                ChecklistItem(
                    id=uuid4().hex,
                    label="Capture the current step",
                    detail="Upload a screenshot so LiveLens can ground the guidance in visible evidence.",
                    completed=False,
                ),
                ChecklistItem(
                    id=uuid4().hex,
                    label="Clarify the immediate goal",
                    detail="Say what you want to finish, such as submitting an application or fixing an error.",
                    completed=False,
                ),
            ],
        )

    def _complete_checklist_item(self, session: SessionState, label: str) -> None:
        """Mark the first uncompleted item matching `label` as done. Silent no-op if not found."""
        for item in session.checklist:
            if item.label == label and not item.completed:
                item.completed = True
                break

    def incorporate_screen_analysis(
        self, session: SessionState, envelope: dict[str, object]
    ) -> SessionState:
        """
        Apply a structured Gemini screenshot analysis envelope to the session.
        Envelope shape: {"summary": str, "checklist_items": list[dict], "suggested_action": dict | None}
        """
        session.screen_summary = str(envelope.get("summary", ""))
        session.phase = "idle"

        self._complete_checklist_item(session, "Capture the current step")

        for item in envelope.get("checklist_items", []):  # type: ignore[union-attr]
            session.checklist.append(
                ChecklistItem(
                    id=uuid4().hex,
                    label=str(item["label"]),
                    detail=str(item.get("detail", "")),
                    completed=bool(item.get("completed", False)),
                )
            )

        raw_action = envelope.get("suggested_action")
        if raw_action and isinstance(raw_action, dict):
            try:
                action = SuggestedAction(
                    action_id=uuid4().hex,
                    type=raw_action["type"],
                    target=raw_action["target"],
                    reason=raw_action.get("reason", ""),
                    value=raw_action.get("value"),
                    requires_confirmation=True,
                )
                session.suggested_action = action
                session.phase = "awaiting_confirmation"
                session.action_log.append(
                    ActionLogItem(
                        id=uuid4().hex,
                        timestamp=datetime.now(timezone.utc),
                        status="suggested",
                        description=f"Suggested {action.type} on {action.target}",
                    )
                )
            except Exception:
                pass  # Invalid action shape from Gemini — skip silently

        session.transcript.append(
            AgentMessage(
                id=uuid4().hex,
                speaker="agent",
                text="I reviewed the screenshot and I'm ready to guide the next step.",
                created_at=datetime.now(timezone.utc),
            )
        )
        return session

    def handle_utterance(self, session: SessionState, text: str) -> SessionState:
        session.phase = "thinking"

        screen_summary = session.screen_summary or "No screenshot analysis yet."
        transcript_excerpt = "\n".join(
            f"{m.speaker}: {m.text}" for m in session.transcript[-6:]
        )

        result = gemini_service.respond_structured(
            utterance_text=text,
            screen_summary=screen_summary,
            transcript_excerpt=transcript_excerpt,
        )

        session.transcript.append(
            AgentMessage(
                id=uuid4().hex,
                speaker="user",
                text=text,
                created_at=datetime.now(timezone.utc),
            )
        )
        session.transcript.append(
            AgentMessage(
                id=uuid4().hex,
                speaker="agent",
                text=result["response_text"],  # type: ignore[index]
                created_at=datetime.now(timezone.utc),
            )
        )

        self._complete_checklist_item(session, "Clarify the immediate goal")

        raw_action = result.get("suggested_action")
        if raw_action and isinstance(raw_action, dict) and session.mode in {"assist", "act"}:
            try:
                action = SuggestedAction(
                    action_id=uuid4().hex,
                    type=raw_action["type"],
                    target=raw_action["target"],
                    reason=raw_action.get("reason", ""),
                    value=raw_action.get("value"),
                    requires_confirmation=True,
                )
                session.suggested_action = action
                session.phase = "awaiting_confirmation"
                session.action_log.append(
                    ActionLogItem(
                        id=uuid4().hex,
                        timestamp=datetime.now(timezone.utc),
                        status="suggested",
                        description=f"Suggested {action.type} on {action.target}",
                    )
                )
            except Exception:
                session.phase = "speaking"
        else:
            session.phase = "speaking"

        return session

    def confirm_action(self, session: SessionState, approved: bool) -> SessionState:
        if session.suggested_action is None:
            return session

        action = session.suggested_action
        if not approved:
            session.action_log.append(
                ActionLogItem(
                    id=uuid4().hex,
                    timestamp=datetime.now(timezone.utc),
                    status="failed",
                    description=f"User cancelled {action.type} on {action.target}",
                )
            )
            session.transcript.append(
                AgentMessage(
                    id=uuid4().hex,
                    speaker="agent",
                    text="No problem. I cancelled that action and we can keep guiding manually.",
                    created_at=datetime.now(timezone.utc),
                )
            )
            session.suggested_action = None
            session.phase = "idle"
            return session

        session.action_log.append(
            ActionLogItem(
                id=uuid4().hex,
                timestamp=datetime.now(timezone.utc),
                status="confirmed",
                description=f"Confirmed {action.type} on {action.target}",
            )
        )
        result = action_executor.execute(action.type, action.target, action.value)
        session.action_log.append(
            ActionLogItem(
                id=uuid4().hex,
                timestamp=datetime.now(timezone.utc),
                status="executed" if result.ok else "failed",
                description=result.message,
            )
        )
        session.transcript.append(
            AgentMessage(
                id=uuid4().hex,
                speaker="agent",
                text="The safe action is complete. Let's verify the next visible step."
                if result.ok
                else "I could not safely complete that action, so I stopped and kept the page unchanged.",
                created_at=datetime.now(timezone.utc),
            )
        )
        session.suggested_action = None
        session.phase = "idle"
        return session

    def finalize(self, session: SessionState) -> SessionState:
        session.latest_summary = gemini_service.generate_summary_structured(session)
        session.phase = "idle"
        return session

    def seed_demo_state(self, session: SessionState) -> SessionState:
        session.phase = "awaiting_confirmation"
        session.mode = "act"
        session.screen_summary = (
            "Visible screen analysis: multi-step application form with Personal Info completed, "
            "Work Authorization highlighted as required, and Continue visible at the bottom."
        )
        session.preview_image_url = (
            "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80"
        )
        session.checklist = [
            ChecklistItem(
                id=uuid4().hex,
                label="Capture the current step",
                completed=True,
                detail="Screenshot uploaded and analyzed.",
            ),
            ChecklistItem(
                id=uuid4().hex,
                label="Clarify the immediate goal",
                completed=True,
                detail="User asked to finish the application quickly and safely.",
            ),
            ChecklistItem(
                id=uuid4().hex,
                label="Confirm work authorization answer",
                completed=False,
                detail="Required field is visible and pending a final user check.",
            ),
            ChecklistItem(
                id=uuid4().hex,
                label="Continue to the next section",
                completed=False,
                detail="Safe click is prepared and waiting for explicit confirmation.",
            ),
        ]
        session.transcript = [
            AgentMessage(
                id=uuid4().hex,
                speaker="agent",
                text="I can see the application form. Most details look complete and one required question is pending.",
                created_at=datetime.now(timezone.utc),
            ),
            AgentMessage(
                id=uuid4().hex,
                speaker="user",
                text="Help me finish this in under a minute.",
                created_at=datetime.now(timezone.utc),
            ),
            AgentMessage(
                id=uuid4().hex,
                speaker="agent",
                text="Great. Confirm that required answer, then I can safely click Continue after your approval.",
                created_at=datetime.now(timezone.utc),
            ),
        ]
        session.suggested_action = SuggestedAction(
            action_id=uuid4().hex,
            type="click",
            target="Continue button",
            reason="The required question appears addressed, so Continue is the next low-risk action.",
            requires_confirmation=True,
        )
        session.action_log = [
            ActionLogItem(
                id=uuid4().hex,
                timestamp=datetime.now(timezone.utc),
                status="suggested",
                description="Suggested click on Continue button",
            )
        ]
        session.latest_summary = None
        return session


orchestrator = Orchestrator()
```

- [ ] **Step 2: Run orchestrator tests**

```bash
pytest tests/test_orchestrator.py -v
```

Expected: All tests pass.

- [ ] **Step 3: Run full test suite**

```bash
pytest -v
```

Expected: All tests pass.

- [ ] **Step 4: Delete `summary_generator.py`**

```bash
rm /Users/amsan/Gemini-Live-Agent-Challenge/livelens/backend/app/services/summary_generator.py
```

- [ ] **Step 5: Verify nothing imports it**

```bash
grep -r "summary_generator" /Users/amsan/Gemini-Live-Agent-Challenge/livelens/backend/
```

Expected: No output (no remaining references).

- [ ] **Step 6: Run full test suite again**

```bash
pytest -v
```

Expected: All tests still pass.

- [ ] **Step 7: Commit**

```bash
git add tests/test_screen_analyzer.py tests/test_orchestrator.py \
    app/services/screen_analyzer.py app/services/orchestrator.py
git rm app/services/summary_generator.py
git commit -m "refactor: replace keyword matching with structured Gemini envelopes in analyzer and orchestrator"
```

---

## Chunk 3: Route Cleanup + README

### Task 7: Tests for route changes

**Files:**
- Create: `backend/tests/test_routes.py`

- [ ] **Step 1: Write the test file**

```python
# backend/tests/test_routes.py
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Deleted endpoints must return 404 or 405
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Upload screenshot passes envelope to orchestrator
# ---------------------------------------------------------------------------

def test_upload_screenshot_passes_envelope_to_orchestrator(tmp_path):
    """upload_screenshot must pass the full envelope dict, not split keys."""
    fake_envelope = {
        "summary": "A form is visible.",
        "checklist_items": [],
        "suggested_action": None,
    }

    # Build a session to retrieve
    start_resp = client.post("/api/sessions/start", json={"mode": "assist"})
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]

    with patch("app.api.routes.screen_analyzer") as mock_analyzer, \
         patch("app.api.routes.orchestrator") as mock_orch, \
         patch("app.api.routes.get_artifact_store") as mock_store_factory, \
         patch("app.api.routes.get_session_store") as mock_session_factory:

        # Session store returns a session with correct id
        mock_session = MagicMock()
        mock_session.session_id = session_id
        mock_session_store = MagicMock()
        mock_session_store.get.return_value = mock_session
        mock_session_store.save.return_value = mock_session
        mock_session_factory.return_value = mock_session_store

        # Artifact store returns a fake URL
        mock_art_store = MagicMock()
        mock_art_store.save_upload = MagicMock(return_value=f"/artifacts/{session_id}/img.png")
        mock_store_factory.return_value = mock_art_store

        # Analyzer returns the structured envelope
        mock_analyzer.analyze.return_value = fake_envelope

        # Orchestrator just returns the session unchanged
        mock_orch.incorporate_screen_analysis.return_value = mock_session

        img_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        response = client.post(
            f"/api/sessions/{session_id}/screenshot",
            files={"file": ("screen.png", img_bytes, "image/png")},
        )

    # Verify orchestrator was called with the envelope dict, not split args
    mock_orch.incorporate_screen_analysis.assert_called_once()
    call_kwargs = mock_orch.incorporate_screen_analysis.call_args
    # Should be called as incorporate_screen_analysis(session=..., envelope=...)
    assert "envelope" in call_kwargs.kwargs or (
        len(call_kwargs.args) == 2  # positional: session, envelope
    ), "incorporate_screen_analysis must be called with envelope kwarg or positional dict"
```

- [ ] **Step 2: Run to confirm failures**

```bash
pytest tests/test_routes.py -v
```

Expected: `test_respond_endpoint_removed` and `test_execute_endpoint_removed` FAIL (endpoints still exist). `test_upload_screenshot_passes_envelope_to_orchestrator` may fail too.

---

### Task 8: Refactor `routes.py`

**Files:**
- Modify: `backend/app/api/routes.py`

- [ ] **Step 1: Replace the file**

```python
# backend/app/api/routes.py
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.models.session import (
    ConfirmActionRequest,
    SessionState,
    StartSessionRequest,
    UpdateModeRequest,
    UtteranceRequest,
)
from app.services.orchestrator import orchestrator
from app.services.screen_analyzer import screen_analyzer
from app.services.session_store import get_session_store
from app.services.storage_service import get_artifact_store


router = APIRouter()


@router.post("/sessions/start", response_model=SessionState)
async def start_session(payload: StartSessionRequest) -> SessionState:
    store = get_session_store()
    session = orchestrator.build_initial_session(payload.mode)
    return store.create(session)


@router.get("/sessions/{session_id}", response_model=SessionState)
async def get_session(session_id: str) -> SessionState:
    store = get_session_store()
    try:
        return store.get(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc


@router.post("/sessions/{session_id}/mode", response_model=SessionState)
async def set_mode(session_id: str, payload: UpdateModeRequest) -> SessionState:
    store = get_session_store()
    session = store.get(session_id)
    session.mode = payload.mode
    session.phase = "idle"
    return store.save(session)


@router.post("/sessions/{session_id}/screenshot", response_model=SessionState)
async def upload_screenshot(session_id: str, file: UploadFile = File(...)) -> SessionState:
    settings = get_settings()
    store = get_session_store()
    artifact_store = get_artifact_store()
    session = store.get(session_id)
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
    session = store.get(session_id)
    if not session.preview_image_url:
        raise HTTPException(status_code=400, detail="No screenshot uploaded")

    local_path = settings.local_storage_path / session_id / Path(session.preview_image_url).name
    envelope = screen_analyzer.analyze(local_path)
    updated = orchestrator.incorporate_screen_analysis(session=session, envelope=envelope)
    return store.save(updated)


@router.post("/sessions/{session_id}/utterance", response_model=SessionState)
async def send_utterance(session_id: str, payload: UtteranceRequest) -> SessionState:
    store = get_session_store()
    session = store.get(session_id)
    updated = orchestrator.handle_utterance(session, payload.text)
    return store.save(updated)


@router.post("/sessions/{session_id}/actions/confirm", response_model=SessionState)
async def confirm_action(session_id: str, payload: ConfirmActionRequest) -> SessionState:
    store = get_session_store()
    session = store.get(session_id)
    updated = orchestrator.confirm_action(session, payload.approved)
    return store.save(updated)


@router.post("/sessions/{session_id}/finalize", response_model=SessionState)
async def finalize_session(session_id: str) -> SessionState:
    store = get_session_store()
    session = store.get(session_id)
    updated = orchestrator.finalize(session)
    return store.save(updated)


@router.post("/sessions/{session_id}/seed-demo", response_model=SessionState)
async def seed_demo_state(session_id: str) -> SessionState:
    store = get_session_store()
    session = store.get(session_id)
    updated = orchestrator.seed_demo_state(session)
    return store.save(updated)
```

- [ ] **Step 2: Run route tests**

```bash
pytest tests/test_routes.py -v
```

Expected: All 3 tests pass.

- [ ] **Step 3: Run full test suite**

```bash
pytest -v
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/test_routes.py app/api/routes.py
git commit -m "refactor: remove redundant /respond and /execute endpoints; pass envelope through route call sites"
```

---

### Task 9: Fix README

**Files:**
- Modify: `README.md` (at `livelens/README.md`)

- [ ] **Step 1: Fix the 5 broken Windows paths**

In [livelens/README.md](livelens/README.md), replace:

| Find | Replace |
|---|---|
| `/C:/Users/Amsan/Downloads/Gemini%20Live%20Agent%20Challenge/livelens/docs/demo-script.md` | `docs/demo-script.md` |
| `/C:/Users/Amsan/Downloads/Gemini%20Live%20Agent%20Challenge/livelens/docs/submission-checklist.md` | `docs/submission-checklist.md` |
| `/C:/Users/Amsan/Downloads/Gemini%20Live%20Agent%20Challenge/livelens/docs/sample-seeded-session.json` | `docs/sample-seeded-session.json` |
| `/C:/Users/Amsan/Downloads/Gemini%20Live%20Agent%20Challenge/livelens/docs/architecture.mmd` | `docs/architecture.mmd` |
| `/C:/Users/Amsan/Downloads/Gemini%20Live%20Agent%20Challenge/livelens/backend/app/api/routes.py` | `backend/app/api/routes.py` |

- [ ] **Step 2: Remove deleted endpoints from the API routes list**

In the `## API routes` section, remove these two lines:
```
- `POST /api/sessions/{session_id}/respond`
- `POST /api/sessions/{session_id}/actions/execute`
```

- [ ] **Step 3: Verify the links look correct**

```bash
grep -n "C:/Users" /Users/amsan/Gemini-Live-Agent-Challenge/livelens/README.md
```

Expected: No output.

```bash
grep -n "sessions/{session_id}/respond\|actions/execute" /Users/amsan/Gemini-Live-Agent-Challenge/livelens/README.md
```

Expected: No output (both removed from the routes list).

- [ ] **Step 4: Commit**

```bash
cd /Users/amsan/Gemini-Live-Agent-Challenge
git add livelens/README.md
git commit -m "fix: replace broken Windows absolute paths and remove deleted endpoints from README"
```

---

## Final Verification

- [ ] **Run the complete test suite one last time**

```bash
cd /Users/amsan/Gemini-Live-Agent-Challenge/livelens/backend
pytest -v
```

Expected: All tests pass. No import errors. No warnings about missing modules.
