export interface Crop {
  id: string;
  name: string;
  emoji: string;
  tier: number;
  seedCost: number;
  growSeconds: number;
  sellPrice: number;
  unlockAt: number;
  footprint: { w: number; h: number };
  /** Persistent crops regrow in place after harvest instead of being consumed — a one-time seed cost. */
  persistent?: boolean;
}

export const CROPS: Crop[] = [
  { id: "cucumber", name: "Cucumber", emoji: "🥒", tier: 0, seedCost: 10, growSeconds: 15, sellPrice: 16, unlockAt: 0, footprint: { w: 1, h: 1 } },
  { id: "tomato", name: "Tomato", emoji: "🍅", tier: 1, seedCost: 30, growSeconds: 25, sellPrice: 48, unlockAt: 30, footprint: { w: 1, h: 1 } },
  { id: "carrot", name: "Carrot", emoji: "🥕", tier: 2, seedCost: 60, growSeconds: 35, sellPrice: 100, unlockAt: 60, footprint: { w: 1, h: 1 } },
  { id: "corn", name: "Corn", emoji: "🌽", tier: 3, seedCost: 120, growSeconds: 45, sellPrice: 200, unlockAt: 120, footprint: { w: 2, h: 1 } },
  { id: "strawberry", name: "Strawberry", emoji: "🍓", tier: 4, seedCost: 250, growSeconds: 60, sellPrice: 420, unlockAt: 250, footprint: { w: 1, h: 1 }, persistent: true },
  { id: "watermelon", name: "Watermelon", emoji: "🍉", tier: 5, seedCost: 500, growSeconds: 90, sellPrice: 850, unlockAt: 500, footprint: { w: 2, h: 2 }, persistent: true },
  { id: "grapes", name: "Grapes", emoji: "🍇", tier: 6, seedCost: 1000, growSeconds: 120, sellPrice: 1800, unlockAt: 1000, footprint: { w: 1, h: 1 }, persistent: true },
  { id: "dragonfruit", name: "Dragon Fruit", emoji: "🐉", tier: 7, seedCost: 2500, growSeconds: 180, sellPrice: 4800, unlockAt: 2500, footprint: { w: 2, h: 2 }, persistent: true },
];

export const CROPS_BY_ID: Record<string, Crop> = Object.fromEntries(CROPS.map((c) => [c.id, c]));

export type GearEffect =
  | { type: "growSpeed"; levels: number[] }
  | { type: "sellBonus"; levels: number[] }
  | { type: "expandGarden"; value: number }
  | { type: "unlockReclaim" }
  | { type: "unlockMove" }
  | { type: "unlockMerge" }
  | { type: "unlockKitsuneShrine" }
  | { type: "unlockYggdrasil" };

export interface GearPrice {
  coins: number;
  diamonds: number;
  /** Only the Yggdrasil charges this — otherwise absent/0. */
  kelkaCrystals?: number;
}

export interface GearItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  cost: number;
  repeatable: boolean;
  maxOwned?: number;
  effect: GearEffect;
  /** One emoji per upgrade level (index 0 = level 1) — shown in place of `emoji` once owned,
   *  so the icon visibly upgrades in quality alongside the effect. */
  levelEmojis?: string[];
  /** Explicit price per level (index 0 = cost to buy level 1), overriding the generic
   *  cost-rises-50%-per-unit formula — used for steep, exponential upgrade curves. */
  levelCosts?: GearPrice[];
}

