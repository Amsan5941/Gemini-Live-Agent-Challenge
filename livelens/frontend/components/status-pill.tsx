import clsx from "clsx";
import { AgentPhase } from "@/lib/types";

const labels: Record<AgentPhase, string> = {
  idle: "Waiting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  awaiting_confirmation: "Awaiting confirmation"
};

export function StatusPill({ phase }: { phase: AgentPhase }) {
  return (
    <div
      className={clsx(
        "inline-flex items-center rounded-full border px-3 py-1 text-sm",
        phase === "listening" && "border-glow/50 bg-glow/10 text-glow",
        phase === "thinking" && "border-coral/50 bg-coral/10 text-coral",
        phase === "speaking" && "border-sky-400/50 bg-sky-400/10 text-sky-300",
        phase === "awaiting_confirmation" && "border-amber-400/50 bg-amber-400/10 text-amber-200",
        phase === "idle" && "border-white/10 bg-white/5 text-mist"
      )}
    >
      {labels[phase]}
    </div>
  );
}

