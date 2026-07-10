/**
 * Imposter variant (ROADMAP §1.2.3): 10 rapid rounds — 4 companies, tap the
 * one that is NOT in the index. Rounds are generated with a structural
 * non-ambiguity guarantee (see src/game/imposter.ts).
 */
import { useMemo, useState } from "react";
import { mulberry32 } from "../../game/capbattle.ts";
import { generateImposterRound, type ImposterRound } from "../../game/imposter.ts";
import type { CompanyRecord, IndexRecord } from "../../lib/data.ts";
import { INDEX_NAMES, SECTOR_COLORS } from "../../lib/sectorColors.ts";
import { flagEmoji, formatCap } from "../../lib/format.ts";
import { saveRecallBest, type RecallBest } from "../../lib/storage.ts";
import { utcDateKey } from "../../game/seed.ts";

const ROUNDS = 10;

// session-seeded RNG at module scope (render must stay pure)
const rng = mulberry32(Date.now() & 0xffffffff);

interface Props {
  index: IndexRecord;
  companies: Map<string, CompanyRecord>;
  onExit: () => void;
}

export default function ImposterGame({ index, companies, onExit }: Props) {
  const rounds: ImposterRound[] = useMemo(() => {
    const memberIds = new Set(index.holdings.map((h) => h.companyId));
    const members = [...memberIds]
      .map((id) => companies.get(id))
      .filter((c): c is CompanyRecord => !!c);
    const outsiders = [...companies.values()].filter((c) => c.tier === 1 && !memberIds.has(c.id));
    const out: ImposterRound[] = [];
    const usedImposters = new Set<string>();
    for (let i = 0; i < ROUNDS * 3 && out.length < ROUNDS; i++) {
      const round = generateImposterRound(index.id, members, outsiders, rng);
      if (round && !usedImposters.has(round.imposterId)) {
        usedImposters.add(round.imposterId);
        out.push(round);
      }
    }
    return out;
  }, [index, companies]);

  const [roundIdx, setRoundIdx] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [newBest, setNewBest] = useState(false);

  if (rounds.length < ROUNDS) {
    return (
      <p role="alert" className="text-feedback-near py-12 text-center text-sm">
        Not enough data to build imposter rounds for this index.
      </p>
    );
  }

  const round = rounds[roundIdx];
  const revealed = pickedId !== null;

  const pick = (id: string) => {
    if (revealed) return;
    setPickedId(id);
    const isRight = id === round.imposterId;
    const nextCorrect = correct + (isRight ? 1 : 0);
    if (isRight) setCorrect(nextCorrect);
    setTimeout(() => {
      setPickedId(null);
      if (roundIdx + 1 >= ROUNDS) {
        setFinished(true);
        const run: RecallBest = {
          score: nextCorrect * 100,
          named: nextCorrect,
          total: ROUNDS,
          date: utcDateKey(new Date()),
        };
        setNewBest(saveRecallBest(index.id, "imposter", run));
      } else {
        setRoundIdx((r) => r + 1);
      }
    }, 1400);
  };

  const title = `${INDEX_NAMES[index.id] ?? index.displayName} · Imposter`;

  if (finished) {
    return (
      <section className="space-y-4">
        <Header title={title} onExit={onExit} />
        <div
          role="status"
          className="border-terminal-line bg-terminal-panel rounded-md border p-6 text-center"
        >
          <p className="font-data text-4xl font-bold">
            {correct}/{ROUNDS}
          </p>
          <p className="text-terminal-dim mt-1 text-sm">
            {correct === ROUNDS
              ? "flawless 👑"
              : correct >= 7
                ? "sharp eye"
                : "the market is sneaky"}
            {newBest && " · 🏆 new personal best"}
          </p>
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
      <Header title={title} onExit={onExit} />
      <p className="font-data text-terminal-dim text-center text-xs">
        round {roundIdx + 1}/{ROUNDS} · score {correct} — which one is <strong>not</strong> in the{" "}
        {INDEX_NAMES[index.id] ?? index.displayName}?
      </p>
      <ul className="grid grid-cols-1 gap-2">
        {round.options.map((c) => {
          const isImposter = c.id === round.imposterId;
          const stateClass = !revealed
            ? "border-terminal-line bg-terminal-panel hover:border-accent"
            : isImposter
              ? "border-feedback-hit bg-feedback-hit/10"
              : c.id === pickedId
                ? "border-feedback-near bg-feedback-near/10"
                : "border-terminal-line bg-terminal-panel opacity-50";
          return (
            <li key={c.id}>
              <button
                onClick={() => pick(c.id)}
                disabled={revealed}
                className={`${stateClass} flex min-h-12 w-full items-center justify-between rounded-md border px-4 py-2.5 text-left`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {flagEmoji(c.country)} {c.name}
                    {revealed && isImposter && " 🕵️"}
                  </span>
                  <span
                    className="font-data text-[10px]"
                    style={{ color: SECTOR_COLORS[c.sector] }}
                  >
                    {c.sector}
                  </span>
                </span>
                <span className="font-data text-terminal-dim shrink-0 text-xs">
                  {formatCap(c.marketCapUSD)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Header({ title, onExit }: { title: string; onExit: () => void }) {
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
