import { customAlphabet, nanoid } from "nanoid";
import { CROPS_BY_ID, GEAR_BY_ID, MAX_PLAYERS_PER_ROOM, rollSizeTier, STARTING_COINS } from "./gameData.js";
import { getCropDef, MOON_PACK_COST, resolveFootprint, rollMoonPack, type PackResult } from "./moonData.js";
import type { HarvestedCrop, PlayerState, Planting, RoomState } from "./types.js";
import { findUserById, type SavedProgress } from "./userStore.js";
import { computeReadyAt, MUTATIONS, mutationKey, rollMutations, type MutationId } from "./weather.js";
import {
  BASE_GRID_HEIGHT,
  clampToWorld,
  GRID_EXPANSION_MAX,
  MOVE_SPEED,
  PLOT_GRID_WIDTH,
  spawnPositionForSlot,
  type Position,
} from "./world.js";

const roomCodeGen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);

const rooms = new Map<string, RoomState>();
const roomPositions = new Map<string, Map<string, Position>>();

function nextFreeSlot(room: RoomState): number {
  const used = new Set(room.players.map((p) => p.slotIndex));
  for (let i = 0; i < MAX_PLAYERS_PER_ROOM; i++) {
    if (!used.has(i)) return i;
  }
  return room.players.length;
}

function makePlayer(id: string, name: string, slotIndex: number): PlayerState {
  const account = findUserById(id);
  const saved = account?.progress;
  return {
    id,
    name,
    connected: true,
    coins: saved?.coins ?? STARTING_COINS,
    lifetimeCoins: saved?.lifetimeCoins ?? STARTING_COINS,
    slotIndex,
    gridWidth: saved?.gridWidth ?? PLOT_GRID_WIDTH,
    gridHeight: saved?.gridHeight ?? BASE_GRID_HEIGHT,
    plantings: saved?.plantings ?? [],
    seedInventory: saved?.seedInventory ?? {},
    cropInventory: saved?.cropInventory ?? [],
    gearOwned: saved?.gearOwned ?? {},
    accountUsername: account?.username,
  };
}

export function createRoom(hostId: string, hostName: string): RoomState {
  let code = roomCodeGen();
  while (rooms.has(code)) code = roomCodeGen();
  const room: RoomState = {
    code,
    hostId,
    players: [makePlayer(hostId, hostName, 0)],
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): RoomState | undefined {
  return rooms.get(code.toUpperCase());
}

export function joinRoom(code: string, clientId: string, playerName: string): { room?: RoomState; error?: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: "Room not found." };
  const existing = room.players.find((p) => p.id === clientId);
  if (existing) {
    existing.connected = true;
    return { room };
  }
  if (room.players.length >= MAX_PLAYERS_PER_ROOM) return { error: "Room is full (max 6 players)." };
  if (room.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
    return { error: "That name is already taken in this room." };
  }
  room.players.push(makePlayer(clientId, playerName, nextFreeSlot(room)));
  return { room };
}

export function markDisconnected(playerId: string): RoomState | undefined {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.connected = false;
      return room;
    }
  }
  return undefined;
}

export function findRoomByPlayer(playerId: string): RoomState | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.id === playerId)) return room;
  }
  return undefined;
}

/** Returns this player's current position, spawning them at their plot if they have none yet. */
export function ensurePosition(room: RoomState, player: PlayerState): Position {
  let positions = roomPositions.get(room.code);
  if (!positions) {
    positions = new Map();
    roomPositions.set(room.code, positions);
  }
  let pos = positions.get(player.id);
  if (!pos) {
    pos = spawnPositionForSlot(player.slotIndex);
    positions.set(player.id, pos);
  }
  return pos;
}

export function allPositions(room: RoomState): Record<string, Position> {
  const positions = roomPositions.get(room.code);
  const out: Record<string, Position> = {};
  if (!positions) return out;
  for (const [id, pos] of positions) out[id] = pos;
  return out;
}

