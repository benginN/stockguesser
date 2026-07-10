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
  loadStocks,
  type CompanyRecord,
} from "../../lib/data.ts";
import { CompanySearch } from "../../lib/search.ts";
import { flagEmoji, formatCap } from "../../lib/format.ts";
import {
  loadDailyState,
  recordDailyResult,
  saveDailyState,
  type DailyState,
} from "../../lib/storage.ts";
import GuessInput from "../../components/GuessInput.tsx";
import FeedbackRow from "../../components/FeedbackRow.tsx";

const MAX_GUESSES = 6;

const INDEX_NAMES: Record<string, string> = {
  sp500: "S&P 500",
  nasdaq100: "NASDAQ-100",
  dow30: "Dow 30",
  ftse100: "FTSE 100",
  dax: "DAX",
  cac40: "CAC 40",
  eurostoxx50: "EURO STOXX 50",
  aex: "AEX",
  smi: "SMI",
  ibex35: "IBEX 35",
  ftsemib: "FTSE MIB",
  omxs30: "OMXS30",
  nikkei225: "Nikkei 225",
  hangseng: "Hang Seng",
  nifty50: "NIFTY 50",
};

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
  if (!loaded) {
    return (
      <p className="text-terminal-dim font-data animate-pulse py-12 text-center text-sm">
        loading market data…
      </p>
    );
  }

  const { answer, search, companies, puzzleNumber } = loaded;
  const done = state.status !== "playing";

  const guess = (id: string) => {
    if (done || state.guessIds.includes(id)) return;
    const guessed = companies.get(id);
    if (!guessed) return;
    const nextIds = [...state.guessIds, id];
    const won = id === answer.id;
    const status = won ? "won" : nextIds.length >= MAX_GUESSES ? "lost" : "playing";
    const next: DailyState = { guessIds: nextIds, status };
    setState(next);
    setLastGuessAt(nextIds.length - 1);
    saveDailyState(dateKey, next);
    if (status !== "playing") recordDailyResult(dateKey, won, nextIds.length);
  };

  return (
    <section aria-label="Daily Ticker" className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Daily Ticker</h2>
        <p className="font-data text-terminal-dim text-xs">
          #{puzzleNumber} · {dateKey} · {state.guessIds.length}/{MAX_GUESSES}
        </p>
      </header>

      <GuessInput
        search={search}
        guessedIds={new Set(state.guessIds)}
        disabled={done}
        placeholder={done ? "Come back tomorrow!" : "Type a company name or ticker…"}
        onGuess={guess}
        decorate={(id) => {
          const c = companies.get(id);
          return { flag: c ? flagEmoji(c.country) : "", cap: c ? formatCap(c.marketCapUSD) : "" };
        }}
      />

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

      {done && (
        <div
          role="status"
          className="border-terminal-line bg-terminal-panel space-y-1 rounded-md border p-4 text-center"
        >
          <p className="text-sm">
            {state.status === "won" ? "🎉 Got it in " + state.guessIds.length + "!" : "So close —"}{" "}
            the answer was
          </p>
          <p className="text-accent text-xl font-bold">
            {flagEmoji(answer.country)} {answer.name}
          </p>
          <p className="font-data text-terminal-dim text-xs">
            {answer.sector} · {formatCap(answer.marketCapUSD)} ·{" "}
            {answer.indexMemberships.map((i) => INDEX_NAMES[i] ?? i).join(", ") || "no major index"}
          </p>
        </div>
      )}
    </section>
  );
}
