/**
 * The recall engine screen: type-to-reveal, progress ring, optional countdown
 * (zen toggle before start), reveal tiles with sector color + index weight,
 * end screen grouped by sector — the learning moment (ROADMAP §1.2).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { matchExact, matchRemaining, recallScore, timeLimitFor } from "../../game/recall.ts";
import type { CompanyRecord, IndexRecord } from "../../lib/data.ts";
import { INDEX_NAMES, SECTOR_COLORS } from "../../lib/sectorColors.ts";
import { saveRecallBest } from "../../lib/storage.ts";
import { utcDateKey } from "../../game/seed.ts";
import type { Variant } from "./Recall.tsx";

interface Entry {
  company: CompanyRecord;
  weight?: number;
  matchable: { id: string; name: string; ticker: string; aliases: string[] };
}

interface Props {
  index: IndexRecord;
  companies: Map<string, CompanyRecord>;
  variant: Variant; // "full" | "top10"
  onExit: () => void;
}

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.abs(totalSec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RecallGame({ index, companies, variant, onExit }: Props) {
  const entries: Entry[] = useMemo(() => {
    const holdings = variant === "top10" ? index.holdings.slice(0, 10) : index.holdings;
    return holdings
      .map((h): Entry | undefined => {
        const company = companies.get(h.companyId);
        if (!company) return undefined;
        return {
          company,
          weight: h.weight,
          matchable: {
            id: company.id,
            name: company.name,
            ticker: company.listings.find((l) => l.primary)?.ticker ?? company.listings[0].ticker,
            aliases: company.aliases,
          },
        };
      })
      .filter((e): e is Entry => !!e);
  }, [index, companies, variant]);

  const [phase, setPhase] = useState<"setup" | "playing" | "done">("setup");
  const [zen, setZen] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState(0);
  const [input, setInput] = useState("");
  const [missFlash, setMissFlash] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [tickerHints, setTickerHints] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // refs mirror the values event handlers/timers need without stale closures
  const revealedRef = useRef(revealed);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);

  const limit = zen ? undefined : timeLimitFor(entries.length);
  const total = entries.length;
  const named = revealed.size;

  // finishing is EVENT-driven (timer tick, last reveal, give-up) — not an effect
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const namedNow = revealedRef.current.size;
    const scoreNow = recallScore(namedNow, total, elapsedRef.current, limit);
    setFinalScore(scoreNow);
    setNewBest(
      saveRecallBest(index.id, variant, {
        score: scoreNow,
        named: namedNow,
        total,
        date: utcDateKey(new Date()),
      }),
    );
    setPhase("done");
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const t = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (limit !== undefined && elapsedRef.current >= limit) finish();
    }, 1000);
    return () => clearInterval(t);
  }, [phase, limit]); // eslint-disable-line react-hooks/exhaustive-deps -- finish is stable per run

  /** With ticker hints visible, only NAMES count — strip tickers/ticker-aliases. */
  const matchableFor = (e: Entry) =>
    tickerHints
      ? {
          ...e.matchable,
          ticker: "",
          aliases: e.matchable.aliases.filter(
            (a) => a !== e.matchable.ticker.split(".")[0].toLowerCase(),
          ),
        }
      : e.matchable;

  const reveal = (hit: { id: string }) => {
    const next = new Set(revealed).add(hit.id);
    revealedRef.current = next;
    setRevealed(next);
    setInput("");
    if (next.size === total) finish();
  };

  /** auto-accept as you type: exact matches fire instantly, no Enter needed */
  const onType = (value: string) => {
    setInput(value);
    const remaining = entries.filter((e) => !revealed.has(e.company.id)).map(matchableFor);
    const hit = matchExact(value, remaining);
    if (hit) reveal(hit);
  };

  const submit = () => {
    const remaining = entries.filter((e) => !revealed.has(e.company.id)).map(matchableFor);
    const hit = matchRemaining(input, remaining);
    if (hit) {
      reveal(hit);
    } else {
      setMissFlash(true);
      setTimeout(() => setMissFlash(false), 350);
    }
  };

  const title = `${INDEX_NAMES[index.id] ?? index.displayName}${variant === "top10" ? " · Top 10" : ""}`;

  if (phase === "setup") {
    return (
      <section className="space-y-4">
        <BackHeader title={title} onExit={onExit} />
        <div className="border-terminal-line bg-terminal-panel space-y-4 rounded-md border p-5 text-center">
          <p className="text-sm">
            Name{" "}
            {variant === "top10"
              ? "the 10 largest constituents by weight"
              : `all ${total} constituents`}
            . Exact names reveal as you type; Enter forgives small typos.
          </p>
          <label className="font-data flex items-center justify-center gap-2 text-xs">
            <input type="checkbox" checked={zen} onChange={(e) => setZen(e.target.checked)} />
            zen mode (no timer)
          </label>
          <p className="font-data text-terminal-dim text-xs">
            {zen ? "take your time" : `⏱ ${mmss(timeLimitFor(total))}`}
          </p>
          <button
            onClick={() => {
              setPhase("playing");
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="bg-accent min-h-11 w-full rounded-md font-bold text-black"
          >
            Start
          </button>
        </div>
      </section>
    );
  }

  if (phase === "done") {
    const bySector = new Map<string, Entry[]>();
    for (const e of entries) {
      bySector.set(e.company.sector, [...(bySector.get(e.company.sector) ?? []), e]);
    }
    return (
      <section className="space-y-4">
        <BackHeader title={title} onExit={onExit} />
        <div
          role="status"
          className="border-terminal-line bg-terminal-panel rounded-md border p-4 text-center"
        >
          <p className="font-data text-3xl font-bold">
            {named}/{total}
          </p>
          <p className="text-terminal-dim font-data text-xs">
            score <span className="text-accent font-bold">{finalScore}</span>
            {newBest && " · 🏆 new personal best"}
          </p>
        </div>
        <div className="space-y-3">
          {[...bySector.entries()].map(([sector, list]) => (
            <div key={sector}>
              <p
                className="font-data mb-1 text-xs font-bold tracking-wider uppercase"
                style={{ color: SECTOR_COLORS[sector] }}
              >
                {sector} · {list.filter((e) => revealed.has(e.company.id)).length}/{list.length}
              </p>
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {list.map((e) => {
                  const got = revealed.has(e.company.id);
                  return (
                    <li
                      key={e.company.id}
                      className={`rounded border px-2 py-1 text-xs ${
                        got
                          ? "border-terminal-line bg-terminal-panel"
                          : "border-feedback-near/50 text-feedback-near"
                      }`}
                    >
                      {got ? "✓" : "✗"} {e.company.name}
                      {e.weight !== undefined && (
                        <span className="font-data text-terminal-dim block text-[10px]">
                          {e.weight.toFixed(1)}%
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <button
          onClick={onExit}
          className="bg-accent min-h-11 w-full rounded-md font-bold text-black"
        >
          Back to indices
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <BackHeader title={title} onExit={onExit} />
      <div className="bg-terminal-bg/95 sticky top-0 z-20 -mx-1 flex items-center gap-3 px-1 py-2 backdrop-blur">
        <ProgressRing fraction={named / total} label={`${named}/${total}`} />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={tickerHints ? "Tickers shown — type the NAME…" : "Type a constituent…"}
          aria-label={`Name a constituent of ${title}`}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`bg-terminal-panel min-h-11 w-full rounded-md border px-4 py-2.5 text-base outline-none ${
            missFlash ? "border-feedback-near" : "border-terminal-line focus:border-accent"
          }`}
        />
        <button
          onClick={() => setTickerHints((t) => !t)}
          aria-pressed={tickerHints}
          title="Show tickers as hints — names only while on"
          className={`font-data min-h-11 shrink-0 rounded border px-2.5 text-xs ${
            tickerHints
              ? "border-accent text-accent"
              : "border-terminal-line text-terminal-dim hover:border-accent"
          }`}
        >
          💡
        </button>
        {limit !== undefined && (
          <p
            className={`font-data w-14 shrink-0 text-right text-sm ${
              limit - elapsed <= 30 ? "text-feedback-near" : "text-terminal-dim"
            }`}
            aria-label="Time remaining"
          >
            {mmss(Math.max(0, limit - elapsed))}
          </p>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-live="polite">
        {entries.map((e) => {
          const got = revealed.has(e.company.id);
          return (
            <li
              key={e.company.id}
              className={`min-h-11 rounded border px-2 py-1.5 text-xs ${
                got
                  ? "tile-flip border-terminal-line bg-terminal-panel"
                  : "border-terminal-line/50 border-dashed"
              }`}
              style={
                got
                  ? { borderLeft: `3px solid ${SECTOR_COLORS[e.company.sector] ?? "#888"}` }
                  : undefined
              }
            >
              {got ? (
                <>
                  <span className="block truncate font-semibold">{e.company.name}</span>
                  <span className="font-data text-terminal-dim text-[10px]">
                    {e.matchable.ticker.split(".")[0]}
                    {e.weight !== undefined && ` · ${e.weight.toFixed(1)}%`}
                  </span>
                </>
              ) : (
                <span className="text-terminal-dim font-data">
                  {tickerHints ? e.matchable.ticker.split(".")[0] : "?"}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <button
        onClick={finish}
        className="border-terminal-line text-terminal-dim hover:border-accent min-h-11 w-full rounded-md border text-sm"
      >
        Give up & reveal
      </button>
    </section>
  );
}

function BackHeader({ title, onExit }: { title: string; onExit: () => void }) {
  return (
    <header className="flex items-center gap-2">
      <button
        onClick={onExit}
        aria-label="Back to index list"
        className="border-terminal-line hover:border-accent min-h-9 min-w-9 rounded border"
      >
        ←
      </button>
      <h2 className="text-lg font-bold">{title}</h2>
    </header>
  );
}

function ProgressRing({ fraction, label }: { fraction: number; label: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 52 52"
      role="img"
      aria-label={`Progress: ${label}`}
      className="shrink-0"
    >
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="var(--color-terminal-line)"
        strokeWidth="4"
      />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="var(--color-feedback-hit)"
        strokeWidth="4"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fraction)}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
      />
      <text
        x="26"
        y="30"
        textAnchor="middle"
        fill="var(--color-terminal-text)"
        fontSize="11"
        fontFamily="var(--font-data)"
      >
        {label}
      </text>
    </svg>
  );
}
