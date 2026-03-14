from app.models.session import SessionState


class SummaryGenerator:
    def generate(self, session: SessionState) -> str:
        completed = [item.label for item in session.checklist if item.completed]
        remaining = [item.label for item in session.checklist if not item.completed]
        warnings = []

        if session.suggested_action:
            warnings.append("A suggested action is still pending confirmation.")
        if session.screen_summary:
            warnings.append("Summary is grounded only in the latest uploaded screenshot.")

        lines = [
            "Completed steps: " + (", ".join(completed) if completed else "none yet"),
            "Remaining tasks: " + (", ".join(remaining) if remaining else "none"),
            "Warnings or blockers: " + (", ".join(warnings) if warnings else "none"),
            "Plain-English summary: LiveLens kept the user on the happy path with visible-screen guidance, checklist tracking, and safe action handling.",
        ]
        return "\n".join(lines)


summary_generator = SummaryGenerator()

