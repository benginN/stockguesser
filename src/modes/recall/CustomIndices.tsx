/**
 * "Custom" recall tab: build your own index — a name plus companies separated
 * by spaces/commas/newlines — then play it with the same recall engine
 * (💡 ticker-hint mode included: hints shown in one form, answers required
 * in the other).
 */
import { useMemo, useState } from "react";
import { parseCustomList, type ResolveTarget } from "../../game/customIndex.ts";
import type { CompanyRecord, IndexRecord } from "../../lib/data.ts";
import {
  deleteCustomIndex,
  loadCustomIndices,
  loadRecallBest,
  saveCustomIndex,
  type CustomIndexDef,
} from "../../lib/storage.ts";

interface Props {
  companies: Map<string, CompanyRecord>;
  onPlay: (index: IndexRecord) => void;
}

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CustomIndices({ companies, onPlay }: Props) {
  const [saved, setSaved] = useState<CustomIndexDef[]>(loadCustomIndices);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const pool: ResolveTarget[] = useMemo(
    () =>
      [...companies.values()].map((c) => ({
        id: c.id,
        name: c.name,
        tickers: c.listings.map((l) => l.ticker),
        aliases: c.aliases,
      })),
    [companies],
  );

  const toIndexRecord = (def: CustomIndexDef): IndexRecord => ({
    id: def.id,
    displayName: def.name,
    provider: "custom",
    region: "",
    holdings: def.companyIds.filter((id) => companies.has(id)).map((companyId) => ({ companyId })),
  });

  const create = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFeedback("Give your index a name first.");
      return;
    }
    const { resolved, unresolved } = parseCustomList(text, pool);
    if (resolved.length < 3) {
      setFeedback(
        `Need at least 3 recognizable companies (found ${resolved.length}).` +
          (unresolved.length ? ` Couldn't resolve: ${unresolved.slice(0, 8).join(", ")}` : ""),
      );
      return;
    }
    const def: CustomIndexDef = {
      id: `custom-${slugify(trimmedName)}`,
      name: trimmedName,
      companyIds: resolved,
      created: new Date().toISOString().slice(0, 10),
    };
    saveCustomIndex(def);
    setSaved(loadCustomIndices());
    setName("");
    setText("");
    setFeedback(
      `Saved "${trimmedName}" with ${resolved.length} companies.` +
        (unresolved.length ? ` Skipped: ${unresolved.slice(0, 8).join(", ")}` : ""),
    );
  };

  return (
    <div className="space-y-4">
      {saved.length > 0 && (
        <ul className="grid grid-cols-1 gap-2">
          {saved.map((def) => {
            const best = loadRecallBest(def.id, "full");
            const playable = def.companyIds.filter((id) => companies.has(id)).length;
            return (
              <li key={def.id} className="flex gap-2">
                <button
                  onClick={() => onPlay(toIndexRecord(def))}
                  className="border-terminal-line bg-terminal-panel hover:border-accent flex min-h-14 flex-1 items-center justify-between rounded-md border px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold">{def.name}</span>
                    <span className="font-data text-terminal-dim text-xs">
                      {playable} stocks · yours
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
                <button
                  onClick={() => {
                    deleteCustomIndex(def.id);
                    setSaved(loadCustomIndices());
                  }}
                  aria-label={`Delete ${def.name}`}
                  className="border-terminal-line text-terminal-dim hover:border-feedback-near hover:text-feedback-near min-w-11 rounded-md border"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-terminal-line bg-terminal-panel space-y-3 rounded-md border p-4">
        <p className="text-sm font-semibold">Build your own index</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Index name (e.g. My Tech Watchlist)"
          aria-label="Custom index name"
          className="border-terminal-line bg-terminal-bg focus:border-accent w-full rounded-md border px-3 py-2.5 text-sm outline-none"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={
            "Companies — tickers or names, separated by spaces, commas or new lines:\nAAPL MSFT, Palantir\nBank of America"
          }
          aria-label="Companies in your index"
          className="border-terminal-line bg-terminal-bg focus:border-accent font-data w-full rounded-md border px-3 py-2.5 text-sm outline-none"
        />
        <button
          onClick={create}
          className="bg-accent min-h-11 w-full rounded-md font-bold text-black"
        >
          Create index
        </button>
        {feedback && (
          <p role="status" className="text-terminal-dim text-xs">
            {feedback}
          </p>
        )}
        <p className="text-terminal-dim text-[10px]">
          Saved in this browser only. Anything from our 4,400-company pool is recognizable.
        </p>
      </div>
    </div>
  );
}
