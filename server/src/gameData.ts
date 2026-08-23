export interface Crop {
  id: string;
  name: string;
  emoji: string;
  tier: number;
  seedCost: number;
  growSeconds: number;
  sellPrice: number;
  /** Coins-on-hand threshold that permanently unlocks this crop in the shop. */
  unlockAt: number;
  /** Footprint in grid studs (width x height) this crop occupies while planted. */
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
  | { type: "unlockReclaim" }
  | { type: "unlockMove" };

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
  {
    id: "trowel",
    name: "Trowel",
    emoji: "🛠️",
    description: "Relocate any planted crop to a new spot on your plot without losing its growth or mutations.",
    cost: 450,
    repeatable: false,
    effect: { type: "unlockMove" },
  },
];

export const GEAR_BY_ID: Record<string, GearItem> = Object.fromEntries(GEAR.map((g) => [g.id, g]));

export const MAX_PLAYERS_PER_ROOM = 6;
export const STARTING_COINS = 25;

/**
 * Each planted seed secretly rolls one of these tiers, then visibly grows toward
 * its visualScale as the plot's grow timer progresses. Weighted so most crops land
 * near Normal, with rare huge outliers.
 */
export interface SizeTier {
  label: string;
  priceMultiplier: number;
  visualScale: number;
  weight: number;
}

export const SIZE_TIERS: SizeTier[] = [
  { label: "Tiny", priceMultiplier: 0.4, visualScale: 0.55, weight: 300 },
  { label: "Small", priceMultiplier: 0.7, visualScale: 0.75, weight: 1400 },
  { label: "Normal", priceMultiplier: 1.0, visualScale: 1.0, weight: 5000 },
  { label: "Large", priceMultiplier: 1.6, visualScale: 1.3, weight: 2200 },
  { label: "Huge", priceMultiplier: 2.8, visualScale: 1.65, weight: 700 },
  { label: "Giant", priceMultiplier: 5.0, visualScale: 2.05, weight: 150 },
  { label: "Massive", priceMultiplier: 10.0, visualScale: 2.5, weight: 20 },
];

export function rollSizeTier(): SizeTier {
  const total = SIZE_TIERS.reduce((sum, t) => sum + t.weight, 0);
  let r = Math.random() * total;
  for (const tier of SIZE_TIERS) {
    if (r < tier.weight) return tier;
    r -= tier.weight;
  }
  return SIZE_TIERS[SIZE_TIERS.length - 1];
}
