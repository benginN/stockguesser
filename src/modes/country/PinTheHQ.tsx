/**
 * Pin the HQ (ROADMAP §1.4.2): 4 rounds — click the world map where the shown
 * company is headquartered. Feedback: distance + direction arrow + proximity
 * score. Country-centroid precision (see src/game/geo.ts note).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { mulberry32 } from "../../game/capbattle.ts";
import {
  bearingArrow,
  COUNTRY_CENTROIDS,
  haversineKm,
  project,
  proximityScore,
  unproject,
  type LatLon,
} from "../../game/geo.ts";
import type { CompanyRecord } from "../../lib/data.ts";
import { SECTOR_COLORS } from "../../lib/sectorColors.ts";
import { formatCap } from "../../lib/format.ts";
import { loadJSON, saveJSON } from "../../lib/storage.ts";

const ROUNDS = 4;
const rng = mulberry32(Date.now() & 0xffffffff);

interface WorldPaths {
  w: number;
  h: number;
  land: string;
  borders: string;
}

let worldPromise: Promise<WorldPaths> | undefined;
const loadWorld = () =>
  (worldPromise ??= fetch(`${import.meta.env.BASE_URL}data/world-paths.json`).then((r) => {
    if (!r.ok) throw new Error(`world map HTTP ${r.status}`);
    return r.json() as Promise<WorldPaths>;
  }));

export default function PinTheHQ({ companies }: { companies: CompanyRecord[] }) {
  const [world, setWorld] = useState<WorldPaths | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo(() => {
    const pool = companies.filter((c) => c.tier === 1 && COUNTRY_CENTROIDS[c.country]);
    const picked: CompanyRecord[] = [];
    const used = new Set<string>();
    while (picked.length < ROUNDS && used.size < pool.length) {
      const c = pool[Math.floor(rng() * pool.length)];
      if (used.has(c.country)) continue; // 4 different countries keeps it interesting
      used.add(c.country);
      picked.push(c);
    }
    return picked;
  }, [companies]);

  const [round, setRound] = useState(0);
  const [pin, setPin] = useState<LatLon | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    loadWorld()
      .then(setWorld)
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-feedback-near py-8 text-center text-sm">
        Map failed to load ({error}).
      </p>
    );
  }
  if (!world || targets.length < ROUNDS) {
    return (
      <p className="text-terminal-dim font-data animate-pulse py-8 text-center text-sm">
        loading world map…
      </p>
    );
  }

  const company = targets[round];
  const truth = COUNTRY_CENTROIDS[company.country];

  const clickMap = (e: React.MouseEvent<SVGSVGElement>) => {
    if (revealed || showSummary) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * world.w;
    const y = ((e.clientY - rect.top) / rect.height) * world.h;
    setPin(unproject(x, y, world.w, world.h));
  };

  const confirm = () => {
    if (!pin) return;
    setRevealed(true);
    setScores((s) => [...s, proximityScore(haversineKm(pin, truth))]);
  };

  const next = () => {
    setPin(null);
    setRevealed(false);
    setRound((r) => Math.min(r + 1, ROUNDS - 1));
  };

  const total = scores.reduce((a, b) => a + b, 0);
  const km = pin ? haversineKm(pin, truth) : 0;

  if (showSummary) {
    const best = loadJSON<number>("best:pinhq") ?? 0;
    if (total > best) saveJSON("best:pinhq", total);
    return (
      <div role="status" className="space-y-3 text-center">
        <div className="border-terminal-line bg-terminal-panel rounded-md border p-6">
          <p className="font-data text-4xl font-bold">{total}</p>
          <p className="text-terminal-dim mt-1 text-sm">
            of {ROUNDS * 1000} · best {Math.max(best, total)}
            {total > best && " 🏆"}
          </p>
        </div>
        <button
          onClick={() => {
            setScores([]);
            setRound(0);
            setPin(null);
            setRevealed(false);
            setShowSummary(false);
          }}
          className="bg-accent min-h-11 w-full rounded-md font-bold text-black"
        >
          Play again
        </button>
      </div>
    );
  }

  const pinXY = pin ? project(pin, world.w, world.h) : null;
  const truthXY = project(truth, world.w, world.h);

  return (
    <div className="space-y-3">
      <div className="border-terminal-line bg-terminal-panel flex items-center justify-between rounded-md border px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{company.name}</p>
          <p className="font-data text-[10px]" style={{ color: SECTOR_COLORS[company.sector] }}>
            {company.sector} · {formatCap(company.marketCapUSD)}
          </p>
        </div>
        <p className="font-data text-terminal-dim shrink-0 text-xs">
          {round + 1}/{ROUNDS} · {total} pts
        </p>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${world.w} ${world.h}`}
        onClick={clickMap}
        role="application"
        aria-label="World map — click where this company is headquartered"
        className="border-terminal-line w-full cursor-crosshair rounded-md border select-none"
        style={{ background: "#0d1420" }}
      >
        <path d={world.land} fill="#1c2942" stroke="none" />
        <path d={world.borders} fill="none" stroke="#0d1420" strokeWidth="0.6" />
        {pinXY && (
          <circle cx={pinXY[0]} cy={pinXY[1]} r="5" fill="var(--color-accent)" stroke="#000" />
        )}
        {revealed && (
          <>
            <circle
              cx={truthXY[0]}
              cy={truthXY[1]}
              r="5"
              fill="var(--color-feedback-hit)"
              stroke="#000"
            />
            {pinXY && (
              <line
                x1={pinXY[0]}
                y1={pinXY[1]}
                x2={truthXY[0]}
                y2={truthXY[1]}
                stroke="var(--color-feedback-near)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            )}
          </>
        )}
      </svg>

      {revealed ? (
        <div role="status" className="space-y-2 text-center">
          <p className="text-sm">
            {km.toLocaleString()} km {pin && bearingArrow(pin, truth)} — HQ:{" "}
            <strong>{truth.name}</strong> →{" "}
            <span className="text-accent font-data font-bold">+{scores[scores.length - 1]}</span>
          </p>
          <button
            onClick={scores.length < ROUNDS ? next : () => setShowSummary(true)}
            className="bg-accent min-h-11 w-full rounded-md font-bold text-black"
          >
            {scores.length < ROUNDS ? "Next company" : "See final score"}
          </button>
        </div>
      ) : (
        <button
          onClick={confirm}
          disabled={!pin}
          className="bg-accent min-h-11 w-full rounded-md font-bold text-black disabled:opacity-40"
        >
          {pin ? "Confirm pin" : "Tap the map to place your pin"}
        </button>
      )}
    </div>
  );
}
