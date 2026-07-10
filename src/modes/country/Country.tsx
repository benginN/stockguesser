/**
 * Country mode (ROADMAP §1.4): two variants —
 *  1) Country recall: name the X largest listed companies of a country
 *     (X scales with how many the pool has; reuses the recall engine via a
 *     synthesized index record).
 *  2) Pin the HQ: 4 rounds of map-clicking, GeoGuessr-style scoring.
 */
import { useEffect, useMemo, useState } from "react";
import { loadStocks, type CompanyRecord, type IndexRecord } from "../../lib/data.ts";
import { COUNTRY_CENTROIDS } from "../../game/geo.ts";
import { flagEmoji } from "../../lib/format.ts";
import { loadRecallBest } from "../../lib/storage.ts";
import { recallTarget } from "../../game/geo.ts";
import RecallGame from "../recall/RecallGame.tsx";
import PinTheHQ from "./PinTheHQ.tsx";

type Tab = "recall" | "pin";

export default function Country() {
  const [companies, setCompanies] = useState<CompanyRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("recall");
  const [playing, setPlaying] = useState<IndexRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStocks()
      .then((s) => !cancelled && setCompanies(s.companies))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  const countries = useMemo(() => {
    if (!companies) return [];
    const byCountry = new Map<string, CompanyRecord[]>();
    for (const c of companies) {
      if (!COUNTRY_CENTROIDS[c.country]) continue;
      byCountry.set(c.country, [...(byCountry.get(c.country) ?? []), c]);
    }
    return [...byCountry.entries()]
      .filter(([, list]) => list.length >= 5)
      .map(([iso, list]) => ({
        iso,
        name: COUNTRY_CENTROIDS[iso].name,
        pool: list.sort((a, b) => b.marketCapUSD - a.marketCapUSD),
        target: recallTarget(list.length),
      }))
      .sort((a, b) => b.pool.length - a.pool.length);
  }, [companies]);

  if (error) {
    return (
      <p role="alert" className="text-feedback-near py-12 text-center text-sm">
        Data failed to load ({error}). Check your connection and refresh.
      </p>
    );
  }
  if (!companies) {
    return (
      <p className="text-terminal-dim font-data animate-pulse py-12 text-center text-sm">
        loading market data…
      </p>
    );
  }

  if (playing) {
    const map = new Map(companies.map((c) => [c.id, c]));
    return (
      <RecallGame index={playing} companies={map} variant="full" onExit={() => setPlaying(null)} />
    );
  }

  return (
    <section aria-label="Country mode" className="space-y-4">
      <header>
        <h2 className="text-lg font-bold">Country</h2>
        <div role="tablist" aria-label="Country variant" className="mt-2 flex gap-2">
          {(
            [
              ["recall", "Country recall"],
              ["pin", "Pin the HQ"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`font-data min-h-9 rounded px-3 py-1.5 text-xs ${
                tab === id
                  ? "bg-accent font-bold text-black"
                  : "bg-terminal-panel border-terminal-line hover:border-accent border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === "pin" ? (
        <PinTheHQ companies={companies} />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {countries.map((c) => {
            const indexId = `country-${c.iso.toLowerCase()}`;
            const best = loadRecallBest(indexId, "full");
            return (
              <li key={c.iso}>
                <button
                  onClick={() =>
                    setPlaying({
                      id: indexId,
                      displayName: `${c.name} Top ${c.target}`,
                      provider: "pool",
                      region: "",
                      holdings: c.pool.slice(0, c.target).map((x) => ({ companyId: x.id })),
                    })
                  }
                  className="border-terminal-line bg-terminal-panel hover:border-accent flex min-h-14 w-full items-center justify-between rounded-md border px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold">
                      {flagEmoji(c.iso)} {c.name}
                    </span>
                    <span className="font-data text-terminal-dim text-xs">
                      name the top {c.target} of {c.pool.length}
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
