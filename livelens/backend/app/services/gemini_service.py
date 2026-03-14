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

        if not self.enabled or self.model is None:
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
            # plain text — no response_mime_type needed
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
