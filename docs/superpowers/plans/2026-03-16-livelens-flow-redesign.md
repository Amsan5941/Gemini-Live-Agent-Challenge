# LiveLens Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all demo scaffolding and redesign the session UI into a clean 3-state flow (Upload → Interact → Act) with a polished landing page targeting real use cases.

**Architecture:** The session page drives layout based on state (empty / active / awaiting-confirmation / finalized). Backend loses its seed-demo endpoint and mode-switch endpoint. Frontend loses the mode switcher panel and action log panel — action events shown inline in the conversation thread. **Implementation order matters:** the session page rewrite (Chunk 3) happens before component deletions (Chunk 4) to avoid broken TypeScript builds mid-sequence.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, FastAPI, Pydantic

---

## Chunk 1: Backend — Remove Demo and Mode Endpoints

### Task 1: Remove seed_demo_state from orchestrator

**Files:**
- Modify: `livelens/backend/app/services/orchestrator.py`

- [ ] **Step 1: Delete the `seed_demo_state` method (lines 236–308)**

  Remove the entire method:
  ```python
  def seed_demo_state(self, session: SessionState) -> SessionState:
      ...  # everything through line 308
  ```

- [ ] **Step 2: Update `build_initial_session` to take no arguments and always use `assist` mode**

  Replace the current `build_initial_session` signature and body:
  ```python
  def build_initial_session(self, mode: SessionMode) -> SessionState:
  ```
  with:
  ```python
  def build_initial_session(self) -> SessionState:
      session_id = uuid4().hex
      return SessionState(
          session_id=session_id,
          mode="assist",
          phase="idle",
          transcript=[
              AgentMessage(
                  id=uuid4().hex,
                  speaker="agent",
                  text="I'm LiveLens. Upload a screenshot of where you're stuck, or just describe what you're trying to do.",
                  created_at=datetime.now(timezone.utc),
              )
          ],
          checklist=[
              ChecklistItem(
                  id=uuid4().hex,
                  label="Capture the current step",
                  detail="Upload a screenshot so I can see exactly what you're looking at.",
                  completed=False,
              ),
              ChecklistItem(
                  id=uuid4().hex,
                  label="Clarify your goal",
                  detail="Tell me what you're trying to finish — submitting a form, fixing an error, or anything else.",
                  completed=False,
              ),
          ],
      )
  ```

- [ ] **Step 3: Verify the module parses cleanly**

  ```bash
  cd livelens/backend && python -c "from app.services.orchestrator import orchestrator; print('OK')"
  ```
  Expected output: `OK`

- [ ] **Step 4: Commit**

  ```bash
  git add livelens/backend/app/services/orchestrator.py
  git commit -m "refactor: remove seed_demo_state, simplify build_initial_session greeting"
  ```

---

### Task 2: Remove seed-demo and mode endpoints from routes.py; clean up models

**Files:**
- Modify: `livelens/backend/app/api/routes.py`
- Modify: `livelens/backend/app/models/session.py`

- [ ] **Step 1: Delete the seed-demo route from routes.py (lines 108–113)**

  Remove:
  ```python
  @router.post("/sessions/{session_id}/seed-demo", response_model=SessionState)
  async def seed_demo_state(session_id: str) -> SessionState:
      store = get_session_store()
      session = _get_session_or_404(store, session_id)
      updated = orchestrator.seed_demo_state(session)
      return store.save(updated)
  ```

- [ ] **Step 2: Delete the mode endpoint from routes.py (lines 46–52)**

  Remove:
  ```python
  @router.post("/sessions/{session_id}/mode", response_model=SessionState)
  async def set_mode(session_id: str, payload: UpdateModeRequest) -> SessionState:
      store = get_session_store()
      session = _get_session_or_404(store, session_id)
      session.mode = payload.mode
      session.phase = "idle"
      return store.save(session)
  ```

- [ ] **Step 3: Update start_session to take no payload**

  Replace:
  ```python
  @router.post("/sessions/start", response_model=SessionState)
  async def start_session(payload: StartSessionRequest) -> SessionState:
      store = get_session_store()
      session = orchestrator.build_initial_session(payload.mode)
      return store.create(session)
  ```
  With:
  ```python
  @router.post("/sessions/start", response_model=SessionState)
  async def start_session() -> SessionState:
      store = get_session_store()
      session = orchestrator.build_initial_session()
      return store.create(session)
  ```

