"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { ActionLogPanel } from "@/components/action-log-panel";
import { ChecklistPanel } from "@/components/checklist-panel";
import { ConversationPanel } from "@/components/conversation-panel";
import { ModeSwitcher } from "@/components/mode-switcher";
import { ScreenPanel } from "@/components/screen-panel";
import { SummaryPanel } from "@/components/summary-panel";
import { VoiceControls } from "@/components/voice-controls";
import { VoiceOrb } from "@/components/voice-orb";
import {
  confirmAction,
  finalizeSession,
  seedDemoSession,
  sendUtterance,
  startSession,
  updateMode,
  uploadScreenshot
} from "@/lib/api";
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
  const [booting, setBooting] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const latestAgentMessage = useMemo(
    () => [...state.transcript].reverse().find((message) => message.speaker === "agent")?.text,
    [state.transcript]
  );

  const bootSession = useCallback(async () => {
    setBooting(true);
    setError(null);
    try {
      const next = await startSession("assist");
      setState(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void bootSession();
  }, [bootSession]);

  const isSessionMissingError = useCallback((err: unknown) => {
    return err instanceof Error && err.message.toLowerCase().includes("session not found");
  }, []);

  const recoverMissingSession = useCallback(async () => {
    await bootSession();
    setError("Session expired after a backend restart. A new session was started.");
  }, [bootSession]);

  async function handleUpload(file: File) {
    if (!state.session_id) {
      return;
    }

    setError(null);
    setIsUploading(true);
    setState((current) => ({ ...current, phase: "thinking" }));
    try {
      const next = await uploadScreenshot(state.session_id, file);
      setState(next);
    } catch (err) {
      if (isSessionMissingError(err)) {
        await recoverMissingSession();
        return;
      }
      setError((err as Error).message);
      setState((current) => ({ ...current, phase: "idle" }));
    } finally {
      setIsUploading(false);
    }
  }

  const handleSend = useCallback(async (text: string) => {
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
      if (isSessionMissingError(err)) {
        await recoverMissingSession();
        return;
      }
      setError((err as Error).message);
      setState((current) => ({ ...current, phase: "idle" }));
    }
  }, [state.session_id]);

  async function handleModeChange(mode: SessionMode) {
    if (!state.session_id) {
      return;
    }

    try {
      const next = await updateMode(state.session_id, mode);
      setState(next);
    } catch (err) {
      if (isSessionMissingError(err)) {
        await recoverMissingSession();
        return;
      }
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
      if (isSessionMissingError(err)) {
        await recoverMissingSession();
        return;
      }
      setError((err as Error).message);
    }
  }

  async function handleFinalize() {
    if (!state.session_id) {
      return;
    }

    setIsFinalizing(true);
    try {
      const next = await finalizeSession(state.session_id);
      setState(next);
    } catch (err) {
      if (isSessionMissingError(err)) {
        await recoverMissingSession();
        return;
      }
      setError((err as Error).message);
    } finally {
      setIsFinalizing(false);
    }
  }

  async function handleSeedDemo() {
    if (!state.session_id) {
      return;
    }

    setIsSeeding(true);
    setError(null);
    try {
      const next = await seedDemoSession(state.session_id);
      setState(next);
    } catch (err) {
      if (isSessionMissingError(err)) {
        await recoverMissingSession();
        return;
      }
      setError((err as Error).message);
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 py-6 md:px-6">
      <div className="mb-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-glow">LiveLens Session</div>
            <h1 className="mt-2 text-3xl font-semibold">Voice-first workflow copilot</h1>
            <p className="mt-2 max-w-3xl text-sm text-mist">
              Judge mode: click one button to load a polished, voice-first happy path in under 60 seconds.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-glow/40 bg-glow/10 px-4 py-2 text-sm text-glow transition hover:bg-glow/15 disabled:opacity-60"
              disabled={booting || isSeeding}
              onClick={handleSeedDemo}
              type="button"
            >
              <Sparkles className="h-4 w-4" />
              {isSeeding ? "Seeding magic demo..." : "Load 60-second magic demo"}
            </button>
            <button
              className="rounded-full bg-coral px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
              disabled={booting || isFinalizing}
              onClick={handleFinalize}
              type="button"
            >
              {isFinalizing ? "Finalizing..." : "Finalize summary"}
            </button>
          </div>
        </div>
      </div>

      <ModeSwitcher mode={state.mode} onChange={handleModeChange} />

      {error ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <span>{error}</span>
          <button
            className="rounded-full border border-red-200/30 px-3 py-1 text-xs font-semibold text-red-100"
            onClick={bootSession}
            type="button"
          >
            Retry session
          </button>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.9fr_0.9fr]">
        <div className="space-y-6">
          <ConversationPanel
            loading={booting}
            messages={state.transcript}
            onConfirmAction={handleConfirmAction}
            onSend={handleSend}
            phase={state.phase}
            suggestedAction={state.suggested_action}
          />
          <SummaryPanel loading={isFinalizing} summary={state.latest_summary} />
        </div>
        <div className="space-y-6">
          <ScreenPanel
            loading={isUploading || booting}
            onUpload={handleUpload}
            previewImageUrl={state.preview_image_url}
            summary={state.screen_summary}
          />
        </div>
        <div className="space-y-6">
          <VoiceOrb phase={state.phase} />
          <VoiceControls latestAgentMessage={latestAgentMessage} onTranscript={handleSend} phase={state.phase} />
          <ChecklistPanel items={state.checklist} loading={booting || isSeeding} />
          <ActionLogPanel items={state.action_log} loading={booting || isSeeding} />
        </div>
      </div>
    </main>
  );
}
