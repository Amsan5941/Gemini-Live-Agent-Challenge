export function SummaryPanel({ summary }: { summary?: string | null }) {
  return (
    <section className="glass-panel rounded-3xl p-5">
      <h3 className="mb-4 text-lg font-semibold">Session Summary</h3>
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-mist">
        {summary ?? "Finalize the session to generate a crisp recap, remaining tasks, and blockers."}
      </div>
    </section>
  );
}

