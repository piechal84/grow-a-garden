import { CROPS_BY_ID, type Crop } from "./gameData";

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

/**
 * Moon Shop crops sit at the TOP of the same 8-rung rarity ladder the regular Seed Shop
 * uses (CROP_TIER_LABELS/CROP_TIER_COLORS in gameData.ts) rather than restarting their own
 * scale — so Moon Blossom (moon "legendary") displays as "Celestial", the very top tier,
 * and even the "common" moon crop reads as rarer than most regular-shop crops.
 */
export const MOON_TIER_TO_CROP_TIER: Record<MoonTier, number> = {
  common: 2,
  uncommon: 3,
  rare: 4,
  epic: 5,
  mythic: 6,
  legendary: 7,
};

export const MOON_PACK_COST = 500;

/** Mirrors the server's weighting, for display odds only — the real roll happens server-side. Every pack guarantees a seed. */
export const MOON_PACK_ODDS: { pct: number; tier: MoonTier }[] = [
  { pct: 46.2, tier: "common" },
  { pct: 27.7, tier: "uncommon" },
  { pct: 15.4, tier: "rare" },
  { pct: 7.7, tier: "epic" },
  { pct: 2.3, tier: "mythic" },
  { pct: 0.8, tier: "legendary" },
];

/** Purely cosmetic — rolled server-side when a Moon Blossom is planted (or regrows), so
 *  reclaiming and replanting is a valid way to reroll for a rarer color. */
export type BlossomColor = "purple" | "blue" | "yellow" | "grey";

export function getCropDef(cropId: string): Crop | MoonCrop | undefined {
  return CROPS_BY_ID[cropId] ?? MOON_CROPS_BY_ID[cropId];
}

/** All footprints a seed might land on — used to keep the plant picker from wrongly greying out variable-shape seeds. */
export function possibleFootprints(cropId: string, baseFootprint: { w: number; h: number }): { w: number; h: number }[] {
  const moon = MOON_CROPS_BY_ID[cropId];
  if (moon?.variableFootprint) return [{ w: 2, h: 1 }, { w: 1, h: 2 }];
  return [baseFootprint];
}
