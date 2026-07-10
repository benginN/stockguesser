/**
 * Daily Ticker — flagship mode (ROADMAP §1.1). One mystery stock per UTC day,
 * six guesses, attribute feedback per Appendix D. State machine
 * idle→playing→won|lost persisted per-day in localStorage: refresh restores,
 * a finished day can't be replayed.
 */
import { useEffect, useMemo, useState } from "react";
import { compareGuess } from "../../game/feedback.ts";
import { resolveDailyAnswer, utcDateKey } from "../../game/seed.ts";
import {
  loadDailySchedule,
  loadSearchIndex,
  loadSparklines,
  loadStocks,
  type CompanyRecord,
} from "../../lib/data.ts";
import { CompanySearch } from "../../lib/search.ts";
import { flagEmoji, formatCap } from "../../lib/format.ts";
import {
  loadDailyState,
  loadDailyStats,
  onceFlag,
  recordDailyResult,
  saveDailyState,
  type DailyState,
} from "../../lib/storage.ts";
import { buildShareText } from "../../game/share.ts";
import { INDEX_NAMES } from "../../lib/sectorColors.ts";
import GuessInput from "../../components/GuessInput.tsx";
import FeedbackRow from "../../components/FeedbackRow.tsx";
import StockCard from "../../components/StockCard.tsx";
import ShareButton from "../../components/ShareButton.tsx";
import StatsModal from "../../components/StatsModal.tsx";
import HowToPlay from "../../components/HowToPlay.tsx";

const MAX_GUESSES = 6;

interface Loaded {
  companies: Map<string, CompanyRecord>;
  search: CompanySearch;
  answer: CompanyRecord;
  puzzleNumber: number;
}

export default function DailyTicker() {
  const dateKey = utcDateKey(new Date());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DailyState>({ guessIds: [], status: "playing" });
  const [lastGuessAt, setLastGuessAt] = useState(0); // animate only the newest row
  const [sparkline, setSparkline] = useState<number[] | undefined>();
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(() => onceFlag("howto:daily"));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stocks, searchIdx, schedule] = await Promise.all([
          loadStocks(),
          loadSearchIndex(),
          loadDailySchedule(),
        ]);
        const companies = new Map(stocks.companies.map((c) => [c.id, c]));
        const tier1Ids = stocks.companies.filter((c) => c.tier === 1).map((c) => c.id);
        let { answerId, number } = resolveDailyAnswer(schedule, dateKey, tier1Ids);
        if (!companies.has(answerId)) {
          // schedule references a company gone from the snapshot — deterministic fallback
          ({ answerId, number } = resolveDailyAnswer({ ...schedule, days: {} }, dateKey, tier1Ids));
        }
        if (cancelled) return;
        setLoaded({
          companies,
          search: new CompanySearch(searchIdx.entries),
          answer: companies.get(answerId)!,
          puzzleNumber: number,
        });
        const saved = loadDailyState(dateKey);
        if (saved) setState(saved);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  const done = state.status !== "playing";

  useEffect(() => {
    if (!loaded || !done || sparkline) return;
    loadSparklines()
      .then((d) => setSparkline(d.sparklines[loaded.answer.id]))
      .catch(() => {}); // card just renders without the chart
  }, [loaded, done, sparkline]);

  const rows = useMemo(() => {
    if (!loaded) return [];
    return state.guessIds
      .map((id) => loaded.companies.get(id))
      .filter((c): c is CompanyRecord => !!c)
      .map((c) => ({ company: c, feedback: compareGuess(c, loaded.answer) }));
  }, [loaded, state.guessIds]);

  if (error) {
    return (
      <p role="alert" className="text-feedback-near py-12 text-center text-sm">
        Data failed to load ({error}). Check your connection and refresh.
      </p>
    );
  }
  const guess = (id: string) => {
    if (!loaded || done || state.guessIds.includes(id)) return;
    const guessed = loaded.companies.get(id);
    if (!guessed) return;
    const nextIds = [...state.guessIds, id];
    const won = id === loaded.answer.id;
    const status = won ? "won" : nextIds.length >= MAX_GUESSES ? "lost" : "playing";
    const next: DailyState = { guessIds: nextIds, status };
    setState(next);
    setLastGuessAt(nextIds.length - 1);
    saveDailyState(dateKey, next);
    if (status !== "playing") recordDailyResult(dateKey, won, nextIds.length);
  };

  return (
    <section aria-label="Daily Ticker" className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Daily Ticker</h2>
        <div className="flex items-center gap-1">
          <p className="font-data text-terminal-dim mr-2 text-xs">
            #{loaded ? loaded.puzzleNumber : "—"} · {state.guessIds.length}/{MAX_GUESSES}
          </p>
          <button
            onClick={() => setShowStats(true)}
            aria-label="Statistics"
            className="border-terminal-line hover:border-accent min-h-9 min-w-9 rounded border text-sm"
          >
            📊
          </button>
          <button
            onClick={() => setShowHelp(true)}
            aria-label="How to play"
            className="border-terminal-line hover:border-accent font-data min-h-9 min-w-9 rounded border text-sm font-bold"
          >
            ?
          </button>
        </div>
      </header>

      {loaded ? (
        <GuessInput
          search={loaded.search}
          guessedIds={new Set(state.guessIds)}
          disabled={done}
          placeholder={done ? "Come back tomorrow!" : "Type a company name or ticker…"}
          onGuess={guess}
          decorate={(id) => {
            const c = loaded.companies.get(id);
            return { flag: c ? flagEmoji(c.country) : "", cap: c ? formatCap(c.marketCapUSD) : "" };
          }}
        />
      ) : (
        <input
          disabled
          placeholder="loading market data…"
          aria-label="Guess a stock (loading)"
          className="border-terminal-line bg-terminal-panel w-full animate-pulse rounded-md border px-4 py-3 text-base opacity-60"
        />
      )}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <FeedbackRow
            key={r.company.id}
            guess={r.company}
            feedback={r.feedback}
            animate={i === lastGuessAt}
            indexNames={(id) => INDEX_NAMES[id] ?? id}
          />
        ))}
        {!done &&
          Array.from({ length: MAX_GUESSES - rows.length }, (_, i) => (
            <div
              key={`empty-${i}`}
              aria-hidden
              className="border-terminal-line/60 grid h-14 grid-cols-5 gap-1.5 rounded border border-dashed opacity-40"
            />
          ))}
      </div>

      {done && loaded && (
        <div role="status" className="space-y-3">
          <p className="text-center text-sm">
            {state.status === "won"
              ? `🎉 Got it in ${state.guessIds.length}/${MAX_GUESSES} — the answer was`
              : "So close — the answer was"}
          </p>
          <StockCard
            company={loaded.answer}
            allCompanies={[...loaded.companies.values()]}
            sparkline={sparkline}
            indexNames={(id) => INDEX_NAMES[id] ?? id}
          />
          <ShareButton
            text={buildShareText({
              puzzleNumber: loaded.puzzleNumber,
              won: state.status === "won",
              guessCount: state.guessIds.length,
              maxGuesses: MAX_GUESSES,
              streak: loadDailyStats().streak,
              feedbacks: rows.map((r) => r.feedback),
              url: "https://benginn.github.io/stockguesser/",
            })}
          />
          <p className="text-terminal-dim font-data text-center text-xs">
            next ticker at midnight UTC
          </p>
        </div>
      )}

      {showStats && <StatsModal stats={loadDailyStats()} onClose={() => setShowStats(false)} />}
      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
    </section>
  );
}
