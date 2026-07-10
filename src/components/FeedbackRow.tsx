/**
 * One guess row: company name + five feedback tiles (Appendix D order:
 * sector, industry, country, cap, index overlap). Color never stands alone —
 * every state pairs with an icon (✓ ~ ✗, ↑↓ for cap).
 */
import type { Feedback, GameCompany, TileState } from "../game/feedback.ts";
import { flagEmoji, formatCap } from "../lib/format.ts";

const stateClasses: Record<TileState, string> = {
  green: "bg-feedback-hit/15 border-feedback-hit text-feedback-hit",
  yellow: "bg-feedback-near/10 border-feedback-near text-feedback-near",
  gray: "bg-terminal-panel border-terminal-line text-terminal-dim",
};

const stateIcon: Record<TileState, string> = { green: "✓", yellow: "~", gray: "✗" };

function Tile({
  label,
  value,
  state,
  icon,
  delay,
  animate,
  title,
}: {
  label: string;
  value: string;
  state: TileState;
  icon?: string;
  delay: number;
  animate: boolean;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={`${stateClasses[state]} ${animate ? "tile-flip" : ""} flex min-h-14 flex-col justify-center rounded border px-1.5 py-1 text-center`}
      style={animate ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span className="text-terminal-dim text-[9px] tracking-wider uppercase">{label}</span>
      <span className="font-data truncate text-[11px] leading-tight font-semibold sm:text-xs">
        {icon ?? stateIcon[state]} {value}
      </span>
    </div>
  );
}

interface Props {
  guess: GameCompany;
  feedback: Feedback;
  animate: boolean;
  indexNames: (id: string) => string;
}

export default function FeedbackRow({ guess, feedback: f, animate, indexNames }: Props) {
  const capIcon = f.cap.direction === "up" ? "↑" : f.cap.direction === "down" ? "↓" : "✓";
  const sharedNames = f.indexOverlap.shared.map(indexNames).join(", ");
  return (
    <div aria-live="polite" className="space-y-1">
      <p className="truncate text-sm font-semibold">
        {guess.name} <span className="font-data text-terminal-dim text-xs">({guess.country})</span>
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        <Tile
          label="Sector"
          value={guess.sector}
          state={f.sector.state}
          delay={0}
          animate={animate}
        />
        <Tile
          label="Industry"
          value={guess.industry}
          state={f.industry.state}
          delay={90}
          animate={animate}
        />
        <Tile
          label="Country"
          value={`${flagEmoji(guess.country)} ${guess.country}`}
          state={f.country.state}
          delay={180}
          animate={animate}
        />
        <Tile
          label="Mkt Cap"
          value={formatCap(guess.marketCapUSD)}
          state={f.cap.state}
          icon={capIcon}
          delay={270}
          animate={animate}
        />
        <Tile
          label="Index"
          value={
            f.indexOverlap.state === "green" ? `${f.indexOverlap.shared.length} shared` : "none"
          }
          state={f.indexOverlap.state}
          delay={360}
          animate={animate}
          title={sharedNames || undefined}
        />
      </div>
    </div>
  );
}
