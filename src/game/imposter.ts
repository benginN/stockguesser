/**
 * Imposter rounds (ROADMAP §1.2 variant 3): 4 companies, exactly one is NOT in
 * the index. Non-ambiguity is guaranteed structurally — the imposter is drawn
 * only from companies whose indexMemberships (validated pipeline data) exclude
 * the index, and members are drawn from its holdings.
 */
import type { GameCompany } from "./feedback.ts";

export interface ImposterRound {
  options: GameCompany[]; // 4, shuffled
  imposterId: string;
}

export function generateImposterRound(
  indexId: string,
  members: GameCompany[],
  outsiders: GameCompany[],
  rng: () => number,
): ImposterRound | null {
  const realMembers = members.filter((c) => c.indexMemberships.includes(indexId));
  const cleanOutsiders = outsiders.filter((c) => !c.indexMemberships.includes(indexId));
  if (realMembers.length < 3 || cleanOutsiders.length < 1) return null;

  const shuffled = [...realMembers].sort(() => rng() - 0.5);
  const three = shuffled.slice(0, 3);
  // plausible imposter: prefer one sharing a sector with a shown member
  const sectors = new Set(three.map((c) => c.sector));
  const plausible = cleanOutsiders.filter((c) => sectors.has(c.sector));
  const from = plausible.length > 0 ? plausible : cleanOutsiders;
  const imposter = from[Math.floor(rng() * from.length)];

  const options = [...three, imposter].sort(() => rng() - 0.5);
  return { options, imposterId: imposter.id };
}
