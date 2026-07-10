/** Rules modal — auto-opens on first visit (localStorage flag), one tap away after. */
import Modal from "./Modal.tsx";

const rows: [string, string][] = [
  ["🟩", "exact match"],
  ["🟨", "close: same sector (industry), same region (country), same size bracket (cap)"],
  ["⬜", "no match"],
  ["↑ / ↓", "the answer's market cap is higher / lower than your guess"],
];

export default function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p>
          Guess the <strong>mystery stock</strong> in 6 tries. Everyone gets the same stock each day
          (UTC). Type any listed company — name, ticker, or nickname.
        </p>
        <p>
          Each guess compares five attributes:{" "}
          <strong>Sector · Industry · Country · Market cap · Index overlap</strong>.
        </p>
        <ul className="space-y-1.5">
          {rows.map(([icon, text]) => (
            <li key={icon} className="flex gap-2">
              <span className="w-10 shrink-0">{icon}</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <p>
          <strong>Index overlap</strong> turns green when your guess shares at least one stock index
          with the answer (S&P 500, DAX, Nikkei 225…). Hover/long-press the tile to see which.
        </p>
        <p className="text-terminal-dim">
          Win or lose, you'll learn something from the stock card at the end. Come back tomorrow to
          keep your streak alive. 🔥
        </p>
      </div>
    </Modal>
  );
}
