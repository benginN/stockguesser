/**
 * Client autocomplete over the slim search index: MiniSearch for typo-tolerant
 * prefix search, with exact ticker/alias hits pinned to the top via matching.ts.
 */
import MiniSearch from "minisearch";
import { matchesCompany, normalizeGuess } from "../game/matching.ts";
import type { SearchEntry } from "./data.ts";

export interface Suggestion extends SearchEntry {
  exact: boolean;
}

export class CompanySearch {
  private mini: MiniSearch<SearchEntry>;
  private byId = new Map<string, SearchEntry>();

  constructor(entries: SearchEntry[]) {
    this.mini = new MiniSearch<SearchEntry>({
      fields: ["name", "ticker", "aliases"],
      storeFields: [],
      processTerm: (term) => normalizeGuess(term) || null,
      extractField: (doc, field) =>
        field === "aliases" ? doc.aliases.join(" ") : String(doc[field as keyof SearchEntry] ?? ""),
    });
    this.mini.addAll(entries);
    for (const e of entries) this.byId.set(e.id, e);
  }

  get(id: string): SearchEntry | undefined {
    return this.byId.get(id);
  }

  suggest(query: string, limit = 8): Suggestion[] {
    const q = query.trim();
    if (q.length < 1) return [];
    const results = this.mini.search(q, {
      prefix: true,
      fuzzy: q.length >= 5 ? 0.2 : false,
      combineWith: "AND",
    });
    const out: Suggestion[] = [];
    const seen = new Set<string>();
    // exact matches first (ticker "SAP", alias "facebook") regardless of MiniSearch score
    for (const entry of this.byId.values()) {
      if (out.length >= limit) break;
      const t = entry.ticker.split(".")[0].toLowerCase();
      if (t === q.toLowerCase() || entry.aliases.includes(normalizeGuess(q))) {
        if (matchesCompany(q, entry) && !seen.has(entry.id)) {
          seen.add(entry.id);
          out.push({ ...entry, exact: true });
        }
      }
    }
    for (const r of results) {
      if (out.length >= limit) break;
      if (seen.has(String(r.id))) continue;
      const entry = this.byId.get(String(r.id));
      if (!entry) continue;
      seen.add(entry.id);
      out.push({ ...entry, exact: false });
    }
    return out;
  }
}
