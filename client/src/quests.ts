/** Mirrors server/src/quests.ts — the client only needs the shared shape + reroll cost formula. */

export type QuestType = "harvest" | "sell" | "plant" | "earn_coins";

export interface Quest {
  id: string;
  type: QuestType;
  target: number;
  progress: number;
  label: string;
  coinReward: number;
  moonPacks: number;
  completed: boolean;
}

export const DAILY_REROLL_BASE_COST = 30;
export const DAILY_REROLL_STEP = 20;
export const WEEKLY_REROLL_BASE_COST = 100;
export const WEEKLY_REROLL_STEP = 75;

/** Replaces all 3 daily quests at once — separate from the single-quest reroll above, capped at
 *  this array's length uses per real-world day. Index 0 = cost of the 1st refresh used today. */
export const DAILY_FULL_REFRESH_COSTS: { coins: number; diamonds: number }[] = [
  { coins: 50_000, diamonds: 0 },
  { coins: 200_000, diamonds: 0 },
  { coins: 0, diamonds: 1 },
];

export function rerollCost(base: number, step: number, usedCount: number): number {
  return base + step * usedCount;
}

const QUEST_TYPE_EMOJI: Record<QuestType, string> = {
  harvest: "🌾",
  sell: "🧺",
  plant: "🌱",
  earn_coins: "🪙",
};

export function questEmoji(type: QuestType): string {
  return QUEST_TYPE_EMOJI[type];
}
