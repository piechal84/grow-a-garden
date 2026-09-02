import { CROPS_BY_ID, type Crop } from "./gameData.js";
import { MOON_CROPS_BY_ID, type MoonCrop } from "./moonData.js";
import { VIKING_CROPS_BY_ID, type VikingCrop } from "./vikingData.js";

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
  /** Divine (mythic) and Celestial (legendary) solar crops pay out in Diamonds instead of coins
   *  when sold — a flat per-unit amount, not scaled by size/mutation multipliers. */
  diamondReward?: number;
}

// Solar Packs cost 1 diamond a pull (SOLAR_PACK_COST below) — effectively DIAMOND_BUY_RATE
// (1,000,000) coins if bought outright, regardless of which tier the pull happens to land on.
// That acquisition cost is completely disconnected from crop tier, unlike the coin-priced Moon
// Pack (500 coins) — so even the coin-paying Solar crops (everything below Mythic, which pays
// Diamonds directly) need a base sell price well above their Moon-crop counterparts to not feel
// like a bad deal. Each is priced at least 15% above Moon Blossom's 20,000 sell price.
export const SOLAR_CROPS: SolarCrop[] = [
  { id: "solstice_peach", name: "Solstice Peach", emoji: "🍑", tier: "common", growSeconds: 40, sellPrice: 23000, footprint: { w: 1, h: 1 } },
  { id: "radiant_lemon", name: "Radiant Lemon", emoji: "🍋", tier: "uncommon", growSeconds: 55, sellPrice: 55000, footprint: { w: 1, h: 1 } },
  { id: "blazing_pineapple", name: "Blazing Pineapple", emoji: "🍍", tier: "rare", growSeconds: 75, sellPrice: 120000, footprint: { w: 1, h: 1 }, persistent: true },
  { id: "corona_orange", name: "Corona Orange", emoji: "🍊", tier: "epic", growSeconds: 100, sellPrice: 300000, footprint: { w: 2, h: 1 }, variableFootprint: true, persistent: true },
  { id: "phoenix_sunflower", name: "Phoenix Sunflower", emoji: "🌻", tier: "mythic", growSeconds: 140, sellPrice: 6000, footprint: { w: 2, h: 1 }, variableFootprint: true, persistent: true, diamondReward: 1 },
  { id: "sun_blossom", name: "Sun Blossom", emoji: "☀️", tier: "legendary", growSeconds: 200, sellPrice: 20000, footprint: { w: 2, h: 2 }, persistent: true, diamondReward: 2 },
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

/** All four crop tables in one lookup — regular, Moon, Solar, and Viking. */
export function getAnyCropDef(cropId: string): Crop | MoonCrop | SolarCrop | VikingCrop | undefined {
  return CROPS_BY_ID[cropId] ?? MOON_CROPS_BY_ID[cropId] ?? SOLAR_CROPS_BY_ID[cropId] ?? VIKING_CROPS_BY_ID[cropId];
}
