import { GEAR_BY_ID } from "./gameData";
import type { PlayerState } from "./types";

/** Each level's value replaces the previous one (it's an upgrade, not a stacking bonus) — so this
 *  reads the value for the player's current level rather than summing across levels owned. */
function currentLevelValue(levels: number[], owned: number): number {
  if (owned <= 0) return 0;
  return levels[Math.min(owned, levels.length) - 1];
}

export function growSpeedMultiplier(player: PlayerState): number {
  let reduction = 0;
  for (const [gearId, owned] of Object.entries(player.gearOwned)) {
    const gear = GEAR_BY_ID[gearId];
    if (gear && gear.effect.type === "growSpeed") reduction += currentLevelValue(gear.effect.levels, owned);
  }
  return Math.max(0.25, 1 - reduction);
}

export function sellMultiplier(player: PlayerState): number {
  let bonus = 0;
  for (const [gearId, owned] of Object.entries(player.gearOwned)) {
    const gear = GEAR_BY_ID[gearId];
    if (gear && gear.effect.type === "sellBonus") bonus += currentLevelValue(gear.effect.levels, owned);
  }
  return 1 + bonus;
}

export function isUnlocked(player: PlayerState, unlockAt: number): boolean {
  return player.coins >= unlockAt || player.lifetimeCoins >= unlockAt;
}

export function canPlaceAt(player: PlayerState, x: number, y: number, w: number, h: number): boolean {
  if (x < 0 || y < 0 || x + w > player.gridWidth || y + h > player.gridHeight) return false;
  for (const p of player.plantings) {
    if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) return false;
  }
  return true;
}
