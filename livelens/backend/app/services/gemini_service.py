from __future__ import annotations

from pathlib import Path

import google.generativeai as genai

from app.core.config import get_settings


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

    def analyze_screenshot(self, image_path: Path) -> str:
        if not image_path.exists():
            return (
                "Screenshot upload was recorded, but the local image file was not available for deep analysis. "
                "LiveLens can still continue with transcript guidance and checklist tracking."
            )

        if not self.enabled or self.model is None:
            return (
                "Visible screenshot received. Fallback analysis mode is active, so LiveLens can track the workflow, "
                "but richer Gemini visual grounding needs a valid GEMINI_API_KEY."
            )

        response = self.model.generate_content(
            [
                {
                    "mime_type": "image/png",
                    "data": image_path.read_bytes(),
                },
                (
                    "You are LiveLens, a grounded UI copilot. Describe only visible evidence from this screenshot. "
                    "Call out visible fields, required indicators, warnings, progress, and the next best step."
                ),
            ]
        )
        return response.text

    def respond(self, prompt: str) -> str:
        if not self.enabled or self.model is None:
            return (
                "I can help with the visible workflow. Based on the current screen, I will keep guidance concise, "
                "grounded, and step-by-step. Add a Gemini API key for richer multimodal reasoning."
            )

        response = self.model.generate_content(prompt)
        return response.text


gemini_service = GeminiService()
