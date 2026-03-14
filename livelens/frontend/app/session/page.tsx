"use client";

import { useEffect, useState } from "react";
import { ActionLogPanel } from "@/components/action-log-panel";
import { ChecklistPanel } from "@/components/checklist-panel";
import { ConversationPanel } from "@/components/conversation-panel";
import { ModeSwitcher } from "@/components/mode-switcher";
import { ScreenPanel } from "@/components/screen-panel";
import { SummaryPanel } from "@/components/summary-panel";
import { VoiceControls } from "@/components/voice-controls";
import { VoiceOrb } from "@/components/voice-orb";
import { confirmAction, finalizeSession, sendUtterance, startSession, updateMode, uploadScreenshot } from "@/lib/api";
import { SessionMode, SessionState } from "@/lib/types";

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
  preview_image_url: null
};

export default function SessionPage() {
  const [state, setState] = useState<SessionState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const latestAgentMessage = [...state.transcript].reverse().find((message) => message.speaker === "agent")?.text;

  useEffect(() => {
    startSession("assist")
      .then(setState)
      .catch((err: Error) => setError(err.message));
  }, []);

  async function handleUpload(file: File) {
    if (!state.session_id) {
      return;
    }

    setError(null);
    setState((current) => ({ ...current, phase: "thinking" }));
    try {
      const next = await uploadScreenshot(state.session_id, file);
      setState(next);
    } catch (err) {
      setError((err as Error).message);
      setState((current) => ({ ...current, phase: "idle" }));
    }
  }

  async function handleSend(text: string) {
    if (!state.session_id) {
      return;
    }

    setError(null);
    setState((current) => ({
      ...current,
      phase: "listening",
      transcript: [
        ...current.transcript,
        {
          id: crypto.randomUUID(),
          speaker: "user",
          text,
          created_at: new Date().toISOString()
        }
      ]
    }));

    try {
      const next = await sendUtterance(state.session_id, text);
      setState(next);
    } catch (err) {
      setError((err as Error).message);
      setState((current) => ({ ...current, phase: "idle" }));
    }
  }

  async function handleModeChange(mode: SessionMode) {
    if (!state.session_id) {
      return;
    }

    try {
      const next = await updateMode(state.session_id, mode);
      setState(next);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleConfirmAction(approved: boolean) {
    if (!state.session_id) {
      return;
    }

    try {
      const next = await confirmAction(state.session_id, approved);
      setState(next);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleFinalize() {
    if (!state.session_id) {
      return;
    }

    try {
      const next = await finalizeSession(state.session_id);
      setState(next);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.3em] text-glow">LiveLens Session</div>
          <h1 className="mt-2 text-3xl font-semibold">Voice-first workflow copilot</h1>
          <p className="mt-2 max-w-3xl text-sm text-mist">
            Screenshot-first MVP for reliable demos. Upload the current workflow, ask naturally, and switch between
            Observe, Assist, and Act as confidence increases.
          </p>
        </div>
        <button
          className="rounded-full bg-coral px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
          onClick={handleFinalize}
          type="button"
        >
          Finalize summary
        </button>
      </div>

      <ModeSwitcher mode={state.mode} onChange={handleModeChange} />

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.9fr_0.9fr]">
        <div className="space-y-6">
          <ConversationPanel
            messages={state.transcript}
            onConfirmAction={handleConfirmAction}
            onSend={handleSend}
            phase={state.phase}
            suggestedAction={state.suggested_action}
          />
          <SummaryPanel summary={state.latest_summary} />
        </div>
        <div className="space-y-6">
          <ScreenPanel
            onUpload={handleUpload}
            previewImageUrl={state.preview_image_url}
            summary={state.screen_summary}
          />
        </div>
        <div className="space-y-6">
          <VoiceOrb phase={state.phase} />
          <VoiceControls latestAgentMessage={latestAgentMessage} onTranscript={handleSend} phase={state.phase} />
          <ChecklistPanel items={state.checklist} />
          <ActionLogPanel items={state.action_log} />
        </div>
      </div>
    </main>
  );
}
