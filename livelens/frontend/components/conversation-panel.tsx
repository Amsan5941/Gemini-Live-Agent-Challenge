"use client";

import { FormEvent, useState } from "react";
import { Mic, Send, Square, Volume2 } from "lucide-react";
import { AgentMessage, AgentPhase, SuggestedAction } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";

interface ConversationPanelProps {
  messages: AgentMessage[];
  phase: AgentPhase;
  suggestedAction?: SuggestedAction | null;
  loading?: boolean;
  onSend: (text: string) => Promise<void>;
  onConfirmAction: (approved: boolean) => Promise<void>;
}

export function ConversationPanel({
  messages,
  phase,
  suggestedAction,
  loading = false,
  onSend,
  onConfirmAction
}: ConversationPanelProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      await onSend(value.trim());
      setValue("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Live Conversation</h3>
          <p className="text-sm text-mist">Voice-first UX with text fallback for the MVP demo path.</p>
        </div>
        <StatusPill phase={phase} />
      </div>

      <div className="mb-4 h-[320px] space-y-3 overflow-y-auto rounded-3xl border border-white/8 bg-slate-950/30 p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-14 w-2/3 animate-pulse rounded-2xl bg-white/10" />
            <div className="ml-auto h-12 w-1/2 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-16 w-3/4 animate-pulse rounded-2xl bg-white/10" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-mist">
            LiveLens is ready. Ask your first question or use voice input.
          </div>
        ) : messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              message.speaker === "agent"
                ? "bg-sky-500/10 text-sky-50"
                : "ml-auto bg-white/10 text-white"
            }`}
          >
            <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-mist">{message.speaker}</div>
            <div>{message.text}</div>
          </div>
        ))}
      </div>

      {suggestedAction ? (
        <div className="mb-4 rounded-3xl border border-amber-300/40 bg-gradient-to-r from-amber-300/20 to-coral/10 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-semibold text-amber-100">Confirm safe action</div>
            <div className="rounded-full border border-amber-200/30 bg-amber-100/10 px-3 py-1 text-xs text-amber-100">
              Act Mode
            </div>
          </div>
          <div className="mt-2 text-sm text-amber-50">
            {suggestedAction.reason}
          </div>
          <div className="mt-2 rounded-2xl border border-amber-200/20 bg-black/20 p-3 text-sm text-amber-50">
            <div>
              <span className="text-amber-200/80">Action:</span> {suggestedAction.type}
            </div>
            <div>
              <span className="text-amber-200/80">Target:</span> {suggestedAction.target}
            </div>
            {suggestedAction.value ? (
              <div>
                <span className="text-amber-200/80">Value:</span> {suggestedAction.value}
              </div>
            ) : null}
          </div>
          <div className="mt-3 text-xs text-amber-100/80">
            LiveLens only executes low-risk actions after approval. If the target is ambiguous, execution is cancelled.
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              disabled={confirming}
              onClick={async () => {
                setConfirming(true);
                try {
                  await onConfirmAction(true);
                } finally {
                  setConfirming(false);
                }
              }}
              type="button"
            >
              {confirming ? "Confirming..." : "Approve and execute"}
            </button>
            <button
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white disabled:opacity-60"
              disabled={confirming}
              onClick={async () => {
                setConfirming(true);
                try {
                  await onConfirmAction(false);
                } finally {
                  setConfirming(false);
                }
              }}
              type="button"
            >
              Deny action
            </button>
          </div>
        </div>
      ) : null}

      <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSubmit}>
        <div className="flex flex-1 items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3">
          <Mic className="h-4 w-4 text-glow" />
          <input
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-mist"
          disabled={loading}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ask LiveLens what this field means, what to do next, or whether to confirm a step."
          value={value}
        />
          {phase === "speaking" ? <Volume2 className="h-4 w-4 text-sky-300" /> : <Square className="h-4 w-4 text-mist" />}
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-full bg-glow px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
          disabled={submitting || loading}
          type="submit"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </form>
    </section>
  );
}
