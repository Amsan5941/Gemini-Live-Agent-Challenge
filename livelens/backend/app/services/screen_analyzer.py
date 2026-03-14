from __future__ import annotations

from pathlib import Path

from app.services.gemini_service import gemini_service


class ScreenAnalyzer:
    def analyze(self, image_path: Path) -> dict[str, object]:
        summary = gemini_service.analyze_screenshot(image_path)
        lower = summary.lower()
        checklist = [
            {
                "label": "Review visible required fields",
                "detail": "LiveLens marked the fields or warnings that are visible in the latest screenshot.",
                "completed": False,
            }
        ]

        if "resume" in lower:
            checklist.append(
                {
                    "label": "Confirm resume or document upload",
                    "detail": "A document-related area appears visible and may need verification.",
                    "completed": False,
                }
            )

        if "submit" in lower or "review" in lower:
            checklist.append(
                {
                    "label": "Double-check before final submission",
                    "detail": "A visible review or submit area suggests the flow is near completion.",
                    "completed": False,
                }
            )

        return {
            "summary": summary,
            "checklist": checklist,
        }


screen_analyzer = ScreenAnalyzer()

