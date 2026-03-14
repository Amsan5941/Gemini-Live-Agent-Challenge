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
