/** Pets are hatched from Eggs bought at the Pet Shop (not purchased directly) — duplicates stack
 *  (it's fine to own several of the same pet+size), and the Kelka Egg Incubator (a Gear Shop
 *  unlock) lets you merge 4 identical copies (same pet, same size) into the next evolution stage
 *  for a much bigger passive bonus. Reuses the same 8-rung tier scale as CROP_TIER_LABELS/COLORS
 *  (gameData.ts) so Divine/Celestial pets read as consistently "the rare ones", same language as
 *  Solar crops.
 */
export type PetEffect =
  | { type: "growSpeed"; value: number }
  | { type: "sellBonus"; value: number }
  | { type: "incubatorSpeed"; value: number };

export interface Pet {
  id: string;
  name: string;
  emoji: string;
  /** Index into CROP_TIER_LABELS/CROP_TIER_COLORS (0 = Common ... 7 = Celestial). Evolved forms
   *  are bumped for display but capped at 7 (Celestial). */
  tier: number;
  effect: PetEffect;
}

interface BasePet {
  id: string;
  name: string;
  emoji: string;
  tier: number;
  effect: PetEffect;
}

const BASE_PETS: BasePet[] = [
  { id: "chick", name: "Chick", emoji: "🐥", tier: 0, effect: { type: "sellBonus", value: 0.03 } },
  { id: "bunny", name: "Bunny", emoji: "🐰", tier: 1, effect: { type: "incubatorSpeed", value: 0.03 } },
  { id: "fox", name: "Fox", emoji: "🦊", tier: 2, effect: { type: "sellBonus", value: 0.06 } },
  { id: "owl", name: "Owl", emoji: "🦉", tier: 3, effect: { type: "incubatorSpeed", value: 0.06 } },
  { id: "panda", name: "Panda", emoji: "🐼", tier: 4, effect: { type: "sellBonus", value: 0.1 } },
  { id: "phoenix_chick", name: "Phoenix Chick", emoji: "🐣", tier: 5, effect: { type: "growSpeed", value: 0.1 } },
  { id: "unicorn", name: "Unicorn", emoji: "🦄", tier: 6, effect: { type: "sellBonus", value: 0.18 } },
  { id: "baby_dragon", name: "Baby Dragon", emoji: "🐲", tier: 7, effect: { type: "growSpeed", value: 0.18 } },
];

/** Stage 0 = base (hatched from an egg), 1 = Empowered (4 base merged), 2 = Tenacious
 *  (4 Empowered merged). Merging always needs MERGE_COUNT identical (pet, size) copies. */
export const MAX_EVOLUTION_STAGE = 2;
export const MERGE_COUNT = 4;
const EVOLUTION_STAGE_NAMES = ["", "Empowered", "Tenacious"];
const EVOLUTION_STAGE_ICONS = ["", "✨", "🔥"];
const EVOLUTION_MULTIPLIER = [1, 2.5, 5];
const EVOLUTION_SUFFIX = ["", "_empowered", "_tenacious"];

function evolve(base: BasePet, stage: number): Pet {
  if (stage === 0) return { id: base.id, name: base.name, emoji: base.emoji, tier: base.tier, effect: base.effect };
  return {
    id: `${base.id}${EVOLUTION_SUFFIX[stage]}`,
    name: `${EVOLUTION_STAGE_NAMES[stage]} ${base.name}`,
    emoji: `${EVOLUTION_STAGE_ICONS[stage]}${base.emoji}`,
    tier: Math.min(7, base.tier + stage),
    effect: { type: base.effect.type, value: base.effect.value * EVOLUTION_MULTIPLIER[stage] } as PetEffect,
  };
}

/** Every base pet plus its Empowered and Tenacious forms — a full lookup table, so any pet ID
 *  (hatched or merged) resolves the same way everywhere. */
export const PETS: Pet[] = BASE_PETS.flatMap((base) =>
  Array.from({ length: MAX_EVOLUTION_STAGE + 1 }, (_, stage) => evolve(base, stage)),
);
export const PETS_BY_ID: Record<string, Pet> = Object.fromEntries(PETS.map((p) => [p.id, p]));

/** Which evolution stage a pet ID represents, and the base species it belongs to. */
export function evolutionInfo(petId: string): { baseId: string; stage: number } {
  for (let stage = MAX_EVOLUTION_STAGE; stage >= 1; stage--) {
    if (petId.endsWith(EVOLUTION_SUFFIX[stage])) {
      return { baseId: petId.slice(0, -EVOLUTION_SUFFIX[stage].length), stage };
    }
  }
  return { baseId: petId, stage: 0 };
}

