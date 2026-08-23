/**
 * Daily quests reset every real 24h, weekly quests every real 7 days — both computed as
 * simple wall-clock "buckets" so a stale player's quest set is regenerated the moment they
 * next act, without needing a background timer.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function dayBucket(now: number): number {
  return Math.floor(now / DAY_MS);
}

export function weekBucket(now: number): number {
  return Math.floor(now / WEEK_MS);
}

export type QuestType = "harvest" | "sell" | "plant" | "earn_coins";

export interface QuestTemplate {
  type: QuestType;
  target: number;
  label: string;
  coinReward: number;
  moonPacks?: number;
}

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

export const DAILY_QUEST_POOL: QuestTemplate[] = [
  { type: "harvest", target: 10, label: "Harvest 10 crops", coinReward: 100 },
  { type: "harvest", target: 25, label: "Harvest 25 crops", coinReward: 220 },
  { type: "sell", target: 15, label: "Sell 15 crops", coinReward: 150 },
  { type: "plant", target: 10, label: "Plant 10 seeds", coinReward: 90 },
  { type: "plant", target: 20, label: "Plant 20 seeds", coinReward: 170 },
  { type: "earn_coins", target: 500, label: "Earn 500 coins selling", coinReward: 180 },
];

export const WEEKLY_QUEST_POOL: QuestTemplate[] = [
  { type: "harvest", target: 100, label: "Harvest 100 crops", coinReward: 800, moonPacks: 1 },
  { type: "sell", target: 150, label: "Sell 150 crops", coinReward: 1000, moonPacks: 1 },
  { type: "plant", target: 80, label: "Plant 80 seeds", coinReward: 700, moonPacks: 1 },
  { type: "earn_coins", target: 5000, label: "Earn 5000 coins selling", coinReward: 1200, moonPacks: 2 },
];

const DAILY_COUNT = 3;
const WEEKLY_COUNT = 2;

export const DAILY_REROLL_BASE_COST = 30;
export const DAILY_REROLL_STEP = 20;
export const WEEKLY_REROLL_BASE_COST = 100;
export const WEEKLY_REROLL_STEP = 75;

let questIdCounter = 0;
function nextQuestId(): string {
  questIdCounter += 1;
  return `q${Date.now().toString(36)}${questIdCounter}`;
}

export function templateToQuest(template: QuestTemplate): Quest {
  return {
    id: nextQuestId(),
    type: template.type,
    target: template.target,
    progress: 0,
    label: template.label,
    coinReward: template.coinReward,
    moonPacks: template.moonPacks ?? 0,
    completed: false,
  };
}

function pickRandomDistinct(pool: QuestTemplate[], count: number): QuestTemplate[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function rollDailyQuests(): Quest[] {
  return pickRandomDistinct(DAILY_QUEST_POOL, DAILY_COUNT).map(templateToQuest);
}

export function rollWeeklyQuests(): Quest[] {
  return pickRandomDistinct(WEEKLY_QUEST_POOL, WEEKLY_COUNT).map(templateToQuest);
}

export function rerollCost(base: number, step: number, usedCount: number): number {
  return base + step * usedCount;
}