export const GEAR: GearItem[] = [
  {
    id: "watering_can",
    name: "Watering Can",
    emoji: "💧",
    description: "Cuts every crop's grow time — upgrade up to 5 times for a bigger cut.",
    cost: 200,
    repeatable: true,
    maxOwned: 5,
    effect: { type: "growSpeed", levels: [0.15, 0.175, 0.2, 0.225, 0.25] },
    levelEmojis: ["💧", "🚰", "🚿", "⛲", "🌊"],
    levelCosts: [
      { coins: 200, diamonds: 0 },
      { coins: 600, diamonds: 0 },
      { coins: 1800, diamonds: 0 },
      { coins: 5400, diamonds: 0 },
      { coins: 0, diamonds: 1 },
    ],
  },
  {
    id: "fertilizer",
    name: "Fertilizer Bag",
    emoji: "🧪",
    description: "Boosts every sale price — upgrade up to 5 times for a bigger cut.",
    cost: 400,
    repeatable: true,
    maxOwned: 5,
    effect: { type: "sellBonus", levels: [0.02, 0.09, 0.16, 0.23, 0.3] },
    levelEmojis: ["🧪", "🌿", "🍀", "⭐", "💎"],
    levelCosts: [
      { coins: 400, diamonds: 0 },
      { coins: 1200, diamonds: 0 },
      { coins: 3600, diamonds: 0 },
      { coins: 10800, diamonds: 0 },
      { coins: 0, diamonds: 1 },
    ],
  },
  {
    id: "garden_expansion",
    name: "Garden Expansion",
    emoji: "🟫",
    description: "Extends your plot by one more row of studs (price rises each time).",
    cost: 300,
    repeatable: true,
    maxOwned: 8,
    effect: { type: "expandGarden", value: 1 },
  },
  {
    id: "reclaimer",
    name: "Reclaimer",
    emoji: "🧲",
    description: "Dig up any of your planted seeds and get it back in your inventory instead of losing it.",
    cost: 350,
    repeatable: false,
    effect: { type: "unlockReclaim" },
  },
  {
    id: "trowel",
    name: "Trowel",
    emoji: "🛠️",
    description: "Relocate any planted crop to a new spot on your plot without losing its growth or mutations.",
    cost: 450,
    repeatable: false,
    effect: { type: "unlockMove" },
  },
  {
    id: "kelka_incubator",
    name: "Kelka Egg Incubator",
    emoji: "🥚",
    description: "Plant on a 3x3 clearing to merge 4 identical pets (same pet, same size) into a stronger evolved form. Own up to 2.",
    cost: 5000,
    repeatable: true,
    maxOwned: 2,
    effect: { type: "unlockMerge" },
  },
  {
    id: "kelka_kitsune_shrine",
    name: "Kelka Kitsune Shrine",
    emoji: "🐺",
    description:
      "Plant on a 3x3 clearing to craft the Historic-tier Kitsune from a New Fox Egg (Pet Shop) and a Giant Moon/Sun Blossom. Own up to 1.",
    cost: 0,
    repeatable: false,
    levelCosts: [{ coins: 0, diamonds: 5 }],
    effect: { type: "unlockKitsuneShrine" },
  },
  {
    id: "yggdrasil",
    name: "Yggdrasil",
    emoji: "🌳",
    description:
      "Plant the World Tree on a 4x4 clearing to unlock Viking Seed research — takes 24 hours to grow. Own up to 1.",
    cost: 0,
    repeatable: false,
    levelCosts: [{ coins: 0, diamonds: 1000, kelkaCrystals: 5 }],
    effect: { type: "unlockYggdrasil" },
  },
];

export const GEAR_BY_ID: Record<string, GearItem> = Object.fromEntries(GEAR.map((g) => [g.id, g]));

export const MAX_PLAYERS_PER_TOWN = 4;

/** Must match server/src/towns.ts's STOCK_CYCLE_MS — how often seed shop stock rolls over. */
export const SEED_STOCK_CYCLE_MS = 2 * 60 * 1000;

/** Mirrors server/src/gameData.ts — multiplier applied to a persistent crop's regrow time once
 *  it has been harvested at least once. Used here only to preview the real grow time in shops;
 *  the server is authoritative for the actual timer. */
export const PERSISTENT_REGROW_MULTIPLIER = 10;

/** Mirrors server/src/gameData.ts — floor on the grow-speed multiplier from stacked gear + pets
 *  (0.1 = crops can grow at most 10x faster than normal, never more). */
export const GROW_SPEED_FLOOR = 0.1;

/** Mirrors server/src/gameData.ts — floor on the incubator-merge-speed multiplier from equipped
 *  Bunny/Owl (0.1 = merges can finish at most 10x faster than normal, never more). */
export const INCUBATOR_SPEED_FLOOR = 0.1;

export function nextGearPrice(gear: GearItem, owned: number): GearPrice {
  if (gear.levelCosts) return gear.levelCosts[Math.min(owned, gear.levelCosts.length - 1)];
  return { coins: Math.round(gear.cost * (1 + owned * 0.5)), diamonds: 0 };
}

/** Mirrors server SIZE_TIERS ordering, used to sort/color size badges. */
export const SIZE_ORDER = ["Tiny", "Small", "Normal", "Large", "Huge", "Giant", "Massive"];

export const SIZE_COLORS: Record<string, string> = {
  Tiny: "#8b9a8f",
  Small: "#6fae52",
  Normal: "#3fae5a",
  Large: "#2f7dc4",
  Huge: "#9b5de5",
  Giant: "#e0982a",
  Massive: "#e0499a",
};

/**
 * Rarity tier for each of the 8 regular crops (indexed by Crop.tier), using the same
 * naming/color language as the Moon Shop's tiers for the first 6, then extending two
 * more rungs for the normal shop's longer progression.
 */
export const CROP_TIER_LABELS = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Mythic",
  "Legendary",
  "Divine",
  "Celestial",
  /** Historic sits above Celestial — reserved for pets that can't be hatched/rolled at all, only
   *  crafted through a unique one-off path (the Kitsune, via the Kelka Kitsune Shrine). Shown
   *  with a fancy banner instead of the usual small tier badge — see PetTierBadge. */
  "Historic",
];

export const CROP_TIER_COLORS = [
  "#8fa3c7",
  "#5fb87a",
  "#3f8fe0",
  "#a35fe0",
  "#e05fb0",
  "#f2b23a",
  "#ffd54a",
  "#4fd8e0",
  "#c0293a",
];
