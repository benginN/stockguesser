/** Small pure helpers shared across pipeline steps. */

/** "Münchener Rück AG" → "munchener-ruck-ag" — stable company ids. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/gi, "o")
    .replace(/æ/gi, "ae")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LEGAL_SUFFIXES =
  /[,.]?\s+(incorporated|corporation|company|limited|holdings?|group|inc|corp|co|ltd|plc|ag|se|sa|s\.a\.|nv|n\.v\.|spa|s\.p\.a\.|ab|asa|oyj|kk|k\.k\.|kgaa|gmbh|llc|lp|adr)\.?$/i;

/** Normalize a company name for matching/grouping: fold accents, strip legal suffixes. */
export function normalizeName(name: string): string {
  let n = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[''`´]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // strip up to two trailing legal suffixes ("SAP SE", "Toyota Motor Corp Ltd")
  for (let i = 0; i < 2; i++) {
    const stripped = n.replace(LEGAL_SUFFIXES, "").trim();
    if (stripped === n || stripped.length < 3) break;
    n = stripped;
  }
  return n;
}

/** Strip Wikipedia footnote markers and collapse whitespace in a table cell. */
export function cleanCell(text: string): string {
  return text
    .replace(/\[[a-z0-9]+\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function log(step: string, message: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${step.padEnd(10)} ${message}`);
}
