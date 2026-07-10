/**
 * Cached, throttled, retrying HTTP for the pipeline.
 * Every external byte flows through here so re-runs are cheap (disk cache in
 * pipeline/.cache/) and no source gets hammered (per-host min interval).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", ".cache");
const USER_AGENT = "stock-guesser-pipeline/0.1 (orhanbengin@gmail.com)";
const DEFAULT_TTL_HOURS = 72;

const hostMinIntervalMs: Record<string, number> = {
  "en.wikipedia.org": 600,
  "www.sec.gov": 400,
  default: 300,
};
const lastRequestAt = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle(url: string): Promise<void> {
  const host = new URL(url).host;
  const min = hostMinIntervalMs[host] ?? hostMinIntervalMs.default;
  const wait = (lastRequestAt.get(host) ?? 0) + min - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

function cachePath(key: string): string {
  return join(CACHE_DIR, createHash("sha256").update(key).digest("hex").slice(0, 32));
}

function readCache(key: string, ttlHours: number): string | undefined {
  const path = cachePath(key);
  if (!existsSync(path)) return undefined;
  const ageHours = (Date.now() - statSync(path).mtimeMs) / 3_600_000;
  return ageHours <= ttlHours ? readFileSync(path, "utf8") : undefined;
}

function writeCache(key: string, body: string): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(key), body);
}

/** GET a URL as text, with disk cache, throttling, and 3 retries with backoff. */
export async function cachedText(
  url: string,
  ttlHours = DEFAULT_TTL_HOURS,
  headers?: Record<string, string>,
): Promise<string> {
  const hit = readCache(url, ttlHours);
  if (hit !== undefined) return hit;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await throttle(url);
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers } });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });
      const body = await res.text();
      writeCache(url, body);
      return body;
    } catch (err) {
      lastError = err;
      if ((err as { fatal?: boolean }).fatal) break;
      await sleep(1500 * attempt * attempt);
    }
  }
  throw lastError;
}

export async function cachedJson<T = unknown>(url: string, ttlHours?: number): Promise<T> {
  return JSON.parse(await cachedText(url, ttlHours)) as T;
}

/**
 * Memoize an arbitrary async producer (e.g. a yahoo-finance2 call) on disk.
 * Cached `undefined` results are stored as a tombstone so known-bad symbols
 * aren't refetched every run.
 */
export async function memo<T>(
  key: string,
  fn: () => Promise<T>,
  ttlHours = DEFAULT_TTL_HOURS,
): Promise<T> {
  const hit = readCache(`memo:${key}`, ttlHours);
  if (hit !== undefined) return (JSON.parse(hit) as { v: T }).v;
  const value = await fn();
  writeCache(`memo:${key}`, JSON.stringify({ v: value }));
  return value;
}

/** Non-fetching cache read for memo() keys: distinguishes miss from cached-null. */
export function peekMemo<T>(
  key: string,
  ttlHours = DEFAULT_TTL_HOURS,
): { hit: boolean; value?: T } {
  const raw = readCache(`memo:${key}`, ttlHours);
  if (raw === undefined) return { hit: false };
  return { hit: true, value: (JSON.parse(raw) as { v: T }).v };
}

/** Run tasks over items with bounded concurrency; collects results in order. */
export async function pMap<I, O>(
  items: readonly I[],
  worker: (item: I, index: number) => Promise<O>,
  concurrency: number,
): Promise<O[]> {
  const results: O[] = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(lanes);
  return results;
}
