/** Pets are hatched from Eggs bought at the Pet Shop (not purchased directly) — each owned pet
 *  passively contributes its own small growSpeed/sellBonus, scaled by the size it hatched at.
 *  Reuses the same 8-rung tier scale as CROP_TIER_LABELS/COLORS (gameData.ts) so Divine/Celestial
 *  pets read as consistently "the rare ones", same language as Solar crops.
 */
export type PetEffect = { type: "growSpeed"; value: number } | { type: "sellBonus"; value: number };

export interface Pet {
  id: string;
  name: string;
  emoji: string;
  /** Index into CROP_TIER_LABELS/CROP_TIER_COLORS (0 = Common ... 7 = Celestial). */
  tier: number;
  effect: PetEffect;
}

export const PETS: Pet[] = [
  { id: "chick", name: "Chick", emoji: "🐥", tier: 0, effect: { type: "sellBonus", value: 0.03 } },
  { id: "bunny", name: "Bunny", emoji: "🐰", tier: 1, effect: { type: "growSpeed", value: 0.03 } },
  { id: "fox", name: "Fox", emoji: "🦊", tier: 2, effect: { type: "sellBonus", value: 0.06 } },
  { id: "owl", name: "Owl", emoji: "🦉", tier: 3, effect: { type: "growSpeed", value: 0.06 } },
  { id: "panda", name: "Panda", emoji: "🐼", tier: 4, effect: { type: "sellBonus", value: 0.1 } },
  { id: "phoenix_chick", name: "Phoenix Chick", emoji: "🐣", tier: 5, effect: { type: "growSpeed", value: 0.1 } },
  { id: "unicorn", name: "Unicorn", emoji: "🦄", tier: 6, effect: { type: "sellBonus", value: 0.18 } },
  { id: "baby_dragon", name: "Baby Dragon", emoji: "🐲", tier: 7, effect: { type: "growSpeed", value: 0.18 } },
];

export const PETS_BY_ID: Record<string, Pet> = Object.fromEntries(PETS.map((p) => [p.id, p]));

/** Every hatch also rolls a size independent of which pet it is — a bigger hatch is strictly
 *  better, so re-rolling a pet you already own is never wasted (see buyPetEgg's upgrade check). */
export type PetSize = "normal" | "big" | "giant";
export const PET_SIZES: PetSize[] = ["normal", "big", "giant"];
export const PET_SIZE_LABELS: Record<PetSize, string> = { normal: "Normal", big: "Big", giant: "Giant" };
export const PET_SIZE_MULTIPLIER: Record<PetSize, number> = { normal: 1, big: 1.5, giant: 2.5 };

interface Weighted {
  weight: number;
}

function pickWeighted<T extends Weighted>(items: T[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    if (r < item.weight) return item;
    r -= item.weight;
  }
  return items[items.length - 1];
}

const PET_SIZE_WEIGHTS: { size: PetSize; weight: number }[] = [
  { size: "normal", weight: 70 },
  { size: "big", weight: 25 },
  { size: "giant", weight: 5 },
];

interface TierOdds {
  tier: number;
  weight: number;
}

export interface PetEgg {
  id: string;
  name: string;
  emoji: string;
  cost: { coins: number; diamonds: number };
  odds: TierOdds[];
}

/** Odds shift toward the higher tiers as the egg gets pricier — Divine skews heavily toward the
 *  top of the ladder, unlike the flatter Common/Legendary curves. */
export const PET_EGGS: PetEgg[] = [
  {
    id: "common_egg",
    name: "Common Egg",
    emoji: "🥚",
    cost: { coins: 20000, diamonds: 0 },
    odds: [
      { tier: 0, weight: 35 },
      { tier: 1, weight: 28 },
      { tier: 2, weight: 18 },
      { tier: 3, weight: 10 },
      { tier: 4, weight: 5 },
      { tier: 5, weight: 2.5 },
      { tier: 6, weight: 1 },
      { tier: 7, weight: 0.5 },
    ],
  },
  {
    id: "legendary_egg",
    name: "Legendary Egg",
    emoji: "🪺",
    cost: { coins: 200000, diamonds: 0 },
    odds: [
      { tier: 0, weight: 10 },
      { tier: 1, weight: 15 },
      { tier: 2, weight: 20 },
      { tier: 3, weight: 22 },
      { tier: 4, weight: 18 },
      { tier: 5, weight: 9 },
      { tier: 6, weight: 4 },
      { tier: 7, weight: 2 },
    ],
  },
  {
    id: "divine_egg",
    name: "Divine Egg",
    emoji: "🔮",
    cost: { coins: 0, diamonds: 1 },
    odds: [
      { tier: 0, weight: 2 },
      { tier: 1, weight: 4 },
      { tier: 2, weight: 8 },
      { tier: 3, weight: 12 },
      { tier: 4, weight: 20 },
      { tier: 5, weight: 24 },
      { tier: 6, weight: 18 },
      { tier: 7, weight: 12 },
    ],
  },
];

export const PET_EGGS_BY_ID: Record<string, PetEgg> = Object.fromEntries(PET_EGGS.map((e) => [e.id, e]));

export interface PetHatchResult {
  petId: string;
  size: PetSize;
}

export function rollPetEgg(eggId: string): PetHatchResult | undefined {
  const egg = PET_EGGS_BY_ID[eggId];
  if (!egg) return undefined;
  const tierPick = pickWeighted(egg.odds);
  const pet = PETS.find((p) => p.tier === tierPick.tier) ?? PETS[0];
  const size = pickWeighted(PET_SIZE_WEIGHTS).size;
  return { petId: pet.id, size };
}

export const BASE_PET_SLOTS = 3;
export const MAX_PET_SLOTS = 6;

/** 3 -> 4 costs coins; the last two (4 -> 5, 5 -> 6) cost Diamonds. */
export const PET_SLOT_COSTS: { coins: number; diamonds: number }[] = [
  { coins: 8000, diamonds: 0 },
  { coins: 0, diamonds: 2 },
  { coins: 0, diamonds: 4 },
];

export function nextPetSlotCost(petSlots: number): { coins: number; diamonds: number } | undefined {
  return PET_SLOT_COSTS[petSlots - BASE_PET_SLOTS];
}

/** Auto-equips your best (highest-tier) owned pets up to your slot count — no manual equip step. */
export function equippedPetIds(petsOwned: Record<string, PetSize>, petSlots: number): string[] {
  return Object.keys(petsOwned)
    .map((id) => PETS_BY_ID[id])
    .filter((p): p is Pet => !!p)
    .sort((a, b) => b.tier - a.tier)
    .slice(0, petSlots)
    .map((p) => p.id);
}
