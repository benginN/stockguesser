/**
 * Chart Detective (ROADMAP §1.5): a naked 5Y weekly price line (indexed to
 * 100, no labels) — buy hints down the ladder, guess anytime via the shared
 * autocomplete. Solved → stock card; give up → reveal at 0 points.
 */
import { useEffect, useMemo, useState } from "react";
import { chartScore, HINT_LADDER, hintText } from "../../game/chart.ts";
import { mulberry32 } from "../../game/capbattle.ts";
import { loadSearchIndex, loadSparklines, loadStocks, type CompanyRecord } from "../../lib/data.ts";
import { CompanySearch } from "../../lib/search.ts";
import { INDEX_NAMES } from "../../lib/sectorColors.ts";
import { flagEmoji, formatCap } from "../../lib/format.ts";
import { loadJSON, saveJSON } from "../../lib/storage.ts";
import GuessInput from "../../components/GuessInput.tsx";
import Sparkline from "../../components/Sparkline.tsx";
import StockCard from "../../components/StockCard.tsx";

const rng = mulberry32(Date.now() & 0xffffffff);

interface Loaded {
  companies: Map<string, CompanyRecord>;
  all: CompanyRecord[];
  search: CompanySearch;
  sparklines: Record<string, number[]>;
  candidates: CompanyRecord[]; // tier-1 with a sparkline
}

export default function ChartDetective() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadStocks(), loadSearchIndex(), loadSparklines()])
      .then(([stocks, idx, sparks]) => {
        if (cancelled) return;
        const companies = new Map(stocks.companies.map((c) => [c.id, c]));
        setLoaded({
          companies,
          all: stocks.companies,
          search: new CompanySearch(idx.entries),
          sparklines: sparks.sparklines,
          candidates: stocks.companies.filter((c) => c.tier === 1 && sparks.sparklines[c.id]),
        });
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
  if (!loaded) {
    return (
      <p className="text-terminal-dim font-data animate-pulse py-12 text-center text-sm">
        loading charts…
      </p>
    );
  }
  return <Round key={undefined} loaded={loaded} />;
}

function Round({ loaded }: { loaded: Loaded }) {
  const [roundNo, setRoundNo] = useState(0);
  const answer = useMemo(
    () => loaded.candidates[Math.floor(rng() * loaded.candidates.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- new answer per round
    [loaded, roundNo],
  );
  const [hintsUsed, setHintsUsed] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<"playing" | "solved" | "gaveup">("playing");
  const [best, setBest] = useState(loadJSON<number>("best:chart") ?? 0);

  const series = loaded.sparklines[answer.id];
  const score = chartScore(hintsUsed, wrong.length, outcome === "solved");
  const potential = chartScore(hintsUsed, wrong.length, true);

  const guess = (id: string) => {
    if (outcome !== "playing") return;
    if (id === answer.id) {
      setOutcome("solved");
      const s = chartScore(hintsUsed, wrong.length, true);
      if (s > best) {
        setBest(s);
        saveJSON("best:chart", s);
      }
    } else {
      setWrong((w) => [...w, id]);
    }
  };

  const nextRound = () => {
    setHintsUsed(0);
    setWrong([]);
    setOutcome("playing");
    setRoundNo((r) => r + 1);
  };

  const done = outcome !== "playing";

  return (
    <section aria-label="Chart Detective" className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Chart Detective</h2>
        <p className="font-data text-terminal-dim text-xs">
          {done ? (
            <>
              scored <span className="text-accent font-bold">{score}</span>
            </>
          ) : (
            <>
              worth <span className="text-accent font-bold">{potential}</span>
            </>
          )}{" "}
          · best {best}
        </p>
      </header>

      <div className="border-terminal-line rounded-md border p-3" style={{ background: "#0d1420" }}>
        <Sparkline series={series} className="h-40 w-full" />
        <p className="text-terminal-dim mt-1 text-right text-[9px] tracking-wider uppercase">
          5y · weekly · indexed to 100 · which stock is this?
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hints">
        {HINT_LADDER.map((h, i) => {
          const taken = i < hintsUsed;
          const nextUp = i === hintsUsed;
          return (
            <button
              key={h.kind}
              disabled={!nextUp || done}
              onClick={() => setHintsUsed((n) => n + 1)}
              className={`font-data min-h-9 rounded border px-2.5 py-1 text-xs ${
                taken
                  ? "border-accent text-accent"
                  : nextUp && !done
                    ? "border-terminal-line bg-terminal-panel hover:border-accent"
                    : "border-terminal-line text-terminal-dim opacity-40"
              }`}
            >
              {taken ? `${h.label}: ${hintText(answer, h.kind)}` : `${h.label} (−${h.cost})`}
            </button>
          );
        })}
      </div>

      {!done && (
        <>
          <GuessInput
            search={loaded.search}
            guessedIds={new Set(wrong)}
            disabled={false}
            placeholder="Name that stock…"
            onGuess={guess}
            decorate={(id) => {
              const c = loaded.companies.get(id);
              return {
                flag: c ? flagEmoji(c.country) : "",
                cap: c ? formatCap(c.marketCapUSD) : "",
              };
            }}
          />
          {wrong.length > 0 && (
            <p className="text-feedback-near font-data text-xs" aria-live="polite">
              ✗ {wrong.map((id) => loaded.companies.get(id)?.name ?? id).join(" · ")}
            </p>
          )}
          <button
            onClick={() => setOutcome("gaveup")}
            className="border-terminal-line text-terminal-dim hover:border-accent min-h-11 w-full rounded-md border text-sm"
          >
            Give up & reveal
          </button>
        </>
      )}

      {done && (
        <div role="status" className="space-y-3">
          <p className="text-center text-sm">
            {outcome === "solved" ? `🎉 Solved for ${score} points — it was` : "It was"}
          </p>
          <StockCard
            company={answer}
            allCompanies={loaded.all}
            sparkline={series}
            indexNames={(id) => INDEX_NAMES[id] ?? id}
          />
          <button
            onClick={nextRound}
            className="bg-accent min-h-11 w-full rounded-md font-bold text-black"
          >
            Next chart
          </button>
        </div>
      )}
    </section>
  );
}
