/**
 * Turn raw scrape + enrichment data into canonical Company and Index records.
 *
 * Dedup model (ROADMAP §2.5.1): symbols and normalized names form a bipartite
 * graph; connected components via union-find merge every listing of a company
 * even when sources name it differently ("Amazon" / "Amazon.com, Inc.").
 * Within a component, market caps must agree within 60% of the largest — the
 * caps of one company's listings track each other, so cap CLUSTERS split
 * genuinely different companies that share a name (Merck & Co vs Merck KGaA,
 * Compass Inc vs Compass Group). Each cluster becomes one Company.
 */
import type { RawConstituent } from "./constituents.ts";
import type { QuoteLite, ProfileLite } from "./enrich.ts";
import { toUSD, type FxSnapshot } from "./fx.ts";
import { INDICES } from "../config/indices.ts";
import {
  COUNTRY_MAP,
  YAHOO_SECTOR_MAP,
  GICS_SECTOR_ALIASES,
  capBracket,
  type CapBracket,
  type Region,
  type Sector,
} from "../config/taxonomy.ts";
import { normalizeName, slugify, log } from "../lib/util.ts";

export interface Listing {
  ticker: string;
  exchange: string;
  primary: boolean;
}

export interface Company {
  id: string;
  name: string;
  aliases: string[];
  listings: Listing[];
  country: string;
  region: Region;
  sector: Sector;
  industry: string;
  marketCapUSD: number;
  capBracket: CapBracket;
  currency: string;
  ipoYear?: number;
  employees?: number;
  website?: string;
  indexMemberships: string[];
  tier: 1 | 2;
  updatedAt: string;
}

export interface IndexOut {
  id: string;
  displayName: string;
  provider: string;
  region: Region | "Global";
  holdings: { companyId: string; weight?: number }[];
  source: string;
  updatedAt: string;
}

export interface BuildProblem {
  level: "critical" | "warn";
  symbol: string;
  message: string;
}

interface CompanyOverride {
  _why: string;
  name?: string;
  country?: string;
  sector?: string;
  industry?: string;
  aliases?: string[];
}

export interface BuildInput {
  constituents: RawConstituent[];
  /** non-index universe (EDGAR top caps), yahoo symbols */
  extraSymbols: string[];
  quotes: Map<string, QuoteLite>;
  profiles: Map<string, ProfileLite>;
  fx: FxSnapshot;
  manualAliases: Record<string, string[]>;
  companyOverrides: Record<string, CompanyOverride>;
  tier1Target: number;
  totalTarget: number;
}

