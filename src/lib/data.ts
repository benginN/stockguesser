/**
 * Static-artifact loaders. Only the search index is fetched eagerly; stocks
 * and the schedule load when a mode needs them, sparklines only for the card.
 * Everything is memoized per session (module-level promises).
 */
import type { GameCompany } from "../game/feedback.ts";
import type { DailySchedule } from "../game/seed.ts";

export interface CompanyRecord extends GameCompany {
  aliases: string[];
  listings: { ticker: string; exchange: string; primary: boolean }[];
  currency: string;
  ipoYear?: number;
  employees?: number;
  tier: 1 | 2;
}

export interface SearchEntry {
  id: string;
  ticker: string;
  name: string;
  aliases: string[];
  tier: 1 | 2;
}

const BASE = import.meta.env.BASE_URL;

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}data/${path}`);
  if (!res.ok) throw new Error(`failed to load ${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

let stocksPromise: Promise<{ snapshotVersion: string; companies: CompanyRecord[] }> | undefined;
export function loadStocks() {
  return (stocksPromise ??= fetchJSON("stocks.json"));
}

let searchPromise: Promise<{ snapshotVersion: string; entries: SearchEntry[] }> | undefined;
export function loadSearchIndex() {
  return (searchPromise ??= fetchJSON("search-index.json"));
}

let schedulePromise: Promise<DailySchedule> | undefined;
export function loadDailySchedule() {
  return (schedulePromise ??= fetchJSON("daily-schedule.json"));
}

export interface IndexRecord {
  id: string;
  displayName: string;
  provider: string;
  region: string;
  holdings: { companyId: string; weight?: number }[];
}

let indicesPromise: Promise<{ snapshotVersion: string; indices: IndexRecord[] }> | undefined;
export function loadIndices() {
  return (indicesPromise ??= fetchJSON("indices.json"));
}

let sparklinesPromise: Promise<{ sparklines: Record<string, number[]> }> | undefined;
export function loadSparklines() {
  return (sparklinesPromise ??= fetchJSON("sparklines.json"));
}
