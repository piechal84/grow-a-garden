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
  { id: "pumpkin", name: "Pumpkin", emoji: "🎃", tier: 6, seedCost: 1000, growSeconds: 120, sellPrice: 1800, unlockAt: 1000, footprint: { w: 2, h: 2 }, persistent: true },
  { id: "dragonfruit", name: "Dragon Fruit", emoji: "🐉", tier: 7, seedCost: 2500, growSeconds: 180, sellPrice: 4800, unlockAt: 2500, footprint: { w: 2, h: 2 }, persistent: true },
];

export const CROPS_BY_ID: Record<string, Crop> = Object.fromEntries(CROPS.map((c) => [c.id, c]));

export type GearEffect =
  | { type: "growSpeed"; value: number }
  | { type: "sellBonus"; value: number }
  | { type: "expandGarden"; value: number }
  | { type: "unlockReclaim" };

export interface GearItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  cost: number;
  repeatable: boolean;
  maxOwned?: number;
  effect: GearEffect;
}

export const GEAR: GearItem[] = [
  {
    id: "watering_can",
    name: "Watering Can",
    emoji: "💧",
    description: "Cuts every crop's grow time by 15%.",
    cost: 200,
    repeatable: false,
    effect: { type: "growSpeed", value: 0.15 },
  },
  {
    id: "fertilizer",
    name: "Fertilizer Bag",
    emoji: "🧪",
    description: "Boosts every sale price by 20%.",
    cost: 400,
    repeatable: false,
    effect: { type: "sellBonus", value: 0.2 },
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
];

export const GEAR_BY_ID: Record<string, GearItem> = Object.fromEntries(GEAR.map((g) => [g.id, g]));

export const MAX_PLAYERS_PER_ROOM = 6;

export function nextGearCost(gear: GearItem, owned: number): number {
  return Math.round(gear.cost * (1 + owned * 0.5));
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
];
