/** Local stats: played, win %, streaks, guess distribution (ROADMAP §1.1). */
import type { DailyStats } from "../lib/storage.ts";
import Modal from "./Modal.tsx";

export default function StatsModal({ stats, onClose }: { stats: DailyStats; onClose: () => void }) {
  const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxDist = Math.max(...stats.dist, 1);
  const cells: [string, string | number][] = [
    ["Played", stats.played],
    ["Win %", `${winPct}%`],
    ["Streak", stats.streak],
    ["Best", stats.maxStreak],
  ];
  return (
    <Modal title="Statistics" onClose={onClose}>
      <div className="mb-5 grid grid-cols-4 gap-2 text-center">
        {cells.map(([label, value]) => (
          <div key={label}>
            <p className="font-data text-2xl font-bold">{value}</p>
            <p className="text-terminal-dim text-[10px] tracking-wider uppercase">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-terminal-dim mb-2 text-[10px] tracking-wider uppercase">
        Guess distribution
      </p>
      <div className="space-y-1">
        {stats.dist.map((count, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="font-data w-3 text-xs">{i + 1}</span>
            <div
              className={`${count ? "bg-feedback-hit/70" : "bg-terminal-line"} font-data min-w-6 rounded px-1.5 py-0.5 text-right text-xs text-black`}
              style={{ width: `${Math.max((count / maxDist) * 100, 8)}%` }}
            >
              <span className={count ? "" : "text-terminal-dim"}>{count}</span>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
