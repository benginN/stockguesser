/**
 * Index Recall mode shell (ROADMAP §1.2): variant tabs + index picker →
 * RecallGame (full/top10) or ImposterGame. Every index is playable in every
 * variant — full S&P 500 recall is a 30-minute marathon, and that's fine.
 */
import { useEffect, useState } from "react";
import { loadIndices, loadStocks, type CompanyRecord, type IndexRecord } from "../../lib/data.ts";
import { INDEX_NAMES } from "../../lib/sectorColors.ts";
import { loadRecallBest } from "../../lib/storage.ts";
import RecallGame from "./RecallGame.tsx";
import ImposterGame from "./ImposterGame.tsx";
import CustomIndices from "./CustomIndices.tsx";

export type Variant = "full" | "top10" | "imposter" | "custom";

const VARIANTS: { id: Variant; label: string; blurb: string }[] = [
  { id: "full", label: "Full recall", blurb: "name every constituent" },
  { id: "top10", label: "Top 10", blurb: "name the 10 heaviest weights" },
  { id: "imposter", label: "Imposter", blurb: "spot the one that doesn't belong" },
  { id: "custom", label: "Custom", blurb: "build and play your own index" },
];

interface Loaded {
  companies: Map<string, CompanyRecord>;
  indices: IndexRecord[];
}

export default function Recall() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState<Variant>("full");
  const [playing, setPlaying] = useState<IndexRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadStocks(), loadIndices()])
      .then(([stocks, idx]) => {
        if (cancelled) return;
        setLoaded({
          companies: new Map(stocks.companies.map((c) => [c.id, c])),
          indices: idx.indices,
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
        loading indices…
      </p>
    );
  }

  if (playing) {
    const back = () => setPlaying(null);
    return variant === "imposter" ? (
      <ImposterGame index={playing} companies={loaded.companies} onExit={back} />
    ) : (
      <RecallGame
        index={playing}
        companies={loaded.companies}
        variant={variant === "custom" ? "full" : variant}
        onExit={back}
      />
    );
  }

  // every index is playable in every variant (Top 10 of the DAX is a fine quiz too)
  const pickable = loaded.indices;

  return (
    <section aria-label="Index Recall" className="space-y-4">
      <header>
        <h2 className="text-lg font-bold">Index Recall</h2>
        <div role="tablist" aria-label="Recall variant" className="mt-2 flex gap-2">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={variant === v.id}
              onClick={() => setVariant(v.id)}
              className={`font-data min-h-9 rounded px-3 py-1.5 text-xs ${
                variant === v.id
                  ? "bg-accent font-bold text-black"
                  : "bg-terminal-panel border-terminal-line hover:border-accent border"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="text-terminal-dim font-data mt-1 text-xs">
          {VARIANTS.find((v) => v.id === variant)!.blurb}
        </p>
      </header>

      {variant === "custom" ? (
        <CustomIndices companies={loaded.companies} onPlay={setPlaying} />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {pickable.map((ix) => {
            const best = loadRecallBest(ix.id, variant);
            return (
              <li key={ix.id}>
                <button
                  onClick={() => setPlaying(ix)}
                  className="border-terminal-line bg-terminal-panel hover:border-accent flex min-h-14 w-full items-center justify-between rounded-md border px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold">
                      {INDEX_NAMES[ix.id] ?? ix.displayName}
                    </span>
                    <span className="font-data text-terminal-dim text-xs">
                      {variant === "top10" ? "top 10 of " : ""}
                      {ix.holdings.length} stocks · {ix.region}
                    </span>
                  </span>
                  <span className="font-data text-terminal-dim text-right text-xs">
                    {best ? (
                      <>
                        best <span className="text-accent font-bold">{best.score}</span>
                      </>
                    ) : (
                      "unplayed"
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
