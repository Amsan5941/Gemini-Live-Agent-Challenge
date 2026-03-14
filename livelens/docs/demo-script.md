# LiveLens 4-Minute Demo Script

## Goal

Show that LiveLens is a real-time voice-first agent that is grounded in visible UI and can safely assist or act.

## Timeline

### 0:00-0:30 Problem and promise

1. Open the landing page.
2. Say: "Applications and admin forms fail because users get stuck on confusing screens."
3. Say: "LiveLens solves this with voice-first, grounded screen understanding."

### 0:30-1:20 Instant magical setup

1. Click `Start live session`.
2. Click `Load 60-second magic demo`.
3. Point out:
- transcript is already contextual
- checklist is seeded
- action confirmation is waiting
- mode is set to `Act`

### 1:20-2:30 Voice-first interaction

1. Click mic and ask: "Should I answer yes here?"
2. Let LiveLens respond via speech.
3. Ask: "Can you move to the next step?"
4. Show the clear confirmation card and explain explicit approval guardrails.

### 2:30-3:20 Safe action and checklist updates

1. Click `Approve and execute`.
2. Show action log entries (`suggested`, `confirmed`, `executed`).
3. Call out that ambiguous targets fail safely rather than acting blindly.

### 3:20-4:00 Summary and architecture

1. Click `Finalize summary`.
2. Read completed steps, remaining tasks, and blockers.
3. Show architecture diagram and mention Google Cloud:
- Cloud Run backend
- Firestore session memory
- Cloud Storage artifacts
- Gemini multimodal orchestration

## Backup flow if audio is flaky

1. Use text input in the conversation panel.
2. Keep the same scripted prompts.
3. Highlight that voice-first is supported, with robust fallback.

