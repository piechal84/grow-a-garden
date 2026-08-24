import type { Crop } from "./gameData";
import { getCropDef as getRegularOrMoonCropDef, MOON_CROPS_BY_ID, type MoonCrop } from "./moonData";

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

/** Same top-of-the-ladder placement as Moon crops — see MOON_TIER_TO_CROP_TIER for why. */
export const SOLAR_TIER_TO_CROP_TIER: Record<SolarTier, number> = {
  common: 2,
  uncommon: 3,
  rare: 4,
  epic: 5,
  mythic: 6,
  legendary: 7,
};

/** Diamonds, not coins — Diamonds only come from the Premium Shop. */
export const SOLAR_PACK_COST = 1;

/** Mirrors the server's weighting, for display odds only — the real roll happens server-side. */
export const SOLAR_PACK_ODDS: { pct: number; tier: SolarTier }[] = [
  { pct: 46.2, tier: "common" },
  { pct: 27.7, tier: "uncommon" },
  { pct: 15.4, tier: "rare" },
  { pct: 7.7, tier: "epic" },
  { pct: 2.3, tier: "mythic" },
  { pct: 0.8, tier: "legendary" },
];

/** All three crop tables in one lookup — regular, Moon, and Solar. */
export function getAnyCropDef(cropId: string): Crop | MoonCrop | SolarCrop | undefined {
  return getRegularOrMoonCropDef(cropId) ?? SOLAR_CROPS_BY_ID[cropId];
}

/** All footprints a seed might land on, across every table — used to keep the plant picker from
 *  wrongly greying out variable-shape seeds. */
export function possibleFootprintsAny(cropId: string, baseFootprint: { w: number; h: number }): { w: number; h: number }[] {
  const moon = MOON_CROPS_BY_ID[cropId];
  const solar = SOLAR_CROPS_BY_ID[cropId];
  if (moon?.variableFootprint || solar?.variableFootprint) return [{ w: 2, h: 1 }, { w: 1, h: 2 }];
  return [baseFootprint];
}
