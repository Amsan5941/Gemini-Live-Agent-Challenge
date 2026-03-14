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