/** The pet ID one merge tier up, or undefined if already at max evolution. */
export function nextEvolutionId(petId: string): string | undefined {
  const { baseId, stage } = evolutionInfo(petId);
  if (stage >= MAX_EVOLUTION_STAGE) return undefined;
  return `${baseId}${EVOLUTION_SUFFIX[stage + 1]}`;
}

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
 *  top of the ladder, unlike the flatter Common/Legendary curves. Eggs only ever hatch base
 *  (stage 0) pets — evolved forms only come from merging. */
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
  const pet = BASE_PETS.find((p) => p.tier === tierPick.tier) ?? BASE_PETS[0];
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

/** Slot entries encode both the pet and the exact size equipped, since a player can own the same
 *  pet at more than one size and only one copy occupies a slot at a time. */
export function slotKey(petId: string, size: PetSize): string {
  return `${petId}#${size}`;
}

export function parseSlotKey(key: string): { petId: string; size: PetSize } {
  const i = key.lastIndexOf("#");
  return { petId: key.slice(0, i), size: key.slice(i + 1) as PetSize };
}

/** Picks a sensible default equip set (best pets by tier, one size each) — used only to seed
 *  `petsEquipped` for saves from before manual equipping and stacking existed. */
export function defaultEquippedSlots(petsOwned: Record<string, Partial<Record<PetSize, number>>>, petSlots: number): string[] {
  const owned: { pet: Pet; size: PetSize }[] = [];
  for (const [petId, sizes] of Object.entries(petsOwned)) {
    const pet = PETS_BY_ID[petId];
    if (!pet) continue;
    for (const size of PET_SIZES) {
      if ((sizes[size] ?? 0) > 0) owned.push({ pet, size });
    }
  }
  return owned
    .sort((a, b) => b.pet.tier - a.pet.tier || PET_SIZE_MULTIPLIER[b.size] - PET_SIZE_MULTIPLIER[a.size])
    .slice(0, petSlots)
    .map(({ pet, size }) => slotKey(pet.id, size));
}

/** The actual bonus a pet grants once size is factored in (evolution is already baked into
 *  pet.effect.value — see `evolve` above). */
export function petEffectValue(pet: Pet, size: PetSize): number {
  return pet.effect.value * PET_SIZE_MULTIPLIER[size];
}

export const PET_EFFECT_LABELS: Record<PetEffect["type"], string> = {
  growSpeed: "Grow Speed",
  sellBonus: "Sell Price",
  incubatorSpeed: "Incubator Speed",
};

/** Human-readable "+N% Grow Speed" / "+N% Sell Price" / "+N% Incubator Speed" label for a pet at
 *  a given size, shown anywhere a pet is listed so its power is never a mystery. */
export function formatPetEffect(pet: Pet, size: PetSize): string {
  const pct = Math.round(petEffectValue(pet, size) * 1000) / 10;
  const label = PET_EFFECT_LABELS[pet.effect.type];
  return `+${pct}% ${label}`;
}

/** The Unicorn line has a hidden second ability beyond its stat line: while equipped, rain gets
 *  an extra independent shot at rolling the Rainbow mutation on freshly planted crops (see
 *  rollMutations in weather.ts, server-authoritative). Called out explicitly here since nothing
 *  else in the UI would otherwise reveal it. */
export function petSpecialAbility(petId: string): string | undefined {
  const { baseId } = evolutionInfo(petId);
  if (baseId === "unicorn") {
    return "While equipped: rain has an 18% chance per planting to grant a Rainbow mutation (2.8x sell price).";
  }
  return undefined;
}

export interface EquippedPetInfo {
  petId: string;
  size: PetSize;
  pet: Pet;
}

/** Resolves a player's petsEquipped slot keys into full pet info, sorted best (highest tier)
 *  first — used for the avatar companion badge and for pets wandering the garden. */
export function equippedPetsInfo(petsEquipped: string[]): EquippedPetInfo[] {
  return petsEquipped
    .map((key) => {
      const { petId, size } = parseSlotKey(key);
      const pet = PETS_BY_ID[petId];
      return pet ? { petId, size, pet } : undefined;
    })
    .filter((p): p is EquippedPetInfo => !!p)
    .sort((a, b) => b.pet.tier - a.pet.tier);
}
