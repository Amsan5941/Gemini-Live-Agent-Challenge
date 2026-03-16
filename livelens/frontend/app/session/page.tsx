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
