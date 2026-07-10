/**
 * Guess → company matching (ROADMAP §2.5.7). Pure and dependency-free; used by
 * the autocomplete ranking now and Index Recall's free-text acceptance later.
 *
 * Accepts: exact ticker (with or without exchange suffix), exact normalized
 * name/alias, long-enough prefixes of multiword names, small typos in long
 * names. Rejects anything under 3 chars that isn't an exact ticker/alias and
 * lazy prefixes of a single long word.
 */

export interface Matchable {
  id: string;
  name: string;
  ticker: string;
  aliases: string[];
}

/** Fold accents/umlauts, lowercase, strip punctuation, collapse whitespace. */
export function normalizeGuess(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[''`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance with early exit; small strings only. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/** Typo budget scaled to name length (per-name thresholds, §2.5.7). */
function typoBudget(len: number): number {
  if (len >= 10) return 2;
  if (len >= 6) return 1;
  return 0;
}

export function matchesCompany(input: string, company: Matchable): boolean {
  const guess = normalizeGuess(input);
  if (!guess) return false;

  const tickerBase = normalizeGuess(company.ticker.split(".")[0]);
  const name = normalizeGuess(company.name);
  const aliases = company.aliases.map(normalizeGuess);

  // exact ticker or exact alias/name: any length goes ("3i", "hm" via alias)
  if (guess === tickerBase || guess === name || aliases.includes(guess)) return true;

  // everything below needs a real attempt
  if (guess.length < 4) return false;

  // prefix of a multiword name: must cover the first word entirely
  const firstWord = name.split(" ")[0];
  if (name.startsWith(guess) && guess.length >= Math.min(firstWord.length, 6) && guess.length >= 4)
    return true;

  // typo tolerance on full name / long aliases
  const budget = typoBudget(name.length);
  if (budget > 0 && editDistance(guess, name, budget) <= budget) return true;
  for (const alias of aliases) {
    const b = typoBudget(alias.length);
    if (b > 0 && alias.length >= 6 && editDistance(guess, alias, b) <= b) return true;
  }
  return false;
}
