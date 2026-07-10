/** Display formatting helpers — pure, no deps. */

/** 4_600_000_000_000 → "$4.60T", 206_500_000_000 → "$207B", 850_000_000 → "$850M" */
export function formatCap(usd: number): string {
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 10e9) return `$${Math.round(usd / 1e9)}B`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  return `$${Math.round(usd / 1e6)}M`;
}

/** ISO-3166 alpha-2 → flag emoji ("DE" → 🇩🇪). */
export function flagEmoji(iso: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso)) return "🌐";
  const base = 0x1f1e6 - 65;
  const [a, b] = iso.toUpperCase();
  return String.fromCodePoint(base + a.charCodeAt(0), base + b.charCodeAt(0));
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}
