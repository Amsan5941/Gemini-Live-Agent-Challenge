import { ChecklistItem } from "@/lib/types";

interface ChecklistPanelProps {
  items: ChecklistItem[];
  loading?: boolean;
}

export function ChecklistPanel({ items, loading = false }: ChecklistPanelProps) {
  if (loading) {
    return (
      <section className="glass-panel rounded-3xl p-5">
        <div className="mb-4 h-6 w-28 animate-pulse rounded bg-white/10" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3" key={index}>
              <div className="h-3 w-3 animate-pulse rounded-full bg-white/20" />
              <div className="mt-2 h-4 w-40 animate-pulse rounded bg-white/10" />
              <div className="mt-2 h-3 w-56 animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Checklist</h3>
        <span className="text-sm text-mist">{items.filter((item) => item.completed).length}/{items.length}</span>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-mist">
            No checklist yet. Start a session or run the 60-second demo seed.
          </div>
        ) : items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <div className="flex items-start gap-3">
              <div className={`mt-1 h-3 w-3 rounded-full ${item.completed ? "bg-glow" : "bg-white/20"}`} />
              <div>
                <div className="font-medium">{item.label}</div>
                {item.detail ? <div className="mt-1 text-sm text-mist">{item.detail}</div> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
