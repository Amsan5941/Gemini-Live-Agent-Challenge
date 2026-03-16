# backend/tests/test_orchestrator.py
from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

from app.models.session import (
    ChecklistItem,
    SessionState,
)
from app.services.orchestrator import Orchestrator


def _base_session() -> SessionState:
    return SessionState(
        session_id="test-session",
        checklist=[
            ChecklistItem(id=uuid4().hex, label="Capture the current step", completed=False),
            ChecklistItem(id=uuid4().hex, label="Clarify your goal", completed=False),
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

    clarify = next(i for i in updated.checklist if i.label == "Clarify your goal")
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