export function movePlayer(
  room: RoomState,
  clientId: string,
  targetX: number,
  targetY: number,
): { from: Position; to: Position; duration: number } {
  let positions = roomPositions.get(room.code);
  if (!positions) {
    positions = new Map();
    roomPositions.set(room.code, positions);
  }
  const player = room.players.find((p) => p.id === clientId);
  const from = positions.get(clientId) ?? (player ? spawnPositionForSlot(player.slotIndex) : { x: targetX, y: targetY });
  const to = clampToWorld({ x: targetX, y: targetY });
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const duration = Math.max(50, (distance / MOVE_SPEED) * 1000);
  positions.set(clientId, to);
  return { from, to, duration };
}

function growSpeedMultiplier(player: PlayerState): number {
  let reduction = 0;
  for (const [gearId, owned] of Object.entries(player.gearOwned)) {
    const gear = GEAR_BY_ID[gearId];
    if (gear && gear.effect.type === "growSpeed" && owned > 0) reduction += gear.effect.value;
  }
  return Math.max(0.25, 1 - reduction);
}

function sellMultiplier(player: PlayerState): number {
  let bonus = 0;
  for (const [gearId, owned] of Object.entries(player.gearOwned)) {
    const gear = GEAR_BY_ID[gearId];
    if (gear && gear.effect.type === "sellBonus" && owned > 0) bonus += gear.effect.value;
  }
  return 1 + bonus;
}

function canPlaceAt(player: PlayerState, x: number, y: number, w: number, h: number): boolean {
  if (x < 0 || y < 0 || x + w > player.gridWidth || y + h > player.gridHeight) return false;
  for (const p of player.plantings) {
    if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) return false;
  }
  return true;
}

export function buySeed(player: PlayerState, cropId: string, quantity: number): { error?: string } {
  const crop = CROPS_BY_ID[cropId];
  if (!crop) return { error: "Unknown crop." };
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) return { error: "Invalid quantity." };
  if (player.coins < crop.unlockAt && player.lifetimeCoins < crop.unlockAt) {
    return { error: `${crop.name} is still locked.` };
  }
  const totalCost = crop.seedCost * quantity;
  if (player.coins < totalCost) return { error: "Not enough coins." };
  player.coins -= totalCost;
  player.seedInventory[cropId] = (player.seedInventory[cropId] ?? 0) + quantity;
  return {};
}

export function plant(room: RoomState, player: PlayerState, x: number, y: number, cropId: string): { error?: string } {
  const crop = getCropDef(cropId);
  if (!crop) return { error: "Unknown crop." };
  if ((player.seedInventory[cropId] ?? 0) <= 0) return { error: "You don't have that seed." };
  const { w, h } = resolveFootprint(cropId, crop.footprint);
  if (!canPlaceAt(player, x, y, w, h)) return { error: "Won't fit there." };

  player.seedInventory[cropId] -= 1;
  const now = Date.now();
  const tier = rollSizeTier();
  const requiredMs = crop.growSeconds * 1000 * growSpeedMultiplier(player);
  const planting: Planting = {
    id: nanoid(8),
    cropId,
    x,
    y,
    w,
    h,
    plantedAt: now,
    readyAt: computeReadyAt(room.createdAt, now, requiredMs),
    sizeLabel: tier.label,
    sizePriceMultiplier: tier.priceMultiplier,
    sizeVisualScale: tier.visualScale,
    mutations: rollMutations(room.createdAt, now),
  };
  player.plantings.push(planting);
  return {};
}

export function harvest(room: RoomState, player: PlayerState, plantingId: string): { error?: string } {
  const idx = player.plantings.findIndex((p) => p.id === plantingId);
  if (idx === -1) return { error: "Nothing planted there." };
  const planting = player.plantings[idx];
  if (Date.now() < planting.readyAt) return { error: "Not ready yet." };
  const harvested: HarvestedCrop = {
    itemId: nanoid(8),
    cropId: planting.cropId,
    sizeLabel: planting.sizeLabel,
    sizePriceMultiplier: planting.sizePriceMultiplier,
    mutations: planting.mutations,
  };
  player.cropInventory.push(harvested);

  const crop = getCropDef(planting.cropId);
  if (crop?.persistent) {
    // Persistent crops are trees/vines: they stay planted and immediately start regrowing
    // a fresh fruit (new size/mutation roll) instead of being consumed.
    const now = Date.now();
    const tier = rollSizeTier();
    const requiredMs = crop.growSeconds * 1000 * growSpeedMultiplier(player);
    planting.plantedAt = now;
    planting.readyAt = computeReadyAt(room.createdAt, now, requiredMs);
    planting.sizeLabel = tier.label;
    planting.sizePriceMultiplier = tier.priceMultiplier;
    planting.sizeVisualScale = tier.visualScale;
    planting.mutations = rollMutations(room.createdAt, now);
  } else {
    player.plantings.splice(idx, 1);
  }
  return {};
}