- [ ] **Step 4: Remove `StartSessionRequest` and `UpdateModeRequest` from the imports block in routes.py**

  Change:
  ```python
  from app.models.session import (
      ConfirmActionRequest,
      SessionState,
      StartSessionRequest,
      UpdateModeRequest,
      UtteranceRequest,
  )
  ```
  To:
  ```python
  from app.models.session import (
      ConfirmActionRequest,
      SessionState,
      UtteranceRequest,
  )
  ```

- [ ] **Step 5: Delete `StartSessionRequest` and `UpdateModeRequest` classes from models/session.py**

  Remove these two classes (lines 57–63):
  ```python
  class StartSessionRequest(BaseModel):
      mode: SessionMode = "assist"


  class UpdateModeRequest(BaseModel):
      mode: SessionMode
  ```

- [ ] **Step 6: Verify backend parses cleanly**

  ```bash
  cd livelens/backend && python -c "from app.api.routes import router; print('OK')"
  ```
  Expected output: `OK`

- [ ] **Step 7: Commit**

  ```bash
  git add livelens/backend/app/api/routes.py livelens/backend/app/models/session.py
  git commit -m "refactor: remove seed-demo and mode endpoints; drop StartSessionRequest and UpdateModeRequest"
  ```

---

## Chunk 2: Frontend API Cleanup

### Task 3: Update lib/api.ts

**Files:**
- Modify: `livelens/frontend/lib/api.ts`

