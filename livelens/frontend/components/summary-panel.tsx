interface SummaryPanelProps {
  summary?: string | null;
  loading?: boolean;
}

export function SummaryPanel({ summary, loading = false }: SummaryPanelProps) {
  return (
    <section className="glass-panel rounded-3xl p-5">
      <h3 className="mb-4 text-lg font-semibold">Session Summary</h3>
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-mist">
        {loading
          ? "Building summary..."
          : summary ?? "Finalize the session to generate a crisp recap, remaining tasks, and blockers."}
      </div>
    </section>
  );
}
