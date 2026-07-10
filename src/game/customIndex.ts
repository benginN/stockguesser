/**
 * Custom index parser: the user pastes a name list separated by commas,
 * semicolons, newlines, or spaces; each chunk resolves to a company via
 * exact ticker → exact/core name/alias → unique fuzzy. Space-separated
 * chunks that don't resolve as a whole fall back to token-by-token (so
 * "AAPL MSFT SAP" works while "Bank of America" stays intact).
 */
import { coreName, matchesCompany, normalizeGuess } from "./matching.ts";

export interface ResolveTarget {
  id: string;
  name: string;
  tickers: string[];
  aliases: string[];
}

function resolveOne(chunk: string, pool: ResolveTarget[]): ResolveTarget | undefined {
  const q = normalizeGuess(chunk);
  if (!q) return undefined;

  const byTicker = pool.filter((c) => c.tickers.some((t) => normalizeGuess(t.split(".")[0]) === q));
  if (byTicker.length === 1) return byTicker[0];

  const byName = pool.filter(
    (c) =>
      normalizeGuess(c.name) === q ||
      coreName(c.name) === q ||
      c.aliases.map(normalizeGuess).includes(q),
  );
  if (byName.length === 1) return byName[0];
  if (byName.length > 1 || byTicker.length > 1) return undefined; // ambiguous — refuse to guess

  const fuzzy = pool.filter((c) =>
    matchesCompany(chunk, {
      id: c.id,
      name: c.name,
      ticker: c.tickers[0] ?? "",
      aliases: c.aliases,
    }),
  );
  return fuzzy.length === 1 ? fuzzy[0] : undefined;
}

export function parseCustomList(
  text: string,
  pool: ResolveTarget[],
): { resolved: string[]; unresolved: string[] } {
  const resolved: string[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();
  const add = (c: ResolveTarget) => {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      resolved.push(c.id);
    }
  };

  for (const chunk of text.split(/[\n,;]+/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const whole = resolveOne(trimmed, pool);
    if (whole) {
      add(whole);
      continue;
    }
    // fall back to space-separated tokens (ticker lists)
    const tokens = trimmed.split(/\s+/);
    if (tokens.length > 1) {
      for (const token of tokens) {
        const hit = resolveOne(token, pool);
        if (hit) add(hit);
        else unresolved.push(token);
      }
    } else {
      unresolved.push(trimmed);
    }
  }
  return { resolved, unresolved };
}
