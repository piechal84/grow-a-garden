/** Pets are permanent collectibles from the Pet Shop — each owned pet passively contributes its
 *  own small growSpeed/sellBonus, stacking with every other pet and gear item owned. Reuses the
 *  same 8-rung tier scale as CROP_TIER_LABELS/COLORS (gameData.ts) so Divine/Celestial pets read
 *  as consistently "the expensive ones" and are priced in Diamonds, same as Solar crops.
 */
export type PetEffect = { type: "growSpeed"; value: number } | { type: "sellBonus"; value: number };

export interface Pet {
  id: string;
  name: string;
  emoji: string;
  /** Index into CROP_TIER_LABELS/CROP_TIER_COLORS (0 = Common ... 7 = Celestial). */
  tier: number;
  cost: { coins: number; diamonds: number };
  effect: PetEffect;
}

export const PETS: Pet[] = [
  { id: "chick", name: "Chick", emoji: "🐥", tier: 0, cost: { coins: 250, diamonds: 0 }, effect: { type: "sellBonus", value: 0.03 } },
  { id: "bunny", name: "Bunny", emoji: "🐰", tier: 1, cost: { coins: 600, diamonds: 0 }, effect: { type: "growSpeed", value: 0.03 } },
  { id: "fox", name: "Fox", emoji: "🦊", tier: 2, cost: { coins: 1500, diamonds: 0 }, effect: { type: "sellBonus", value: 0.06 } },
  { id: "owl", name: "Owl", emoji: "🦉", tier: 3, cost: { coins: 4000, diamonds: 0 }, effect: { type: "growSpeed", value: 0.06 } },
  { id: "panda", name: "Panda", emoji: "🐼", tier: 4, cost: { coins: 10000, diamonds: 0 }, effect: { type: "sellBonus", value: 0.1 } },
  { id: "phoenix_chick", name: "Phoenix Chick", emoji: "🐣", tier: 5, cost: { coins: 25000, diamonds: 0 }, effect: { type: "growSpeed", value: 0.1 } },
  { id: "unicorn", name: "Unicorn", emoji: "🦄", tier: 6, cost: { coins: 0, diamonds: 2 }, effect: { type: "sellBonus", value: 0.18 } },
  { id: "baby_dragon", name: "Baby Dragon", emoji: "🐲", tier: 7, cost: { coins: 0, diamonds: 3 }, effect: { type: "growSpeed", value: 0.18 } },
];

export const PETS_BY_ID: Record<string, Pet> = Object.fromEntries(PETS.map((p) => [p.id, p]));
