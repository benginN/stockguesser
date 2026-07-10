/**
 * The make-or-break interaction (ROADMAP §4): instant, keyboard-first
 * autocomplete. Rows show ticker · name · flag · cap. Fully ARIA-wired.
 */
import { useEffect, useRef, useState } from "react";
import type { CompanySearch, Suggestion } from "../lib/search.ts";

interface Props {
  search: CompanySearch;
  decorate: (id: string) => { flag: string; cap: string };
  guessedIds: ReadonlySet<string>;
  disabled: boolean;
  placeholder: string;
  onGuess: (id: string) => void;
}

export default function GuessInput({
  search,
  decorate,
  guessedIds,
  disabled,
  placeholder,
  onGuess,
}: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions: Suggestion[] = open
    ? search.suggest(query, 8).filter((s) => !guessedIds.has(s.id))
    : [];

  useEffect(() => {
    setActive(0);
  }, [query]);

  const pick = (id: string) => {
    onGuess(id);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(suggestions[active].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls="guess-listbox"
        aria-activedescendant={suggestions.length ? `guess-opt-${active}` : undefined}
        aria-label="Guess a stock by name or ticker"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className="border-terminal-line bg-terminal-panel focus:border-accent w-full rounded-md border px-4 py-3 text-base outline-none disabled:opacity-40"
      />
      {suggestions.length > 0 && (
        <ul
          id="guess-listbox"
          role="listbox"
          className="border-terminal-line bg-terminal-panel absolute z-10 mt-1 max-h-80 w-full overflow-auto rounded-md border shadow-xl"
        >
          {suggestions.map((s, i) => {
            const { flag, cap } = decorate(s.id);
            return (
              <li
                key={s.id}
                id={`guess-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s.id);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 ${
                  i === active ? "bg-terminal-line" : ""
                }`}
              >
                <span className="font-data text-terminal-dim w-16 shrink-0 text-xs">
                  {s.ticker.split(".")[0]}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                <span aria-hidden>{flag}</span>
                <span className="font-data text-terminal-dim w-16 shrink-0 text-right text-xs">
                  {cap}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
