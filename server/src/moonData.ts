import { CROPS_BY_ID, type Crop } from "./gameData.js";

export type MoonTier = "common" | "uncommon" | "rare" | "epic" | "mythic" | "legendary";

export interface MoonCrop {
  id: string;
  name: string;
  emoji: string;
  tier: MoonTier;
  growSeconds: number;
  sellPrice: number;
  footprint: { w: number; h: number };
  /** Epic/Mythic seeds roll a random 2x1 or 1x2 orientation at plant time instead of a fixed shape. */
  variableFootprint?: boolean;
  /** Persistent crops regrow in place after harvest instead of being consumed — a one-time seed cost. */
  persistent?: boolean;
}

export const MOON_CROPS: MoonCrop[] = [
  { id: "moondew_melon", name: "Moondew Melon", emoji: "🍈", tier: "common", growSeconds: 40, sellPrice: 150, footprint: { w: 1, h: 1 } },
  { id: "lunar_grape", name: "Lunar Grape", emoji: "🍇", tier: "uncommon", growSeconds: 55, sellPrice: 400, footprint: { w: 1, h: 1 } },
  { id: "crescent_mango", name: "Crescent Mango", emoji: "🥭", tier: "rare", growSeconds: 75, sellPrice: 900, footprint: { w: 1, h: 1 }, persistent: true },
  { id: "eclipse_kiwi", name: "Eclipse Kiwi", emoji: "🥝", tier: "epic", growSeconds: 100, sellPrice: 2200, footprint: { w: 2, h: 1 }, variableFootprint: true, persistent: true },
  { id: "nebula_cherry", name: "Nebula Cherry", emoji: "🍒", tier: "mythic", growSeconds: 140, sellPrice: 6000, footprint: { w: 2, h: 1 }, variableFootprint: true, persistent: true },
  { id: "moon_blossom", name: "Moon Blossom", emoji: "🌙", tier: "legendary", growSeconds: 200, sellPrice: 20000, footprint: { w: 2, h: 2 }, persistent: true },
];

export const MOON_CROPS_BY_ID: Record<string, MoonCrop> = Object.fromEntries(MOON_CROPS.map((c) => [c.id, c]));

export const MOON_TIER_ORDER: MoonTier[] = ["common", "uncommon", "rare", "epic", "mythic", "legendary"];

export const MOON_PACK_COST = 500;

interface PackWeight {
  kind: MoonTier;
  weight: number;
}

/** Sums to 6500 → common 46.2%, uncommon 27.7%, rare 15.4%, epic 7.7%, mythic 2.3%, legendary 0.8%. Every pack guarantees a seed. */
export const MOON_PACK_WEIGHTS: PackWeight[] = [
  { kind: "common", weight: 3000 },
  { kind: "uncommon", weight: 1800 },
  { kind: "rare", weight: 1000 },
  { kind: "epic", weight: 500 },
  { kind: "mythic", weight: 150 },
  { kind: "legendary", weight: 50 },
];

export interface PackResult {
  kind: MoonTier;
  cropId: string;
}

export function rollMoonPack(): PackResult {
  const total = MOON_PACK_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
  let r = Math.random() * total;
  for (const w of MOON_PACK_WEIGHTS) {
    if (r < w.weight) {
      const crop = MOON_CROPS.find((c) => c.tier === w.kind)!;
      return { kind: w.kind, cropId: crop.id };
    }
    r -= w.weight;
  }
  const fallback = MOON_CROPS[0];
  return { kind: fallback.tier, cropId: fallback.id };
}

/** Resolves the actual footprint a seed will occupy, rolling a random orientation for variable-footprint crops. */
export function resolveFootprint(cropId: string, fallback: { w: number; h: number }): { w: number; h: number } {
  const moon = MOON_CROPS_BY_ID[cropId];
  if (moon?.variableFootprint) {
    return Math.random() < 0.5 ? { w: 2, h: 1 } : { w: 1, h: 2 };
  }
  return fallback;
}

export function getCropDef(cropId: string): Crop | MoonCrop | undefined {
  return CROPS_BY_ID[cropId] ?? MOON_CROPS_BY_ID[cropId];
}
