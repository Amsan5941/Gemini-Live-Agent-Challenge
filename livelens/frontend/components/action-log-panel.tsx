import { ActionLogItem } from "@/lib/types";

export function ActionLogPanel({ items }: { items: ActionLogItem[] }) {
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

