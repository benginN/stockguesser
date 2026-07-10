/**
 * App shell: header, mode switcher via ?mode= URL param (Phase-0 decision:
 * zero routing deps), footer. Modes lazy-load their data on mount.
 */
import { useState } from "react";
import DailyTicker from "./modes/daily-ticker/DailyTicker.tsx";
import Recall from "./modes/recall/Recall.tsx";
import CapBattle from "./modes/cap-battle/CapBattle.tsx";
import Country from "./modes/country/Country.tsx";
import ChartDetective from "./modes/chart/ChartDetective.tsx";

const MODES = [
  { id: "daily", label: "Daily Ticker", live: true },
  { id: "recall", label: "Index Recall", live: true },
  { id: "cap-battle", label: "Cap Battle", live: true },
  { id: "country", label: "Country", live: true },
  { id: "chart", label: "Chart Detective", live: true },
] as const;
type ModeId = (typeof MODES)[number]["id"];

function modeFromURL(): ModeId {
  const m = new URLSearchParams(window.location.search).get("mode");
  return (MODES.find((x) => x.id === m && x.live)?.id ?? "daily") as ModeId;
}

export default function App() {
  const [mode, setMode] = useState<ModeId>(modeFromURL);

  const switchMode = (id: ModeId) => {
    setMode(id);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", id);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-4">
      <header className="border-terminal-line mb-4 border-b pb-3">
        <h1 className="text-center text-2xl font-bold tracking-tight">
          Stock<span className="text-accent">Guesser</span>
        </h1>
        <nav aria-label="Game modes" className="mt-3 flex flex-wrap justify-center gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => m.live && switchMode(m.id)}
              disabled={!m.live}
              aria-current={mode === m.id ? "page" : undefined}
              className={`font-data min-h-9 rounded px-3 py-1.5 text-xs transition-colors ${
                mode === m.id
                  ? "bg-accent font-bold text-black"
                  : m.live
                    ? "bg-terminal-panel border-terminal-line hover:border-accent border"
                    : "text-terminal-dim border-terminal-line cursor-not-allowed border border-dashed opacity-60"
              }`}
            >
              {m.label}
              {!m.live && <span className="ml-1 opacity-70">soon</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        {mode === "daily" && <DailyTicker />}
        {mode === "recall" && <Recall />}
        {mode === "cap-battle" && <CapBattle />}
        {mode === "country" && <Country />}
        {mode === "chart" && <ChartDetective />}
      </main>

      <footer className="text-terminal-dim font-data mt-8 pb-2 text-center text-[10px]">
        data refreshed weekly · not investment advice ·{" "}
        <a
          className="hover:text-terminal-text underline"
          href="https://github.com/benginN/stockguesser"
        >
          github
        </a>{" "}
        ·{" "}
        <a
          className="hover:text-terminal-text underline"
          href="https://github.com/benginN/stockguesser/issues"
        >
          feedback
        </a>{" "}
        ·{" "}
        <a className="hover:text-terminal-text underline" href="privacy.html">
          privacy
        </a>
      </footer>
    </div>
  );
}
