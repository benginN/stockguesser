const MODES = [
  { id: "daily-ticker", label: "Daily Ticker", tag: "one mystery stock, six guesses" },
  { id: "recall", label: "Index Recall", tag: "name every constituent" },
  { id: "cap-battle", label: "Cap Battle", tag: "higher or lower, one life" },
] as const;

export default function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-10 px-4 py-12">
      <header className="text-center">
        <p className="font-data text-terminal-dim mb-2 text-xs tracking-[0.3em] uppercase">
          &#9650; Phase 0 &mdash; scaffold live
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Stock<span className="text-accent">Guesser</span>
        </h1>
      </header>

      <ul className="w-full space-y-3">
        {MODES.map((mode) => (
          <li
            key={mode.id}
            className="border-terminal-line bg-terminal-panel flex items-baseline justify-between rounded-md border px-4 py-3"
          >
            <span className="font-semibold">{mode.label}</span>
            <span className="font-data text-terminal-dim text-xs">{mode.tag}</span>
          </li>
        ))}
      </ul>

      <p className="font-data text-terminal-dim text-xs">hello, world &mdash; coming soon</p>
    </main>
  );
}
