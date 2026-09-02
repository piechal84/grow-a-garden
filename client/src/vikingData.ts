/** Mirrors moonData.ts's structure, but sourced from the Yggdrasil's research queue instead of a
 *  paid pack pull. Historic replaces Legendary as the top rung — the one place that tier can be
 *  grown rather than crafted (see gameData.ts's Kitsune Shrine for the other). */
export type VikingTier = "common" | "uncommon" | "rare" | "epic" | "mythic" | "historic";

export interface VikingCrop {
  id: string;
  name: string;
  emoji: string;
  tier: VikingTier;
  growSeconds: number;
  sellPrice: number;
  footprint: { w: number; h: number };
  variableFootprint?: boolean;
  persistent?: boolean;
  diamondReward?: number;
}

export const VIKING_CROPS: VikingCrop[] = [
  { id: "fjord_berry", name: "Fjord Berry", emoji: "🫐", tier: "common", growSeconds: 45, sellPrice: 30000, footprint: { w: 1, h: 1 } },
  { id: "odins_pear", name: "Odin's Pear", emoji: "🍐", tier: "uncommon", growSeconds: 60, sellPrice: 70000, footprint: { w: 1, h: 1 } },
  { id: "rune_apple", name: "Rune-Carved Apple", emoji: "🍏", tier: "rare", growSeconds: 80, sellPrice: 150000, footprint: { w: 1, h: 1 }, persistent: true },
  { id: "berserker_banana", name: "Berserker Banana", emoji: "🍌", tier: "epic", growSeconds: 110, sellPrice: 380000, footprint: { w: 2, h: 1 }, variableFootprint: true, persistent: true },
  { id: "drakkar_coconut", name: "Drakkar Coconut", emoji: "🥥", tier: "mythic", growSeconds: 150, sellPrice: 6000, footprint: { w: 2, h: 1 }, variableFootprint: true, persistent: true, diamondReward: 3 },
  { id: "yggdrasil_apple", name: "Yggdrasil Apple", emoji: "🍎", tier: "historic", growSeconds: 220, sellPrice: 20000, footprint: { w: 2, h: 2 }, persistent: true, diamondReward: 5 },
];

export const VIKING_CROPS_BY_ID: Record<string, VikingCrop> = Object.fromEntries(VIKING_CROPS.map((c) => [c.id, c]));

export const VIKING_TIER_ORDER: VikingTier[] = ["common", "uncommon", "rare", "epic", "mythic", "historic"];

/**
 * Viking crops sit at the TOP of the same 9-rung rarity ladder the regular Seed Shop uses
 * (CROP_TIER_LABELS/CROP_TIER_COLORS in gameData.ts) — Historic here lands on the same "Historic"
 * rung the Kitsune occupies, since a Yggdrasil Apple is just as unattainable through normal means.
 */
export const VIKING_TIER_TO_CROP_TIER: Record<VikingTier, number> = {
  common: 2,
  uncommon: 3,
  rare: 4,
  epic: 5,
  mythic: 6,
  historic: 8,
};

/** Mirrors the server's weighting, for display odds only — the real roll happens server-side. Every research job guarantees a seed. */
export const VIKING_PACK_ODDS: { pct: number; tier: VikingTier }[] = [
  { pct: 46.2, tier: "common" },
  { pct: 27.7, tier: "uncommon" },
  { pct: 15.4, tier: "rare" },
  { pct: 7.7, tier: "epic" },
  { pct: 2.3, tier: "mythic" },
  { pct: 0.8, tier: "historic" },
];

export const YGGDRASIL_BUILD_MS = 24 * 60 * 60 * 1000;
export const YGGDRASIL_RESEARCH_MS = 60 * 60 * 1000;
export const YGGDRASIL_MAX_SLOTS = 10;

/** Mirrors server/src/towns.ts's yggdrasilSlotUpgradeCost — cost (Diamonds) to go from
 *  `currentSlots` to `currentSlots + 1`: 1000, 5000, 25000, ... (x5 per step). Used here only to
 *  preview the price; the server is authoritative for the real charge. */
export function yggdrasilSlotUpgradeCost(currentSlots: number): number | undefined {
  if (currentSlots >= YGGDRASIL_MAX_SLOTS) return undefined;
  return 1000 * Math.pow(5, currentSlots - 1);
}
