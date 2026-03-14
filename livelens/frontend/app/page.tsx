import Link from "next/link";

const highlights = [
  {
    title: "Grounded Vision",
    body: "Analyzes what is visible now: fields, required markers, warnings, and blockers."
  },
  {
    title: "Voice-First Flow",
    body: "Natural spoken guidance with interruption-friendly state and fast text fallback."
  },
  {
    title: "Safe Automation",
    body: "Observe, Assist, and Act modes with explicit confirmation before browser actions."
  }
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <div className="glass-panel glow-ring relative overflow-hidden rounded-[2rem] px-8 py-10 shadow-neon">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(143,255,209,0.15),transparent_33%),radial-gradient(circle_at_bottom_left,rgba(255,141,122,0.14),transparent_30%)]" />
        <div className="relative z-10">
          <div className="mb-4 inline-flex rounded-full border border-glow/30 bg-glow/10 px-4 py-2 text-sm text-glow">
            Gemini Live Agent Challenge
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white md:text-6xl">
            LiveLens
          </h1>
          <p className="mt-4 max-w-2xl text-xl text-slate-200">
            Your voice-first copilot for confusing online tasks.
          </p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-mist">
            LiveLens helps users finish high-friction forms by seeing the current screen, answering naturally in voice,
            guiding step by step, and safely executing low-risk actions only after confirmation.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              className="rounded-full bg-glow px-6 py-3 font-semibold text-slate-950 transition hover:opacity-90"
              href="/session"
            >
              Start live session
            </Link>
            <a
              className="rounded-full border border-white/10 px-6 py-3 font-semibold text-white transition hover:border-white/20"
              href="https://cloud.google.com"
              rel="noreferrer"
              target="_blank"
            >
              Built for Google Cloud
            </a>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {highlights.map((card) => (
          <div className="glass-panel glow-ring rounded-[1.75rem] p-6" key={card.title}>
            <h2 className="text-xl font-semibold">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-mist">{card.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
