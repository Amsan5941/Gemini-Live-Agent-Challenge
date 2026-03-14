# LiveLens Fixes Design

**Date:** 2026-03-14
**Scope:** Fix all quality issues identified in code review to bring every area to excellent

---

## Problem Statement

A code review identified 7 issues across the LiveLens codebase:

1. Action grounding is fake — suggested actions use hardcoded keyword matching and a hardcoded target string, not Gemini analysis
2. Double execution path — `/actions/execute` and `confirm_action` both call the action executor, risking double execution
3. Hardcoded checklist index access — `session.checklist[0]` and `[1]` used without bounds checks
4. Screen analyzer uses naive keyword matching after Gemini call instead of structured output
5. `/respond` endpoint is a no-op alias of `/utterance`
6. Summary generator ignores Gemini and uses a hardcoded string
7. README has 5 broken absolute Windows paths

---

## Approach: Single Structured Gemini Response Envelope (Option A)

Each Gemini interaction returns a typed JSON envelope rather than plain text. The backend parses the envelope once and distributes results to the appropriate fields. This minimises API calls, keeps all context in one prompt, and eliminates the post-hoc keyword matching that currently drives grounding decisions.

Gemini 1.5 Flash supports `response_mime_type="application/json"` passed per-call via `generate_content(..., generation_config={"response_mime_type": "application/json"})`. This is passed per-call, not at model init, so the existing plain-text `respond()` method is unaffected.

---

## Section 1 — Structured Gemini Response Envelope

### New methods on `GeminiService`

**`analyze_screenshot_structured(image_path: Path) -> dict`**

Sends the screenshot with a system prompt instructing Gemini to return:
```json
{
  "summary": "plain-English description of visible UI state",
  "checklist_items": [
    {"label": "...", "detail": "...", "completed": false}
  ],
  "suggested_action": {
    "type": "click | type | scroll | select",
    "target": "exact visible label or button text",
    "reason": "one sentence grounded in visible evidence"
  }
}
```
`suggested_action` may be `null` if no clear next step is visible.

On fallback (Gemini disabled, image missing, or JSON parse failure), returns:
```json
{
  "summary": "<fallback message string>",
  "checklist_items": [],
  "suggested_action": null
}
```
This ensures all downstream key reads (`envelope["checklist_items"]`, `envelope["suggested_action"]`) never raise `KeyError`.

**`respond_structured(utterance_text: str, screen_summary: str, transcript_excerpt: str) -> dict`**

- `utterance_text`: the raw user utterance from `handle_utterance`'s `text` parameter
- `screen_summary`: `session.screen_summary or "No screenshot analysis yet."`
- `transcript_excerpt`: the last 6 messages from `session.transcript` serialised as `"speaker: text"` lines

Builds the composite prompt internally and returns:
```json
{
  "response_text": "spoken-friendly reply",
  "suggested_action": { ... } | null
}
```
On fallback (Gemini disabled or parse failure), returns:
```json
{
  "response_text": "<fallback message string>",
  "suggested_action": null
}
```

**`generate_summary_structured(session: SessionState) -> str`**

Sends completed checklist items, remaining items, and the last 6 transcript messages. Returns a natural language paragraph string (not a JSON envelope — the return value goes directly into `session.latest_summary`).

Falls back to structured text when Gemini is disabled or the session has no context:
```
Completed steps: ...
Remaining tasks: ...
Warnings or blockers: ...
```

---

## Section 2 — Orchestrator & Screen Analyzer Changes

### `ScreenAnalyzer.analyze(image_path) -> dict`

- Calls `gemini_service.analyze_screenshot_structured(image_path)`
- Returns the parsed envelope directly: `{"summary": ..., "checklist_items": [...], "suggested_action": ...}`
- Removes all keyword matching (`"resume" in lower`, `"submit" in lower`, etc.)

### `routes.py` call sites for screenshot upload

Both `upload_screenshot` and `analyze_screen` in `routes.py` currently destructure the old `analyze()` result using `analysis["summary"]` and `analysis["checklist"]` before calling `orchestrator.incorporate_screen_analysis(summary=..., checklist_seed=...)`.

These two call sites must be updated to:
1. Call `screen_analyzer.analyze(local_path)` — returns the full envelope dict
2. Pass the envelope directly: `orchestrator.incorporate_screen_analysis(session=session, envelope=analysis)`

### `Orchestrator.incorporate_screen_analysis(session, envelope: dict) -> SessionState`

Signature changes: replaces `summary: str, checklist_seed: list[dict]` with a single `envelope: dict`.

- Reads `envelope["summary"]` → `session.screen_summary`
- Reads `envelope["checklist_items"]` → appends as `ChecklistItem` objects
- Reads `envelope["suggested_action"]` → if non-null, creates `SuggestedAction` and sets `session.suggested_action` + `session.phase = "awaiting_confirmation"` automatically
- Marks checklist item "Capture the current step" as completed via `_complete_checklist_item()` (label-based, not index-based)
- Appends the agent confirmation message to transcript

