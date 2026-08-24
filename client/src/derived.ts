import { GEAR_BY_ID, GROW_SPEED_FLOOR } from "./gameData";
import { parseSlotKey, PET_SIZE_MULTIPLIER, PETS_BY_ID } from "./petData";
import type { PlayerState } from "./types";

/** Each level's value replaces the previous one (it's an upgrade, not a stacking bonus) — so this
 *  reads the value for the player's current level rather than summing across levels owned. */
function currentLevelValue(levels: number[], owned: number): number {
  if (owned <= 0) return 0;
  return levels[Math.min(owned, levels.length) - 1];
}

/** Only manually-equipped pets (equip_pet/unequip_pet) actively contribute. */
function activePets(player: PlayerState) {
  return player.petsEquipped.map((key) => {
    const { petId, size } = parseSlotKey(key);
    return { pet: PETS_BY_ID[petId], size };
  });
}

export interface GrowSpeedInfo {
  /** Fraction of normal grow time a crop now takes (e.g. 0.25 = 25% of normal = 4x faster). */
  multiplier: number;
  /** How many times faster than normal, i.e. 1 / multiplier. */
  speedFactor: number;
  /** True once stacked gear + pets have pushed past GROW_SPEED_FLOOR — any further grow-speed
   *  source would be completely wasted. */
  capped: boolean;
}

/** Same reduction math `growSpeedMultiplier` uses, but returns the pieces the Pet/Gear shops
 *  need to show "growth speed Nx faster" and flag when the floor's been hit. */
export function growSpeedInfo(player: PlayerState): GrowSpeedInfo {
  let reduction = 0;
  for (const [gearId, owned] of Object.entries(player.gearOwned)) {
    const gear = GEAR_BY_ID[gearId];
    if (gear && gear.effect.type === "growSpeed") reduction += currentLevelValue(gear.effect.levels, owned);
  }
  for (const { pet, size } of activePets(player)) {
    if (pet && pet.effect.type === "growSpeed") reduction += pet.effect.value * PET_SIZE_MULTIPLIER[size];
  }
  const uncapped = 1 - reduction;
  const multiplier = Math.max(GROW_SPEED_FLOOR, uncapped);
  return { multiplier, speedFactor: 1 / multiplier, capped: uncapped < GROW_SPEED_FLOOR };
}

export function growSpeedMultiplier(player: PlayerState): number {
  return growSpeedInfo(player).multiplier;
}

export function sellMultiplier(player: PlayerState): number {
  let bonus = 0;
  for (const [gearId, owned] of Object.entries(player.gearOwned)) {
    const gear = GEAR_BY_ID[gearId];
    if (gear && gear.effect.type === "sellBonus") bonus += currentLevelValue(gear.effect.levels, owned);
  }
  for (const { pet, size } of activePets(player)) {
    if (pet && pet.effect.type === "sellBonus") bonus += pet.effect.value * PET_SIZE_MULTIPLIER[size];
  }
  return 1 + bonus;
}

export function isUnlocked(player: PlayerState, unlockAt: number): boolean {
  return player.coins >= unlockAt || player.lifetimeCoins >= unlockAt;
}

const INCUBATOR_SIZE = 3;

export function canPlaceAt(player: PlayerState, x: number, y: number, w: number, h: number): boolean {
  if (x < 0 || y < 0 || x + w > player.gridWidth || y + h > player.gridHeight) return false;
  for (const p of player.plantings) {
    if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) return false;
  }
  for (const inc of player.incubators) {
    if (x < inc.x + INCUBATOR_SIZE && x + w > inc.x && y < inc.y + INCUBATOR_SIZE && y + h > inc.y) return false;
  }
  return true;
}
