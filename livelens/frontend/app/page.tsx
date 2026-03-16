import Link from "next/link";

const useCases = [
  {
    icon: "🧾",
    category: "Tax & Finance",
    example: "Confused by a 1099-NEC field? Upload the screen and ask.",
  },
  {
    icon: "🌐",
    category: "Visa & Government",
    example: "Stuck in an immigration portal? Get clear, step-by-step help.",
  },
  {
    icon: "🏥",
    category: "Healthcare & Insurance",
    example: "Lost in a benefits enrollment form? Let LiveLens walk you through it.",
  },
];

const steps = [
  {
    number: "01",
    title: "Upload a screenshot",
    body: "Drop a screenshot of the page where you're stuck. LiveLens reads what's visible on screen.",
  },
  {
    number: "02",
    title: "Ask in voice or text",
    body: "Say what you need help with. LiveLens answers based on exactly what it sees.",
  },
  {
    number: "03",
    title: "Follow guided steps",
    body: "Get clear guidance and optionally let LiveLens propose safe actions — confirmed by you first.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
      {/* Hero */}
      <div className="glass-panel glow-ring relative overflow-hidden rounded-[2rem] px-8 py-14 shadow-neon text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(143,255,209,0.15),transparent_33%),radial-gradient(circle_at_bottom_left,rgba(255,141,122,0.12),transparent_30%)]" />
        <div className="relative z-10">
          <div className="mb-5 inline-flex rounded-full border border-glow/30 bg-glow/10 px-4 py-2 text-sm text-glow">
            Voice-first · Screenshot-grounded · Safe automation
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-white md:text-6xl">
            Stop getting lost<br className="hidden md:block" /> in complex online forms.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            LiveLens is your real-time voice copilot for any confusing digital task.
            Upload a screenshot, ask your question, and get grounded guidance instantly.
          </p>
          <div className="mt-10">
            <Link
              className="rounded-full bg-glow px-8 py-4 text-base font-semibold text-slate-950 transition hover:opacity-90 shadow-neon"
              href="/session"
            >
              Start a session →
            </Link>
          </div>
        </div>
      </div>

      {/* Use cases */}
      <div className="mt-12">
        <h2 className="mb-6 text-center text-sm uppercase tracking-[0.3em] text-mist">
          Built for high-friction workflows
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {useCases.map((uc) => (
            <div className="glass-panel glow-ring rounded-[1.75rem] p-6" key={uc.category}>
              <div className="mb-3 text-3xl">{uc.icon}</div>
              <h3 className="text-lg font-semibold text-white">{uc.category}</h3>
              <p className="mt-2 text-sm leading-6 text-mist">{uc.example}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="mt-14">
        <h2 className="mb-8 text-center text-sm uppercase tracking-[0.3em] text-mist">
          How it works
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <div className="flex gap-4" key={step.number}>
              <div className="flex-shrink-0 text-3xl font-bold text-glow/30 leading-none">
                {step.number}
              </div>
              <div>
                <h3 className="font-semibold text-white">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-mist">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-16 text-center">
        <Link
          className="text-sm text-glow/70 underline underline-offset-4 hover:text-glow transition"
          href="/session"
        >
          Get started now — no setup required
        </Link>
      </div>
    </main>
  );
}