### `Orchestrator.handle_utterance(session, text) -> SessionState`

- Drops all keyword matching (`"click" in lowered`, `"finish" in lowered`, etc.)
- Calls `gemini_service.respond_structured(utterance_text=text, screen_summary=..., transcript_excerpt=...)`
- Appends user message and agent response to transcript
- If response dict includes non-null `suggested_action`, creates `SuggestedAction` and sets `session.phase = "awaiting_confirmation"`
- Otherwise sets `session.phase = "speaking"`
- Marks checklist item "Clarify the immediate goal" as completed via `_complete_checklist_item()`

### `Orchestrator.finalize(session) -> SessionState`

- Calls `gemini_service.generate_summary_structured(session)` directly
- Removes `summary_generator.generate(session)` call
- Removes `from app.services.summary_generator import summary_generator` import

### `Orchestrator.record_execution_result()`

- **Deleted** from `orchestrator.py` — it was only ever called from the `/actions/execute` route which is also being deleted. Removing both eliminates dead code.

### Safe checklist helper `_complete_checklist_item(session, label: str)`

New private method:
```python
def _complete_checklist_item(self, session: SessionState, label: str) -> None:
    for item in session.checklist:
        if item.label == label and not item.completed:
            item.completed = True
            break
```
Silently does nothing if the label is not found. The label strings `"Capture the current step"` and `"Clarify the immediate goal"` must stay in sync with the initial checklist built in `build_initial_session()`.

### `SummaryGenerator` class

- `backend/app/services/summary_generator.py` is deleted entirely
- Its fallback text logic moves into `GeminiService.generate_summary_structured()`

---

## Section 3 — Route Cleanup

### Remove `POST /sessions/{session_id}/respond`

Deleted. It was `return await send_utterance(session_id, payload)` — a pure alias.

### Remove `POST /sessions/{session_id}/actions/execute`

Deleted. `confirm_action` with `approved=True` already calls `action_executor.execute()` internally. The separate execute endpoint was a redundant second execution path.

### Cleanup in `routes.py`

- Remove `from app.services.action_executor import action_executor` import (no longer called from routes)
- The `ActionExecutionResult` import is also unused after this removal — remove it too

---

## Section 4 — README Fixes

### Fix 5 broken absolute Windows paths

| Old | New |
|---|---|
| `/C:/Users/Amsan/Downloads/Gemini%20Live%20Agent%20Challenge/livelens/docs/demo-script.md` | `docs/demo-script.md` |
| `/C:/Users/Amsan/Downloads/Gemini%20Live%20Agent%20Challenge/livelens/docs/submission-checklist.md` | `docs/submission-checklist.md` |
| `/C:/Users/Amsan/Downloads/Gemini%20Live%20Agent%20Challenge/livelens/docs/sample-seeded-session.json` | `docs/sample-seeded-session.json` |
| `/C:/Users/Amsan/Downloads/Gemini%20Live%20Agent%20Challenge/livelens/docs/architecture.mmd` | `docs/architecture.mmd` |
| `/C:/Users/Amsan/Downloads/Gemini%20Live%20Agent%20Challenge/livelens/backend/app/api/routes.py` | `backend/app/api/routes.py` |

### Remove deleted endpoints from API routes list

The `## API routes` section in `README.md` lists all endpoints. Remove:
- `POST /api/sessions/{session_id}/respond`
- `POST /api/sessions/{session_id}/actions/execute`

---

## Files Changed

| File | Changes |
|---|---|
| `backend/app/services/gemini_service.py` | Add `analyze_screenshot_structured`, `respond_structured`, `generate_summary_structured`; keep existing methods for compatibility; use per-call `response_mime_type` |
| `backend/app/services/screen_analyzer.py` | Remove keyword matching; call `analyze_screenshot_structured`; return full envelope |
| `backend/app/services/orchestrator.py` | Drop keyword matching; use structured responses; add `_complete_checklist_item`; update `incorporate_screen_analysis` signature; remove `summary_generator` import; delete `record_execution_result` |
| `backend/app/services/summary_generator.py` | **Deleted** |
| `backend/app/api/routes.py` | Remove `/respond` and `/actions/execute` endpoints; remove `action_executor` and `ActionExecutionResult` imports; update `upload_screenshot` and `analyze_screen` call sites to pass envelope dict |
| `README.md` | Fix 5 broken links; remove 2 deleted endpoints from API routes list |

---

## Non-Goals

- No changes to frontend (the API contract is preserved — same endpoints, same response shapes)
- No changes to `session_store.py`, `storage_service.py`, `action_executor.py`, `config.py`, or models
- No new endpoints added
- No new dependencies (Gemini SDK already supports `response_mime_type`)
