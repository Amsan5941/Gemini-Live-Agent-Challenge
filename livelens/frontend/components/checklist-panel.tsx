import { ChecklistItem } from "@/lib/types";

export function ChecklistPanel({ items }: { items: ChecklistItem[] }) {
  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Checklist</h3>
        <span className="text-sm text-mist">{items.filter((item) => item.completed).length}/{items.length}</span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
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

