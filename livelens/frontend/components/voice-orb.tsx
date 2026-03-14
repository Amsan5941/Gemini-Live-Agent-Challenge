"use client";

import clsx from "clsx";
import { AgentPhase } from "@/lib/types";

export function VoiceOrb({ phase }: { phase: AgentPhase }) {
  return (
    <div className="glass-panel flex items-center justify-center rounded-[2rem] p-6">
      <div
        className={clsx(
          "relative h-28 w-28 rounded-full transition-all duration-500",
          phase === "listening" && "bg-glow/20 shadow-[0_0_80px_rgba(143,255,209,0.35)]",
          phase === "thinking" && "bg-coral/20 shadow-[0_0_80px_rgba(255,141,122,0.25)]",
          phase === "speaking" && "bg-sky-400/20 shadow-[0_0_80px_rgba(56,189,248,0.25)]",
          phase === "awaiting_confirmation" && "bg-amber-300/20 shadow-[0_0_80px_rgba(252,211,77,0.25)]",
          phase === "idle" && "bg-white/10"
        )}
      >
        <div className="absolute inset-4 rounded-full border border-white/20" />
        <div className="absolute inset-8 rounded-full border border-white/30" />
      </div>
    </div>
  );
}

