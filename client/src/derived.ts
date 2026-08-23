import { GEAR_BY_ID } from "./gameData";
import type { PlayerState } from "./types";

export function growSpeedMultiplier(player: PlayerState): number {
  let reduction = 0;
  for (const [gearId, owned] of Object.entries(player.gearOwned)) {
    const gear = GEAR_BY_ID[gearId];
    if (gear && gear.effect.type === "growSpeed" && owned > 0) reduction += gear.effect.value;
  }
  return Math.max(0.25, 1 - reduction);
}

export function sellMultiplier(player: PlayerState): number {
  let bonus = 0;
  for (const [gearId, owned] of Object.entries(player.gearOwned)) {
    const gear = GEAR_BY_ID[gearId];
    if (gear && gear.effect.type === "sellBonus" && owned > 0) bonus += gear.effect.value;
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