- [ ] **Step 1: Remove `seedDemoSession` function (lines 99–104)**

  Delete exactly:
  ```ts
  export async function seedDemoSession(sessionId: string): Promise<SessionState> {
    const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/seed-demo`, {
      method: "POST"
    });
    return normalizeSessionState(await parseJson<SessionState>(response));
  }
  ```

- [ ] **Step 2: Remove `updateMode` function (lines 71–79)**

  Delete exactly:
  ```ts
  export async function updateMode(sessionId: string, mode: SessionMode): Promise<SessionState> {
    const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    });

    return normalizeSessionState(await parseJson<SessionState>(response));
  }
  ```

- [ ] **Step 3: Update `startSession` to take no arguments**

  Replace:
  ```ts
  export async function startSession(mode: SessionMode): Promise<SessionState> {
    const response = await fetch(`${API_BASE_URL}/api/sessions/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    });

    return normalizeSessionState(await parseJson<SessionState>(response));
  }
  ```
  With:
  ```ts
  export async function startSession(): Promise<SessionState> {
    const response = await fetch(`${API_BASE_URL}/api/sessions/start`, {
      method: "POST"
    });

    return normalizeSessionState(await parseJson<SessionState>(response));
  }
  ```

- [ ] **Step 4: Remove unused `SessionMode` import from line 1**

  Change:
  ```ts
  import { SessionMode, SessionState } from "@/lib/types";
  ```
  To:
  ```ts
  import { SessionState } from "@/lib/types";
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add livelens/frontend/lib/api.ts
  git commit -m "refactor: remove seedDemoSession and updateMode from api client"
  ```

---

## Chunk 3: Frontend — Redesign Pages and Components

> **Note:** This chunk rewrites `session/page.tsx` and updates components BEFORE deleting unused files (Chunk 4), so the TypeScript build stays valid throughout.

### Task 4: Redesign conversation-panel.tsx

The panel no longer contains a text input form (that lives in the session page). It shows messages, an inline progress checklist, a thinking indicator, and the action confirmation card.

**Files:**
- Modify: `livelens/frontend/components/conversation-panel.tsx`

- [ ] **Step 1: Replace the entire content of `conversation-panel.tsx`**

  ```tsx
  "use client";

  import { useEffect, useRef } from "react";
  import { CheckCircle2, Circle } from "lucide-react";
  import { AgentMessage, AgentPhase, ChecklistItem, SuggestedAction } from "@/lib/types";

  interface ConversationPanelProps {
    messages: AgentMessage[];
    checklist: ChecklistItem[];
    phase: AgentPhase;
    suggestedAction?: SuggestedAction | null;
    loading?: boolean;
    confirming?: boolean;
    onConfirmAction: (approved: boolean) => Promise<void>;
  }

  export function ConversationPanel({
    messages,
    checklist,
    phase,
    suggestedAction,
    loading = false,
    confirming = false,
    onConfirmAction,
  }: ConversationPanelProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    return (
      <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-1">
        {loading ? (
          <div className="space-y-3 pt-2">
            <div className="h-14 w-2/3 animate-pulse rounded-2xl bg-white/10" />
            <div className="ml-auto h-12 w-1/2 animate-pulse rounded-2xl bg-white/10" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-mist py-12">
            Upload a screenshot or start typing to begin.
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  message.speaker === "agent"
                    ? "bg-sky-500/10 text-sky-50 border border-sky-500/10"
                    : "ml-auto bg-white/10 text-white"
                }`}
              >
                <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-mist">
                  {message.speaker === "agent" ? "LiveLens" : "You"}
                </div>
                <div className="leading-relaxed">{message.text}</div>
              </div>
            ))}

            {checklist.length > 0 && (
              <div className="my-2 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-mist">Progress</div>
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 text-sm">
                      {item.completed ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-glow" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-mist" />
                      )}
                      <span className={item.completed ? "text-white/70 line-through" : "text-white"}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {suggestedAction && (
              <div className="rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-300/15 to-coral/10 p-4">
                <div className="mb-1 text-xs uppercase tracking-[0.2em] text-amber-200/80">
                  Action proposed
                </div>
                <div className="text-sm font-medium text-amber-50">{suggestedAction.reason}</div>
                <div className="mt-2 rounded-xl border border-amber-200/15 bg-black/20 p-3 text-sm text-amber-50/90 space-y-1">
                  <div><span className="text-amber-200/60">Action:</span> {suggestedAction.type}</div>
                  <div><span className="text-amber-200/60">Target:</span> {suggestedAction.target}</div>
                  {suggestedAction.value && (
                    <div><span className="text-amber-200/60">Value:</span> {suggestedAction.value}</div>
                  )}
                </div>
                <div className="mt-3 text-xs text-amber-100/60">
                  LiveLens only executes after your explicit approval.
                </div>
                <div className="mt-3 flex gap-3">
                  <button
                    className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60 hover:bg-amber-200 transition"
                    disabled={confirming}
                    onClick={() => onConfirmAction(true)}
                    type="button"
                  >
                    {confirming ? "Executing…" : "Approve & execute"}
                  </button>
                  <button
                    className="rounded-full border border-white/15 px-4 py-2 text-sm text-white disabled:opacity-60 hover:border-white/30 transition"
                    disabled={confirming}
                    onClick={() => onConfirmAction(false)}
                    type="button"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {phase === "thinking" && (
          <div className="flex items-center gap-2 text-sm text-mist py-1">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-glow animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-glow animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-glow animate-bounce [animation-delay:300ms]" />
            </span>
            LiveLens is thinking…
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add livelens/frontend/components/conversation-panel.tsx
  git commit -m "refactor: redesign ConversationPanel with inline checklist, action card, thinking indicator"
  ```

---

### Task 5: Redesign screen-panel.tsx

**Files:**
- Modify: `livelens/frontend/components/screen-panel.tsx`

- [ ] **Step 1: Replace the entire content of `screen-panel.tsx`**

  ```tsx
  "use client";

  import { DragEvent, useRef, useState } from "react";
  import { ImagePlus, Loader2 } from "lucide-react";

  interface ScreenPanelProps {
    previewImageUrl?: string | null;
    summary?: string | null;
    loading?: boolean;
    onUpload: (file: File) => Promise<void>;
    compact?: boolean;
  }

  export function ScreenPanel({
    previewImageUrl,
    summary,
    loading = false,
    onUpload,
    compact = false,
  }: ScreenPanelProps) {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    function handleDragOver(e: DragEvent) {
      e.preventDefault();
      setDragging(true);
    }

    function handleDragLeave() {
      setDragging(false);
    }

    async function handleDrop(e: DragEvent) {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) {
        await onUpload(file);
      }
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (file) await onUpload(file);
    }

    if (previewImageUrl && !loading) {
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Uploaded screenshot" className="w-full object-cover" src={previewImageUrl} />
          </div>
          {summary && (
            <div className="rounded-xl bg-white/[0.03] border border-white/8 px-4 py-3 text-xs leading-5 text-mist">
              {summary}
            </div>
          )}
          <button
            className="text-xs text-mist/60 underline underline-offset-2 hover:text-mist transition"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            Upload a different screenshot
          </button>
          <input accept="image/*" className="hidden" onChange={handleFileChange} ref={inputRef} type="file" />
        </div>
      );
    }

    return (
      <div
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition cursor-pointer
          ${dragging ? "border-glow bg-glow/10" : "border-white/15 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]"}
          ${compact ? "py-8 px-6" : "py-16 px-8"}
        `}
        onClick={() => inputRef.current?.click()}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input accept="image/*" className="hidden" onChange={handleFileChange} ref={inputRef} type="file" />
        {loading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-glow mb-3" />
            <p className="text-sm text-mist">Analyzing screenshot…</p>
          </>
        ) : (
          <>
            <ImagePlus className={`text-glow/60 mb-3 ${compact ? "h-7 w-7" : "h-10 w-10"}`} />
            <p className={`font-medium text-white text-center ${compact ? "text-sm" : "text-base"}`}>
              Drop a screenshot here
            </p>
            <p className="mt-1 text-xs text-mist text-center">or click to browse</p>
          </>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add livelens/frontend/components/screen-panel.tsx
  git commit -m "refactor: redesign ScreenPanel with drag-drop zone and compact mode prop"
  ```

---

### Task 6: Update voice-controls.tsx to render only a mic button

**Files:**
- Modify: `livelens/frontend/components/voice-controls.tsx`

- [ ] **Step 1: Replace the entire content of `voice-controls.tsx`**

  ```tsx
  "use client";

  import { useEffect, useRef, useState } from "react";
  import { Mic, MicOff } from "lucide-react";
  import { AgentPhase } from "@/lib/types";

  type SpeechRecognitionCtor = new () => SpeechRecognition;

  declare global {
    interface Window {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    }

    interface SpeechRecognition extends EventTarget {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      stop: () => void;
      onresult: ((event: SpeechRecognitionEvent) => void) | null;
      onend: (() => void) | null;
    }

    interface SpeechRecognitionEvent {
      results: any;
    }
  }

  interface VoiceControlsProps {
    phase: AgentPhase;
    latestAgentMessage?: string;
    onTranscript: (text: string) => Promise<void>;
    disabled?: boolean;
  }

  export function VoiceControls({
    phase,
    latestAgentMessage,
    onTranscript,
    disabled = false,
  }: VoiceControlsProps) {
    const [supported, setSupported] = useState(false);
    const [listening, setListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    useEffect(() => {
      const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!Recognition) return;

      setSupported(true);
      const recognition = new Recognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = async (event) => {
        const text = Array.from(event.results as any[])
          .map((result: any) => result[0].transcript)
          .join(" ")
          .trim();
        if (text) await onTranscript(text);
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
    }, [onTranscript]);

    useEffect(() => {
      if (!latestAgentMessage || typeof window === "undefined") return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(latestAgentMessage);
      utterance.rate = 1.03;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }, [latestAgentMessage]);

    function toggle() {
      if (!recognitionRef.current) return;
      if (listening) {
        recognitionRef.current.stop();
        window.speechSynthesis.cancel();
        setListening(false);
      } else {
        window.speechSynthesis.cancel();
        recognitionRef.current.start();
        setListening(true);
      }
    }

    if (!supported) return null;

    return (
      <button
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition
          ${listening
            ? "bg-coral/20 border border-coral/50 text-coral animate-pulse"
            : "bg-white/8 border border-white/15 text-glow hover:bg-white/12"
          }
          disabled:opacity-40 disabled:cursor-not-allowed
        `}
        disabled={disabled || phase === "thinking"}
        onClick={toggle}
        title={listening ? "Stop listening" : "Speak your question"}
        type="button"
      >
        {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add livelens/frontend/components/voice-controls.tsx
  git commit -m "refactor: simplify VoiceControls to compact mic button"
  ```

---

### Task 7: Rewrite session/page.tsx

**Files:**
- Modify: `livelens/frontend/app/session/page.tsx`

- [ ] **Step 1: Replace the entire content of `session/page.tsx`**

  ```tsx
  "use client";

  import { useCallback, useEffect, useMemo, useRef, useState } from "react";
  import Link from "next/link";
  import { ArrowLeft, Send, Loader2, CheckCircle2, FileText } from "lucide-react";
  import { ConversationPanel } from "@/components/conversation-panel";
  import { ScreenPanel } from "@/components/screen-panel";
  import { VoiceControls } from "@/components/voice-controls";
  import { VoiceOrb } from "@/components/voice-orb";
  import {
    confirmAction,
    finalizeSession,
    sendUtterance,
    startSession,
    uploadScreenshot,
  } from "@/lib/api";
  import { SessionState } from "@/lib/types";

  const initialState: SessionState = {
    session_id: "",
    mode: "assist",
    phase: "idle",
    transcript: [],
    checklist: [],
    action_log: [],
    screen_summary: "",
    suggested_action: null,
    latest_summary: null,
    preview_image_url: null,
  };

  export default function SessionPage() {
    const [state, setState] = useState<SessionState>(initialState);
    const [error, setError] = useState<string | null>(null);
    const [booting, setBooting] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const latestAgentMessage = useMemo(
      () => [...state.transcript].reverse().find((m) => m.speaker === "agent")?.text,
      [state.transcript]
    );

    const hasActivity = state.transcript.length > 1 || !!state.preview_image_url;
    const isFinalized = !!state.latest_summary;
    const isBusy = state.phase === "thinking" || isUploading || booting;

    const bootSession = useCallback(async () => {
      setBooting(true);
      setError(null);
      try {
        const next = await startSession();
        setState(next);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBooting(false);
      }
    }, []);

    useEffect(() => { void bootSession(); }, [bootSession]);

    const recoverSession = useCallback(async (err: unknown): Promise<boolean> => {
      if (err instanceof Error && err.message.toLowerCase().includes("session not found")) {
        await bootSession();
        setError("Session expired. A new session was started.");
        return true;
      }
      return false;
    }, [bootSession]);

    async function handleUpload(file: File) {
      if (!state.session_id) return;
      setError(null);
      setIsUploading(true);
      setState((s) => ({ ...s, phase: "thinking" }));
      try {
        const next = await uploadScreenshot(state.session_id, file);
        setState(next);
      } catch (err) {
        if (await recoverSession(err)) return;
        setError((err as Error).message);
        setState((s) => ({ ...s, phase: "idle" }));
      } finally {
        setIsUploading(false);
      }
    }

    const handleSend = useCallback(async (text: string) => {
      if (!state.session_id || !text.trim()) return;
      setError(null);
      setState((s) => ({
        ...s,
        phase: "listening",
        transcript: [
          ...s.transcript,
          { id: crypto.randomUUID(), speaker: "user", text, created_at: new Date().toISOString() },
        ],
      }));
      try {
        const next = await sendUtterance(state.session_id, text);
        setState(next);
      } catch (err) {
        if (await recoverSession(err)) return;
        setError((err as Error).message);
        setState((s) => ({ ...s, phase: "idle" }));
      }
    }, [state.session_id, recoverSession]);

    async function handleConfirmAction(approved: boolean) {
      if (!state.session_id) return;
      setIsConfirming(true);
      try {
        const next = await confirmAction(state.session_id, approved);
        setState(next);
      } catch (err) {
        if (await recoverSession(err)) return;
        setError((err as Error).message);
      } finally {
        setIsConfirming(false);
      }
    }

    async function handleFinalize() {
      if (!state.session_id) return;
      setIsFinalizing(true);
      try {
        const next = await finalizeSession(state.session_id);
        setState(next);
      } catch (err) {
        if (await recoverSession(err)) return;
        setError((err as Error).message);
      } finally {
        setIsFinalizing(false);
      }
    }

    async function handleInputSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!inputValue.trim() || isSubmitting) return;
      const text = inputValue.trim();
      setInputValue("");
      setIsSubmitting(true);
      try {
        await handleSend(text);
      } finally {
        setIsSubmitting(false);
      }
    }

    return (
      <main className="flex h-screen flex-col overflow-hidden bg-slate-950">
        {/* Top bar */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-4">
            <Link
              className="flex items-center gap-1.5 text-sm text-mist hover:text-white transition"
              href="/"
            >
              <ArrowLeft className="h-4 w-4" />
              LiveLens
            </Link>
            {!booting && (
              <div className="flex items-center gap-2">
                <VoiceOrb phase={state.phase} />
                <span className="text-xs text-mist capitalize">{state.phase.replace("_", " ")}</span>
              </div>
            )}
          </div>

          {hasActivity && !isFinalized && (
            <button
              className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white hover:border-white/30 transition disabled:opacity-50"
              disabled={isBusy || isFinalizing}
              onClick={handleFinalize}
              type="button"
            >
              {isFinalizing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Finalizing…</>
              ) : (
                <><FileText className="h-4 w-4" /> Wrap up session</>
              )}
            </button>
          )}
        </header>

        {/* Error banner */}
        {error && (
          <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-3 bg-red-500/10 border-b border-red-400/20 text-sm text-red-100">
            <span>{error}</span>
            <button
              className="rounded-full border border-red-200/30 px-3 py-1 text-xs font-semibold"
              onClick={bootSession}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {/* Finalized summary view */}
        {isFinalized ? (
          <div className="flex-1 overflow-y-auto px-6 py-8 max-w-3xl mx-auto w-full">
            <div className="glass-panel rounded-[2rem] p-8">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-6 w-6 text-glow" />
                <h2 className="text-xl font-semibold">Session complete</h2>
              </div>
              <p className="text-sm leading-7 text-slate-300 whitespace-pre-wrap">{state.latest_summary}</p>

              {state.checklist.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm uppercase tracking-[0.2em] text-mist mb-4">Checklist</h3>
                  <div className="space-y-2">
                    {state.checklist.map((item) => (
                      <div key={item.id} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-shrink-0 ${item.completed ? "text-glow" : "text-mist/40"}`} />
                        <span className={item.completed ? "text-white/70" : "text-white/40"}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8">
                <Link
                  className="rounded-full bg-glow px-6 py-3 text-sm font-semibold text-slate-950 hover:opacity-90 transition"
                  href="/"
                >
                  Start a new session
                </Link>
              </div>
            </div>
          </div>

        ) : !hasActivity ? (
          /* Empty state — no screenshot yet, only initial greeting */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-2xl mx-auto w-full gap-8">
            {booting ? (
              <Loader2 className="h-8 w-8 animate-spin text-glow" />
            ) : (
              <>
                <div className="text-center">
                  <p className="text-lg font-medium text-white">
                    {latestAgentMessage ?? "Upload a screenshot or describe what you need."}
                  </p>
                  <p className="mt-2 text-sm text-mist">
                    LiveLens reads what's on screen and guides you through it in real time.
                  </p>
                </div>
                <ScreenPanel
                  loading={isUploading}
                  onUpload={handleUpload}
                  previewImageUrl={state.preview_image_url}
                  summary={state.screen_summary}
                />
                <p className="text-xs text-mist/60">or start by typing below</p>
              </>
            )}
          </div>

        ) : (
          /* Active session — 2-column layout */
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Left: screenshot panel */}
            <div className="hidden md:flex w-72 lg:w-96 flex-shrink-0 flex-col border-r border-white/8 overflow-y-auto p-5 gap-4">
              <ScreenPanel
                compact
                loading={isUploading}
                onUpload={handleUpload}
                previewImageUrl={state.preview_image_url}
                summary={state.screen_summary}
              />
            </div>

            {/* Right: conversation thread */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 pt-4 pb-0">
              <ConversationPanel
                checklist={state.checklist}
                confirming={isConfirming}
                loading={booting}
                messages={state.transcript}
                onConfirmAction={handleConfirmAction}
                phase={state.phase}
                suggestedAction={state.suggested_action}
              />
            </div>
          </div>
        )}

        {/* Bottom input bar — always visible except when finalized */}
        {!isFinalized && (
          <div className="flex-shrink-0 border-t border-white/8 px-4 py-4">
            <form className="flex items-center gap-3 max-w-4xl mx-auto" onSubmit={handleInputSubmit}>
              <VoiceControls
                disabled={isBusy}
                latestAgentMessage={latestAgentMessage}
                onTranscript={handleSend}
                phase={state.phase}
              />
              <input
                className="flex-1 rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm text-white outline-none placeholder:text-mist focus:border-glow/40 transition"
                disabled={isBusy}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  state.phase === "awaiting_confirmation"
                    ? "Approve or decline the action above, or ask a follow-up…"
                    : "Ask what a field means, what to do next, or anything else…"
                }
                ref={inputRef}
                value={inputValue}
              />
              <button
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-glow text-slate-950 hover:opacity-90 transition disabled:opacity-40"
                disabled={!inputValue.trim() || isSubmitting || isBusy}
                type="submit"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        )}
      </main>
    );
  }
  ```

- [ ] **Step 2: Run TypeScript check — must pass cleanly**

  ```bash
  cd livelens/frontend && npx tsc --noEmit 2>&1
  ```
  Expected: clean output (no errors in session/page.tsx or the components it imports)

- [ ] **Step 3: Commit**

  ```bash
  git add livelens/frontend/app/session/page.tsx
  git commit -m "feat: redesign session page with 3-state flow and unified bottom input bar"
  ```

---

### Task 8: Rewrite landing page (app/page.tsx)

**Files:**
- Modify: `livelens/frontend/app/page.tsx`

- [ ] **Step 1: Replace the entire content of `app/page.tsx`**

  ```tsx
  import Link from "next/link";

  const useCases = [
    {
      icon: "🧾",
      category: "Tax & Finance",
      example: "Confused by a 1099-NEC field? Upload the screen and ask.",
    },
    {
      icon: "🌐",
      category: "Visa & Government",
      example: "Stuck in an immigration portal? Get clear, step-by-step help.",
    },
    {
      icon: "🏥",
      category: "Healthcare & Insurance",
      example: "Lost in a benefits enrollment form? Let LiveLens walk you through it.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Upload a screenshot",
      body: "Drop a screenshot of the page where you're stuck. LiveLens reads what's visible on screen.",
    },
    {
      number: "02",
      title: "Ask in voice or text",
      body: "Say what you need help with. LiveLens answers based on exactly what it sees.",
    },
    {
      number: "03",
      title: "Follow guided steps",
      body: "Get clear guidance and optionally let LiveLens propose safe actions — confirmed by you first.",
    },
  ];

  export default function HomePage() {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
        {/* Hero */}
        <div className="glass-panel glow-ring relative overflow-hidden rounded-[2rem] px-8 py-14 shadow-neon text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(143,255,209,0.15),transparent_33%),radial-gradient(circle_at_bottom_left,rgba(255,141,122,0.12),transparent_30%)]" />
          <div className="relative z-10">
            <div className="mb-5 inline-flex rounded-full border border-glow/30 bg-glow/10 px-4 py-2 text-sm text-glow">
              Voice-first · Screenshot-grounded · Safe automation
            </div>
            <h1 className="text-5xl font-semibold tracking-tight text-white md:text-6xl">
              Stop getting lost<br className="hidden md:block" /> in complex online forms.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              LiveLens is your real-time voice copilot for any confusing digital task.
              Upload a screenshot, ask your question, and get grounded guidance instantly.
            </p>
            <div className="mt-10">
              <Link
                className="rounded-full bg-glow px-8 py-4 text-base font-semibold text-slate-950 transition hover:opacity-90 shadow-neon"
                href="/session"
              >
                Start a session →
              </Link>
            </div>
          </div>
        </div>

        {/* Use cases */}
        <div className="mt-12">
          <h2 className="mb-6 text-center text-sm uppercase tracking-[0.3em] text-mist">
            Built for high-friction workflows
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {useCases.map((uc) => (
              <div className="glass-panel glow-ring rounded-[1.75rem] p-6" key={uc.category}>
                <div className="mb-3 text-3xl">{uc.icon}</div>
                <h3 className="text-lg font-semibold text-white">{uc.category}</h3>
                <p className="mt-2 text-sm leading-6 text-mist">{uc.example}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-14">
          <h2 className="mb-8 text-center text-sm uppercase tracking-[0.3em] text-mist">
            How it works
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div className="flex gap-4" key={step.number}>
                <div className="flex-shrink-0 text-3xl font-bold text-glow/30 leading-none">
                  {step.number}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-mist">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 text-center">
          <Link
            className="text-sm text-glow/70 underline underline-offset-4 hover:text-glow transition"
            href="/session"
          >
            Get started now — no setup required
          </Link>
        </div>
      </main>
    );
  }
  ```

- [ ] **Step 2: Run TypeScript check**

  ```bash
  cd livelens/frontend && npx tsc --noEmit 2>&1
  ```
  Expected: clean output

- [ ] **Step 3: Commit**

  ```bash
  git add livelens/frontend/app/page.tsx
  git commit -m "feat: redesign landing page with use cases and how-it-works section"
  ```

---

## Chunk 4: Delete Unused Files

> **These deletions happen AFTER the session page rewrite (Chunk 3) so that TypeScript stays valid throughout.**

### Task 9: Delete unused components and demo docs

**Files:**
- Delete: `livelens/frontend/components/mode-switcher.tsx`
- Delete: `livelens/frontend/components/action-log-panel.tsx`
- Delete: `livelens/frontend/components/checklist-panel.tsx` (checklist is now inline in ConversationPanel)
- Delete: `livelens/frontend/components/summary-panel.tsx` (summary is inline in session page)
- Delete: `livelens/frontend/components/status-pill.tsx` (status shown via VoiceOrb in header)
- Delete: `docs/demo-script.md`
- Delete: `docs/sample-seeded-session.json`

- [ ] **Step 1: Verify no remaining imports of components to be deleted**

  ```bash
  grep -r "mode-switcher\|action-log-panel\|checklist-panel\|summary-panel\|status-pill" \
    livelens/frontend/app livelens/frontend/components
  ```
  Expected: no output (zero matches). If matches are found, investigate and resolve before proceeding.

- [ ] **Step 2: Delete unused component files**

  ```bash
  rm livelens/frontend/components/mode-switcher.tsx \
     livelens/frontend/components/action-log-panel.tsx \
     livelens/frontend/components/checklist-panel.tsx \
     livelens/frontend/components/summary-panel.tsx \
     livelens/frontend/components/status-pill.tsx
  ```

- [ ] **Step 3: Delete demo docs (if they exist)**

  ```bash
  rm -f docs/demo-script.md docs/sample-seeded-session.json
  ```

- [ ] **Step 4: Verify TypeScript still compiles cleanly after deletions**

  ```bash
  cd livelens/frontend && npx tsc --noEmit 2>&1
  ```
  Expected: clean output

- [ ] **Step 5: Commit**

  ```bash
  git add -u livelens/frontend/components/ docs/
  git commit -m "chore: delete unused components (mode-switcher, action-log, checklist, summary, status-pill) and demo docs"
  ```

---

### Task 10: Update README to remove demo references

**Files:**
- Modify: `livelens/README.md`

- [ ] **Step 1: Search for demo-specific language**

  ```bash
  grep -n "seed-demo\|magic demo\|Load 60-second\|demo script\|Judge mode\|seeded" livelens/README.md
  ```

- [ ] **Step 2: Remove or rewrite each matched section**

  For each match:
  - Remove the "Load 60-second magic demo" instructions entirely
  - Replace demo-flow documentation with the real session flow:
    1. Go to `/session`
    2. Upload a screenshot of where you're stuck
    3. Ask in voice or text
    4. Follow guided steps — approve any proposed actions
  - Remove any mention of the `/api/sessions/{id}/seed-demo` endpoint from the API route list
  - Remove mention of the `/api/sessions/{id}/mode` endpoint if listed

- [ ] **Step 3: Commit**

  ```bash
  git add README.md
  git commit -m "docs: remove demo references from README, document real session flow"
  ```
