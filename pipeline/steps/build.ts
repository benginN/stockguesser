/**
 * Turn raw scrape + enrichment data into canonical Company and Index records.
 * The heart of the dedup logic: every listing (GOOG/GOOGL, SAP Frankfurt/NYSE)
 * groups into ONE company keyed by normalized name; caps must agree within 40%
 * or the group is split and logged (two different companies sharing a name).
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
  /** yahoo symbol → member index ids */
  extraSymbols: string[]; // non-index universe (EDGAR top caps), yahoo symbols
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
    .replace(/[,.]?\s+(incorporated|corporation|inc|corp|plc|p\.l\.c\.)\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface Group {
  key: string;
  symbols: string[];
  wikiNames: string[];
  wikiSector?: string;
  wikiIndustry?: string;
  indexIds: Set<string>;
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

  // ---- 1. group every symbol by normalized company name ----
  const groups = new Map<string, Group>();
  const nameOf = (symbol: string, wikiName?: string): string | undefined => {
    const q = quotes.get(symbol);
    return wikiName ?? q?.longName ?? q?.shortName;
  };
  const addToGroup = (symbol: string, wikiName: string | undefined, c?: RawConstituent) => {
    const raw = nameOf(symbol, wikiName);
    if (!raw) return;
    const key = normalizeName(displayName(raw));
    if (!key) return;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, symbols: [], wikiNames: [], indexIds: new Set() }));
    if (!g.symbols.includes(symbol)) g.symbols.push(symbol);
    if (wikiName) g.wikiNames.push(wikiName);
    if (c) {
      g.indexIds.add(c.indexId);
      g.wikiSector ??= c.sector;
      g.wikiIndustry ??= c.industry;
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
    addToGroup(c.yahooSymbol, c.name, c);
  }
  for (const s of input.extraSymbols) {
    if (quotes.get(s)?.marketCap) addToGroup(s, undefined);
  }

  // ---- 2. build a candidate company per group ----
  interface Candidate {
    company: Company;
    symbols: string[];
    bestCapUSD: number;
    primarySymbol: string;
  }
  const candidates: Candidate[] = [];

  for (const g of groups.values()) {
    // pick primary listing: the index-member symbol with the largest cap, else largest cap
    const capOf = (s: string) => {
      const q = quotes.get(s)!;
      return toUSD(q.marketCap!, q.currency ?? "USD", fx) ?? 0;
    };
    const sorted = [...g.symbols].sort((a, b) => capOf(b) - capOf(a));
    // sanity: listings of one company must report similar caps; split off disagreers
    const primary = sorted[0];
    const primaryCap = capOf(primary);
    const kept = sorted.filter((s) => {
      const ratio = capOf(s) / primaryCap;
      if (ratio > 0.6 || g.symbols.length === 1) return true;
      problems.push({
        level: "warn",
        symbol: s,
        message: `split from "${g.key}" group: cap ${(ratio * 100).toFixed(0)}% of primary ${primary}`,
      });
      return false;
    });

    const q = quotes.get(primary)!;
    const profile = profiles.get(primary) ?? kept.map((s) => profiles.get(s)).find(Boolean);
    const wikiName = g.wikiNames[0];
    const name = displayName(wikiName ?? q.longName ?? q.shortName ?? primary);

    const sector =
      (g.wikiSector as Sector | undefined) ??
      (profile?.sector ? YAHOO_SECTOR_MAP[profile.sector] : undefined) ??
      (profile?.sector ? GICS_SECTOR_ALIASES[profile.sector] : undefined);
    const countryInfo = profile?.country ? COUNTRY_MAP[profile.country] : undefined;
    const capUSD = primaryCap;

    const company: Company = {
      id: slugify(name),
      name,
      aliases: [],
      listings: kept.map((s) => ({
        ticker: s,
        exchange: quotes.get(s)?.exchange ?? "?",
        primary: s === primary,
      })),
      country: countryInfo?.iso ?? "?",
      region: countryInfo?.region ?? ("?" as Region),
      sector: sector ?? ("?" as Sector),
      industry: g.wikiIndustry ?? profile?.industry ?? "?",
      marketCapUSD: Math.round(capUSD),
      capBracket: capBracket(capUSD),
      currency: q.currency === "GBp" ? "GBP" : (q.currency ?? "?"),
      ipoYear: q.firstTradeYear,
      employees: profile?.employees,
      website: profile?.website,
      indexMemberships: [...g.indexIds].sort(),
      tier: 2,
      updatedAt: today,
    };
    candidates.push({ company, symbols: kept, bestCapUSD: capUSD, primarySymbol: primary });
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

  // ---- 5. ids must be unique; aliases assembled last ----
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
    const nameAliases = [normalizeName(c.name)].filter(Boolean);
    const manual = input.manualAliases[c.id] ?? [];
    c.aliases = [...new Set([...c.aliases, ...nameAliases, ...tickerAliases, ...manual])].filter(
      (a) => a && a !== c.name.toLowerCase(),
    );
    for (const s of cand.symbols) symbolToCompany.set(s, c);
  }

  // ---- 6. index holdings + weights ----
  const bySymbol = (s: string) => symbolToCompany.get(s);
  const indices: IndexOut[] = [];
  for (const cfg of INDICES) {
    const members = input.constituents.filter((c) => c.indexId === cfg.id);
    const resolved = new Map<string, { company: Company; measure: number }>();
    for (const m of members) {
      const company = bySymbol(m.yahooSymbol);
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
