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
from app.services.summary_generator import summary_generator


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

    def incorporate_screen_analysis(
        self, session: SessionState, summary: str, checklist_seed: list[dict[str, object]]
    ) -> SessionState:
        session.screen_summary = summary
        session.phase = "idle"
        session.checklist[0].completed = True

        for item in checklist_seed:
            session.checklist.append(
                ChecklistItem(
                    id=uuid4().hex,
                    label=str(item["label"]),
                    detail=str(item["detail"]),
                    completed=bool(item["completed"]),
                )
            )

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
        lowered = text.lower()
        current_context = session.screen_summary or "No screenshot analysis yet."
        prompt = (
            "You are LiveLens, a voice-first workflow copilot. Keep responses concise, spoken-friendly, and grounded. "
            f"Current screen summary: {current_context}\n"
            f"User request: {text}\n"
            f"Session mode: {session.mode}"
        )
        response_text = gemini_service.respond(prompt)
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
                text=response_text,
                created_at=datetime.now(timezone.utc),
            )
        )

        if "application" in lowered or "finish" in lowered:
            session.checklist[1].completed = True

        if session.mode in {"assist", "act"} and any(
            keyword in lowered for keyword in ["click", "next", "continue", "help me finish"]
        ):
            action = SuggestedAction(
                action_id=uuid4().hex,
                type="click",
                target="Visible primary call-to-action button",
                reason="The user is asking to move forward, and a next-step click is the safest likely action.",
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
                text="The safe action is complete. Let's verify the next visible step.",
                created_at=datetime.now(timezone.utc),
            )
        )
        session.suggested_action = None
        session.phase = "idle"
        return session

    def finalize(self, session: SessionState) -> SessionState:
        session.latest_summary = summary_generator.generate(session)
        session.phase = "idle"
        return session

    def record_execution_result(self, session: SessionState, result: ActionExecutionResult) -> SessionState:
        if session.suggested_action is None:
            return session

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
