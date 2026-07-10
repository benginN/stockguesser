/**
 * Cap Battle (ROADMAP §1.3): champion's market cap is shown, challenger's is
 * hidden — call higher or lower. One mistake ends the run; the winner becomes
 * the new champion. Personal best persists locally.
 */
import { useEffect, useState } from "react";
import { mulberry32, pickChallenger, pickPair } from "../../game/capbattle.ts";
import { loadStocks, type CompanyRecord } from "../../lib/data.ts";
import { SECTOR_COLORS } from "../../lib/sectorColors.ts";
import { flagEmoji, formatCap } from "../../lib/format.ts";
import { loadCapBattleBest, saveCapBattleBest } from "../../lib/storage.ts";

const MIN_CAP = 2e9; // Small caps are unguessable noise — Mid and up only
const RECENT_WINDOW = 24;

// session-seeded arcade RNG (module scope: created once at load, not in render)
const rng = mulberry32(Date.now() & 0xffffffff);

export default function CapBattle() {
  const [pool, setPool] = useState<CompanyRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStocks()
      .then((s) => {
        if (cancelled) return;
        setPool(s.companies.filter((c) => c.tier === 1 && c.marketCapUSD >= MIN_CAP));
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-feedback-near py-12 text-center text-sm">
        Data failed to load ({error}). Check your connection and refresh.
      </p>
    );
  }
  if (!pool) {
    return (
      <p className="text-terminal-dim font-data animate-pulse py-12 text-center text-sm">
        loading market data…
      </p>
    );
  }
  return <Battle pool={pool} />;
}

function Battle({ pool }: { pool: CompanyRecord[] }) {
  const [recent] = useState<string[]>([]);
  const [pair, setPair] = useState<[CompanyRecord, CompanyRecord]>(() =>
    pickPair(pool, rng, new Set()),
  );
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(loadCapBattleBest());
  const [phase, setPhase] = useState<"guess" | "reveal" | "over">("guess");
  const [lastRight, setLastRight] = useState(true);

  const [champion, challenger] = pair;

  const remember = (...ids: string[]) => {
    recent.push(...ids);
    while (recent.length > RECENT_WINDOW) recent.shift();
  };

  const call = (dir: "higher" | "lower") => {
    if (phase !== "guess") return;
    const actuallyHigher = challenger.marketCapUSD >= champion.marketCapUSD;
    const right = dir === "higher" ? actuallyHigher : !actuallyHigher;
    setLastRight(right);
    setPhase("reveal");
    setTimeout(() => {
      if (right) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        if (saveCapBattleBest(nextStreak)) setBest(nextStreak);
        remember(champion.id);
        const nextChallenger = pickChallenger(challenger, pool, rng, new Set(recent));
        setPair([challenger, nextChallenger]);
        setPhase("guess");
      } else {
        setPhase("over");
      }
    }, 1500);
  };

  const restart = () => {
    setStreak(0);
    setPair(pickPair(pool, rng, new Set(recent)));
    setPhase("guess");
  };

  return (
    <section aria-label="Cap Battle" className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Cap Battle</h2>
        <p className="font-data text-terminal-dim text-xs">
          streak <span className="text-accent font-bold">{streak}</span> · best{" "}
          <span className="font-bold">{best}</span>
        </p>
      </header>

      <CompanyCard company={champion} capShown />

      <p
        className="font-data text-terminal-dim text-center text-xs tracking-widest uppercase"
        aria-hidden
      >
        — does the next one have a {phase === "reveal" ? (lastRight ? "✓" : "✗") : ""} —
      </p>

      <CompanyCard company={challenger} capShown={phase !== "guess"} />

      {phase === "over" ? (
        <div role="status" className="space-y-3 text-center">
          <p className="text-sm">
            Run over at <span className="font-data text-accent text-lg font-bold">{streak}</span>
            {streak === best && streak > 0 && " — 🏆 personal best!"}
          </p>
          <button
            onClick={restart}
            className="bg-accent min-h-11 w-full rounded-md font-bold text-black"
          >
            One more round
          </button>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-label="Is the challenger's market cap higher or lower?"
        >
          <button
            onClick={() => call("higher")}
            disabled={phase !== "guess"}
            className="border-feedback-hit text-feedback-hit hover:bg-feedback-hit/10 min-h-12 rounded-md border-2 text-base font-bold disabled:opacity-40"
          >
            ↑ Higher
          </button>
          <button
            onClick={() => call("lower")}
            disabled={phase !== "guess"}
            className="border-feedback-near text-feedback-near hover:bg-feedback-near/10 min-h-12 rounded-md border-2 text-base font-bold disabled:opacity-40"
          >
            ↓ Lower
          </button>
        </div>
      )}
    </section>
  );
}

function CompanyCard({ company: c, capShown }: { company: CompanyRecord; capShown: boolean }) {
  const monogram = c.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="border-terminal-line bg-terminal-panel flex items-center gap-3 rounded-md border p-4">
      <div
        aria-hidden
        className="font-data flex h-12 w-12 shrink-0 items-center justify-center rounded font-bold text-black"
        style={{ backgroundColor: SECTOR_COLORS[c.sector] ?? "#889" }}
      >
        {monogram}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {flagEmoji(c.country)} {c.name}
        </p>
        <p className="font-data text-terminal-dim truncate text-xs">{c.sector}</p>
      </div>
      <p className="font-data shrink-0 text-right text-lg font-bold">
        {capShown ? formatCap(c.marketCapUSD) : <span className="text-terminal-dim">???</span>}
      </p>
    </div>
  );
}
