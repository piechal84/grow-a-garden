import { CROPS_BY_ID, type Crop } from "./gameData.js";
import { MOON_CROPS_BY_ID, type MoonCrop } from "./moonData.js";

/** Mirrors moonData.ts's structure exactly, but as the diamond-funded counterpart — the Solar
 *  Seed Pack. Moon and Solar shops never both feature at once (see weather.ts's getFeaturedShop). */
export type SolarTier = "common" | "uncommon" | "rare" | "epic" | "mythic" | "legendary";

export interface SolarCrop {
  id: string;
  name: string;
  emoji: string;
  tier: SolarTier;
  growSeconds: number;
  sellPrice: number;
  footprint: { w: number; h: number };
  variableFootprint?: boolean;
  persistent?: boolean;
}

export const SOLAR_CROPS: SolarCrop[] = [
  { id: "solstice_peach", name: "Solstice Peach", emoji: "🍑", tier: "common", growSeconds: 40, sellPrice: 150, footprint: { w: 1, h: 1 } },
  { id: "radiant_lemon", name: "Radiant Lemon", emoji: "🍋", tier: "uncommon", growSeconds: 55, sellPrice: 400, footprint: { w: 1, h: 1 } },
  { id: "blazing_pineapple", name: "Blazing Pineapple", emoji: "🍍", tier: "rare", growSeconds: 75, sellPrice: 900, footprint: { w: 1, h: 1 }, persistent: true },
  { id: "corona_orange", name: "Corona Orange", emoji: "🍊", tier: "epic", growSeconds: 100, sellPrice: 2200, footprint: { w: 2, h: 1 }, variableFootprint: true, persistent: true },
  { id: "phoenix_sunflower", name: "Phoenix Sunflower", emoji: "🌻", tier: "mythic", growSeconds: 140, sellPrice: 6000, footprint: { w: 2, h: 1 }, variableFootprint: true, persistent: true },
  { id: "sun_blossom", name: "Sun Blossom", emoji: "☀️", tier: "legendary", growSeconds: 200, sellPrice: 20000, footprint: { w: 2, h: 2 }, persistent: true },
];

export const SOLAR_CROPS_BY_ID: Record<string, SolarCrop> = Object.fromEntries(SOLAR_CROPS.map((c) => [c.id, c]));

export const SOLAR_TIER_ORDER: SolarTier[] = ["common", "uncommon", "rare", "epic", "mythic", "legendary"];

/** Diamonds, not coins — Diamonds only come from the Premium Shop (see rooms.ts buyDiamonds). */
export const SOLAR_PACK_COST = 1;

interface PackWeight {
  kind: SolarTier;
  weight: number;
}

/** Same odds distribution as the Moon Pack, for consistency. */
export const SOLAR_PACK_WEIGHTS: PackWeight[] = [
  { kind: "common", weight: 3000 },
  { kind: "uncommon", weight: 1800 },
  { kind: "rare", weight: 1000 },
  { kind: "epic", weight: 500 },
  { kind: "mythic", weight: 150 },
  { kind: "legendary", weight: 50 },
];

export interface SolarPackResult {
  kind: SolarTier;
  cropId: string;
}

export function rollSolarPack(): SolarPackResult {
  const total = SOLAR_PACK_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
  let r = Math.random() * total;
  for (const w of SOLAR_PACK_WEIGHTS) {
    if (r < w.weight) {
      const crop = SOLAR_CROPS.find((c) => c.tier === w.kind)!;
      return { kind: w.kind, cropId: crop.id };
    }
    r -= w.weight;
  }
  const fallback = SOLAR_CROPS[0];
  return { kind: fallback.tier, cropId: fallback.id };
}

export function resolveSolarFootprint(cropId: string, fallback: { w: number; h: number }): { w: number; h: number } {
  const solar = SOLAR_CROPS_BY_ID[cropId];
  if (solar?.variableFootprint) {
    return Math.random() < 0.5 ? { w: 2, h: 1 } : { w: 1, h: 2 };
  }
  return fallback;
}

/** All three crop tables in one lookup — regular, Moon, and Solar. */
export function getAnyCropDef(cropId: string): Crop | MoonCrop | SolarCrop | undefined {
  return CROPS_BY_ID[cropId] ?? MOON_CROPS_BY_ID[cropId] ?? SOLAR_CROPS_BY_ID[cropId];
}
