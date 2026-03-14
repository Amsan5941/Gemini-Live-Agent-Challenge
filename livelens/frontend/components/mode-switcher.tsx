"use client";

import clsx from "clsx";
import { SessionMode } from "@/lib/types";

const modes: { value: SessionMode; label: string; description: string }[] = [
  { value: "observe", label: "Observe", description: "See and explain only" },
  { value: "assist", label: "Assist", description: "Suggest the next step" },
  { value: "act", label: "Act", description: "Execute safe actions after confirmation" }
];

interface ModeSwitcherProps {
  mode: SessionMode;
  onChange: (mode: SessionMode) => void;
}

export function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  return (
    <div className="glass-panel rounded-3xl p-2 shadow-neon">
      <div className="grid gap-2 md:grid-cols-3">
        {modes.map((item) => (
          <button
            key={item.value}
            className={clsx(
              "rounded-2xl border px-4 py-3 text-left transition",
              mode === item.value
                ? "border-glow bg-glow/15 text-white"
                : "border-white/10 bg-white/[0.03] text-mist hover:border-white/20 hover:text-white"
            )}
            onClick={() => onChange(item.value)}
            type="button"
          >
            <div className="font-semibold">{item.label}</div>
            <div className="mt-1 text-sm opacity-80">{item.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
