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
