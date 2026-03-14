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
