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
