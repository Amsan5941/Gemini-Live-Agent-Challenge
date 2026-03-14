import { ActionLogItem } from "@/lib/types";

interface ActionLogPanelProps {
  items: ActionLogItem[];
  loading?: boolean;
}

export function ActionLogPanel({ items, loading = false }: ActionLogPanelProps) {
  if (loading) {
    return (
      <section className="glass-panel rounded-3xl p-5">
        <div className="mb-4 h-6 w-28 animate-pulse rounded bg-white/10" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3" key={index}>
              <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="glass-panel rounded-3xl p-5">
      <h3 className="mb-4 text-lg font-semibold">Action Log</h3>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-mist">
            No actions yet. LiveLens will log every suggestion and confirmed browser action here.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-4">
                <div className="font-medium">{item.description}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-mist">{item.status}</div>
              </div>
              <div className="mt-1 text-xs text-mist">{new Date(item.timestamp).toLocaleTimeString()}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