/** Display-name cleanup: drop share-class parentheticals, "The" and one legal suffix. */
export function displayName(name: string): string {
  return name
    .replace(/\s*\((class [a-z]|[a-z] shares?)[^)]*\)/gi, "")
    .replace(/^the\s+/i, "")
    .replace(
      /\s+(new york registry shares?|american depositary shares?.*|sponsored adr.*|registry shares?)$/i,
      "",
    )
    .replace(
      /[,.]?\s+(incorporated|corporation|inc|corp|plc|p\.l\.c\.|n\.?v\.?|s\.?e\.?|a\.?g\.?|s\.?p\.?a\.?|kgaa)\.?$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

interface SymbolMeta {
  wikiNames: string[];
  indexIds: Set<string>;
  sector?: string;
  industry?: string;
}

export function buildDataset(input: BuildInput): {
  companies: Company[];
  indices: IndexOut[];
  problems: BuildProblem[];
  symbolToCompany: Map<string, Company>;
} {
  const { quotes, profiles, fx } = input;
  const problems: BuildProblem[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const capOf = (s: string): number => {
    const q = quotes.get(s);
    return q?.marketCap ? (toUSD(q.marketCap, q.currency ?? "USD", fx) ?? 0) : 0;
  };

  // ---- 1. union-find over symbols ∪ name-keys ----
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (cur !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    if (!parent.has(root)) parent.set(root, root);
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const symMeta = new Map<string, SymbolMeta>();
  const register = (symbol: string, wikiName?: string, c?: RawConstituent): void => {
    let meta = symMeta.get(symbol);
    if (!meta) symMeta.set(symbol, (meta = { wikiNames: [], indexIds: new Set() }));
    if (wikiName && !meta.wikiNames.includes(wikiName)) meta.wikiNames.push(wikiName);
    if (c) {
      meta.indexIds.add(c.indexId);
      meta.sector ??= c.sector;
      meta.industry ??= c.industry;
    }
    const q = quotes.get(symbol);
    for (const raw of [wikiName, q?.longName ?? q?.shortName]) {
      if (!raw) continue;
      const key = normalizeName(displayName(raw));
      if (key) union(`s:${symbol}`, `k:${key}`);
    }
  };

  for (const c of input.constituents) {
    if (!quotes.get(c.yahooSymbol)?.marketCap) {
      problems.push({
        level: "critical",
        symbol: c.yahooSymbol,
        message: `${c.indexId} constituent "${c.name}" has no quote/cap — fix ticker via overrides`,
      });
      continue;
    }
    register(c.yahooSymbol, c.name, c);
  }
  for (const s of input.extraSymbols) {
    if (quotes.get(s)?.marketCap) register(s, undefined);
  }

  // ---- 2. components → cap clusters → candidate companies ----
  const components = new Map<string, string[]>();
  for (const sym of symMeta.keys()) {
    const root = find(`s:${sym}`);
    const list = components.get(root) ?? [];
    list.push(sym);
    components.set(root, list);
  }

  interface Candidate {
    company: Company;
    symbols: string[];
    bestCapUSD: number;
    primarySymbol: string;
  }
  const candidates: Candidate[] = [];

  for (const symbols of components.values()) {
    const sorted = [...symbols].sort((a, b) => capOf(b) - capOf(a));
    // cap clustering: listings of one company report near-identical caps
    const clusters: { headCap: number; symbols: string[] }[] = [];
    for (const s of sorted) {
      const cluster = clusters.find((cl) => capOf(s) / cl.headCap > 0.6);
      if (cluster) cluster.symbols.push(s);
      else clusters.push({ headCap: capOf(s), symbols: [s] });
    }
    if (clusters.length > 1) {
      problems.push({
        level: "warn",
        symbol: sorted[0],
        message: `name group split into ${clusters.length} companies by cap: ${clusters
          .map((cl) => `${cl.symbols[0]} $${(cl.headCap / 1e9).toFixed(0)}B`)
          .join(" vs ")}`,
      });
    }

    for (const cluster of clusters) {
      // primary listing: an index member if any, else the largest cap
      const primary =
        cluster.symbols.find((s) => symMeta.get(s)!.indexIds.size > 0) ?? cluster.symbols[0];
      const q = quotes.get(primary)!;
      const metas = cluster.symbols.map((s) => symMeta.get(s)!);
      const indexIds = new Set(metas.flatMap((m) => [...m.indexIds]));
      const wikiName = metas.flatMap((m) => m.wikiNames)[0];
      const name = displayName(wikiName ?? q.longName ?? q.shortName ?? primary);
      const profile =
        profiles.get(primary) ?? cluster.symbols.map((s) => profiles.get(s)).find(Boolean);
      const wikiSector = metas.map((m) => m.sector).find(Boolean);
      const wikiIndustry = metas.map((m) => m.industry).find(Boolean);

      const sector =
        (wikiSector as Sector | undefined) ??
        (profile?.sector
          ? (YAHOO_SECTOR_MAP[profile.sector] ?? GICS_SECTOR_ALIASES[profile.sector])
          : undefined);
      const countryInfo = profile?.country ? COUNTRY_MAP[profile.country] : undefined;
      const capUSD = capOf(primary);

      candidates.push({
        company: {
          id: slugify(name),
          name,
          aliases: [],
          listings: cluster.symbols.map((s) => ({
            ticker: s,
            exchange: quotes.get(s)?.exchange ?? "?",
            primary: s === primary,
          })),
          country: countryInfo?.iso ?? "?",
          region: countryInfo?.region ?? ("?" as Region),
          sector: sector ?? ("?" as Sector),
          industry: wikiIndustry ?? profile?.industry ?? "?",
          marketCapUSD: Math.round(capUSD),
          capBracket: capBracket(capUSD),
          currency: q.currency === "GBp" ? "GBP" : (q.currency ?? "?"),
          ipoYear: q.firstTradeYear,
          employees: profile?.employees,
          website: profile?.website,
          indexMemberships: [...indexIds].sort(),
          tier: 2,
          updatedAt: today,
        },
        symbols: cluster.symbols,
        bestCapUSD: capUSD,
        primarySymbol: primary,
      });
    }
  }

  // ---- 3. apply company overrides, resolve missing fields ----
  for (const cand of candidates) {
    const o = input.companyOverrides[cand.company.id];
    if (o) {
      const { _why, aliases, ...fields } = o;
      void _why;
      Object.assign(cand.company, fields);
      if (aliases) cand.company.aliases.push(...aliases);
      const ci = fields.country
        ? Object.values(COUNTRY_MAP).find((c) => c.iso === fields.country)
        : undefined;
      if (ci) cand.company.region = ci.region;
    }
  }

  // drop non-index candidates with unresolvable fields; index members become criticals
  const complete = (c: Company) =>
    c.sector !== ("?" as Sector) && c.country !== "?" && c.region !== ("?" as Region);
  const usable: Candidate[] = [];
  let droppedIncomplete = 0;
  for (const cand of candidates) {
    if (complete(cand.company)) {
      usable.push(cand);
    } else if (cand.company.indexMemberships.length > 0) {
      problems.push({
        level: "critical",
        symbol: cand.primarySymbol,
        message: `index member "${cand.company.name}" missing ${[
          cand.company.sector === ("?" as Sector) && "sector",
          cand.company.country === "?" && "country",
        ]
          .filter(Boolean)
          .join("+")} — add to companyOverrides`,
      });
    } else {
      droppedIncomplete++;
    }
  }
  log("build", `dropped ${droppedIncomplete} incomplete non-index companies`);

  // ---- 4. tiering: index members are Tier 1; top up with the largest caps ----
  usable.sort((a, b) => b.bestCapUSD - a.bestCapUSD);
  let tier1 = 0;
  for (const cand of usable) {
    if (cand.company.indexMemberships.length > 0) {
      cand.company.tier = 1;
      tier1++;
    }
  }
  for (const cand of usable) {
    if (tier1 >= input.tier1Target) break;
    if (cand.company.tier !== 1) {
      cand.company.tier = 1;
      tier1++;
    }
  }
  const finalCands = usable.slice(0, Math.max(input.totalTarget, tier1));

  // ---- 5. unique ids; aliases assembled last ----
  const idCount = new Map<string, number>();
  for (const cand of finalCands) {
    const n = idCount.get(cand.company.id) ?? 0;
    idCount.set(cand.company.id, n + 1);
    if (n > 0) cand.company.id = `${cand.company.id}-${n + 1}`;
  }
  const symbolToCompany = new Map<string, Company>();
  for (const cand of finalCands) {
    const c = cand.company;
    const tickerAliases = c.listings.map((l) => l.ticker.split(".")[0].toLowerCase());
    const manual = input.manualAliases[c.id] ?? [];
    c.aliases = [
      ...new Set([...c.aliases, normalizeName(c.name), ...tickerAliases, ...manual]),
    ].filter((a) => a && a !== c.name.toLowerCase());
    for (const s of cand.symbols) symbolToCompany.set(s, c);
  }

  // ---- 6. index holdings + weights ----
  const indices: IndexOut[] = [];
  for (const cfg of INDICES) {
    const members = input.constituents.filter((c) => c.indexId === cfg.id);
    const resolved = new Map<string, { company: Company; measure: number }>();
    for (const m of members) {
      const company = symbolToCompany.get(m.yahooSymbol);
      if (!company) continue; // already reported critical above
      const q = quotes.get(m.yahooSymbol);
      const measure = cfg.weightBasis === "price" ? (q?.price ?? 0) : company.marketCapUSD;
      const prev = resolved.get(company.id);
      resolved.set(company.id, { company, measure: (prev?.measure ?? 0) + measure });
    }
    const total = [...resolved.values()].reduce((sum, r) => sum + r.measure, 0);
    indices.push({
      id: cfg.id,
      displayName: cfg.displayName,
      provider: cfg.provider,
      region: cfg.region,
      holdings: [...resolved.values()]
        .sort((a, b) => b.measure - a.measure)
        .map((r) => ({
          companyId: r.company.id,
          weight: total > 0 ? Math.round((r.measure / total) * 10000) / 100 : undefined,
        })),
      source:
        cfg.parser === "nasdaq-api"
          ? "https://api.nasdaq.com/api/quote/list-type/nasdaq100"
          : `https://en.wikipedia.org/wiki/${cfg.wikiPage}`,
      updatedAt: today,
    });
  }

  const companies = finalCands.map((c) => c.company);
  log(
    "build",
    `${companies.length} companies (${companies.filter((c) => c.tier === 1).length} tier-1), ${indices.length} indices, ${problems.filter((p) => p.level === "critical").length} criticals`,
  );
  return { companies, indices, problems, symbolToCompany };
}