export function reclaim(player: PlayerState, plantingId: string): { error?: string } {
  const owned = player.gearOwned["reclaimer"] ?? 0;
  if (owned <= 0) return { error: "You need the Reclaimer tool from the Gear Shop first." };
  const idx = player.plantings.findIndex((p) => p.id === plantingId);
  if (idx === -1) return { error: "Nothing planted there." };
  const planting = player.plantings[idx];
  player.seedInventory[planting.cropId] = (player.seedInventory[planting.cropId] ?? 0) + 1;
  player.plantings.splice(idx, 1);
  return {};
}

export function sell(
  player: PlayerState,
  cropId: string,
  sizeLabel: string,
  mutations: MutationId[],
  quantity: number | "all",
): { error?: string } {
  const crop = getCropDef(cropId);
  if (!crop) return { error: "Unknown crop." };
  const key = mutationKey(mutations);
  const matching = player.cropInventory.filter(
    (c) => c.cropId === cropId && c.sizeLabel === sizeLabel && mutationKey(c.mutations) === key,
  );
  const qty = quantity === "all" ? matching.length : quantity;
  if (!Number.isInteger(qty) || qty <= 0) return { error: "Nothing to sell." };
  if (qty > matching.length) return { error: "You don't have that many." };
  const toSell = matching.slice(0, qty);
  const mult = sellMultiplier(player);
  let earned = 0;
  for (const item of toSell) {
    let mutationMult = 1;
    for (const m of item.mutations) mutationMult *= MUTATIONS[m].priceMultiplier;
    earned += Math.round(crop.sellPrice * item.sizePriceMultiplier * mutationMult * mult);
  }
  const soldIds = new Set(toSell.map((item) => item.itemId));
  player.cropInventory = player.cropInventory.filter((c) => !soldIds.has(c.itemId));
  player.coins += earned;
  player.lifetimeCoins += earned;
  return {};
}

export function buyGear(player: PlayerState, gearId: string): { error?: string } {
  const gear = GEAR_BY_ID[gearId];
  if (!gear) return { error: "Unknown gear." };
  const owned = player.gearOwned[gearId] ?? 0;
  if (!gear.repeatable && owned > 0) return { error: "You already own that." };
  if (gear.maxOwned && owned >= gear.maxOwned) return { error: "Maxed out." };
  const cost = Math.round(gear.cost * (1 + owned * 0.5));
  if (player.coins < cost) return { error: "Not enough coins." };
  player.coins -= cost;
  player.gearOwned[gearId] = owned + 1;
  if (gear.effect.type === "expandGarden") {
    player.gridHeight = Math.min(BASE_GRID_HEIGHT + GRID_EXPANSION_MAX, player.gridHeight + gear.effect.value);
  }
  return {};
}

export function nextGearCost(gear: { id: string; cost: number }, owned: number): number {
  return Math.round(gear.cost * (1 + owned * 0.5));
}

/** Snapshots the fields worth persisting for a logged-in player's account. */
export function extractProgress(player: PlayerState): SavedProgress {
  return {
    coins: player.coins,
    lifetimeCoins: player.lifetimeCoins,
    gridWidth: player.gridWidth,
    gridHeight: player.gridHeight,
    plantings: player.plantings,
    seedInventory: player.seedInventory,
    cropInventory: player.cropInventory,
    gearOwned: player.gearOwned,
  };
}

export function buyMoonPack(player: PlayerState): { error?: string; result?: PackResult } {
  if (player.coins < MOON_PACK_COST) return { error: "Not enough coins." };
  player.coins -= MOON_PACK_COST;
  const result = rollMoonPack();
  player.seedInventory[result.cropId] = (player.seedInventory[result.cropId] ?? 0) + 1;
  return { result };
}
