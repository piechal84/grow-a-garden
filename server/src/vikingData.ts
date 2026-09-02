/** Mirrors moonData.ts's structure, but sourced from the Yggdrasil's research queue instead of a
 *  paid pack pull — see startVikingResearch/collectVikingResearch in rooms.ts. Historic replaces
 *  Legendary as the top rung, since this is the one place that tier can be grown rather than
 *  crafted (see gameData.ts's Kitsune Shrine for the other). */
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
  /** Mythic and Historic Viking crops pay out in Diamonds instead of coins when sold — same
   *  convention as Solar's Mythic/Legendary (see solarData.ts). */
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

interface PackWeight {
  kind: VikingTier;
  weight: number;
}

/** Same odds shape as the Moon/Solar packs (see moonData.ts) — every research job guarantees a seed. */
export const VIKING_PACK_WEIGHTS: PackWeight[] = [
  { kind: "common", weight: 3000 },
  { kind: "uncommon", weight: 1800 },
  { kind: "rare", weight: 1000 },
  { kind: "epic", weight: 500 },
  { kind: "mythic", weight: 150 },
  { kind: "historic", weight: 50 },
];

export interface VikingPackResult {
  kind: VikingTier;
  cropId: string;
}

export function rollVikingPack(): VikingPackResult {
  const total = VIKING_PACK_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
  let r = Math.random() * total;
  for (const w of VIKING_PACK_WEIGHTS) {
    if (r < w.weight) {
      const crop = VIKING_CROPS.find((c) => c.tier === w.kind)!;
      return { kind: w.kind, cropId: crop.id };
    }
    r -= w.weight;
  }
  const fallback = VIKING_CROPS[0];
  return { kind: fallback.tier, cropId: fallback.id };
}

export function resolveVikingFootprint(cropId: string, fallback: { w: number; h: number }): { w: number; h: number } {
  const viking = VIKING_CROPS_BY_ID[cropId];
  if (viking?.variableFootprint) {
    return Math.random() < 0.5 ? { w: 2, h: 1 } : { w: 1, h: 2 };
  }
  return fallback;
}
