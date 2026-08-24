import { customAlphabet, nanoid } from "nanoid";
import { CROPS, CROPS_BY_ID, GEAR_BY_ID, MAX_PLAYERS_PER_ROOM, rollSizeTier, STARTING_COINS, type GearItem, type GearPrice } from "./gameData.js";
import { MOON_PACK_COST, resolveFootprint, rollMoonPack, type PackResult } from "./moonData.js";
import {
  BASE_PET_SLOTS,
  equippedPetIds,
  MAX_PET_SLOTS,
  nextPetSlotCost,
  PET_EGGS_BY_ID,
  PET_SIZE_MULTIPLIER,
  PETS_BY_ID,
  rollPetEgg,
  type PetSize,
} from "./petData.js";
import {
  getAnyCropDef as getCropDef,
  resolveSolarFootprint,
  rollSolarPack,
  SOLAR_PACK_COST,
  type SolarPackResult,
} from "./solarData.js";
import {
  dayBucket,
  DAILY_QUEST_POOL,
  DAILY_REROLL_BASE_COST,
  DAILY_REROLL_STEP,
  rerollCost,
  rollDailyQuests,
  rollWeeklyQuests,
  templateToQuest,
  weekBucket,
  WEEKLY_QUEST_POOL,
  WEEKLY_REROLL_BASE_COST,
  WEEKLY_REROLL_STEP,
  type Quest,
  type QuestType,
} from "./quests.js";
import type { HarvestedCrop, PlayerState, Planting, RoomState } from "./types.js";
import { findUserById, type SavedProgress } from "./userStore.js";
import { computeReadyAt, getFeaturedShop, MUTATIONS, mutationKey, rollMutations, type MutationId } from "./weather.js";
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
  const player: PlayerState = {
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
    dailyQuests: saved?.dailyQuests ?? [],
    weeklyQuests: saved?.weeklyQuests ?? [],
    dailyQuestBucket: saved?.dailyQuestBucket ?? -1,
    weeklyQuestBucket: saved?.weeklyQuestBucket ?? -1,
    dailyRerollCount: saved?.dailyRerollCount ?? 0,
    weeklyRerollCount: saved?.weeklyRerollCount ?? 0,
    seedStock: saved?.seedStock ?? {},
    seedStockBucket: saved?.seedStockBucket ?? -1,
    diamonds: saved?.diamonds ?? 0,
    persistentUnlocked: saved?.persistentUnlocked ?? {},
    petsOwned: saved?.petsOwned ?? {},
    petSlots: saved?.petSlots ?? BASE_PET_SLOTS,
  };
  ensureQuestsFresh(player, Date.now());
  ensureStockFresh(player, Date.now());
  return player;
}

const STOCK_CYCLE_MS = 2 * 60 * 1000;
/** Common through Epic (tier 0-3): always in stock once unlocked, capped and refilled each cycle. */
const LOW_TIER_STOCK = 5;
const LOW_TIER_MAX_CROP_TIER = 3;
/** Mythic and above (tier 4+): usually out of stock — each cycle rolls a chance for one unit to
 *  appear, and it isn't re-rolled away until someone buys it. */
const HIGH_TIER_RESTOCK_CHANCE = 0.35;
const HIGH_TIER_RESTOCK_QTY = 1;

function isUnlockedFor(player: PlayerState, unlockAt: number): boolean {
  return player.coins >= unlockAt || player.lifetimeCoins >= unlockAt;
}

/** Rolls a fresh seed-shop stock the moment the player's real-world 2-minute bucket rolls over. */
export function ensureStockFresh(player: PlayerState, now: number) {
  const bucket = Math.floor(now / STOCK_CYCLE_MS);
  if (player.seedStockBucket === bucket) return;
  player.seedStockBucket = bucket;
  for (const crop of CROPS) {
    if (!isUnlockedFor(player, crop.unlockAt)) continue;
    if (crop.tier <= LOW_TIER_MAX_CROP_TIER) {
      player.seedStock[crop.id] = LOW_TIER_STOCK;
    } else if ((player.seedStock[crop.id] ?? 0) <= 0 && Math.random() < HIGH_TIER_RESTOCK_CHANCE) {
      player.seedStock[crop.id] = HIGH_TIER_RESTOCK_QTY;
    }
  }
}

/** Regenerates a player's daily/weekly quest sets the moment their real-world bucket has rolled over. */
export function ensureQuestsFresh(player: PlayerState, now: number) {
  const dBucket = dayBucket(now);
  if (player.dailyQuestBucket !== dBucket) {
    player.dailyQuests = rollDailyQuests();
    player.dailyQuestBucket = dBucket;
    player.dailyRerollCount = 0;
  }
  const wBucket = weekBucket(now);
  if (player.weeklyQuestBucket !== wBucket) {
    player.weeklyQuests = rollWeeklyQuests();
    player.weeklyQuestBucket = wBucket;
    player.weeklyRerollCount = 0;
  }
}

function grantQuestReward(player: PlayerState, quest: Quest) {
  player.coins += quest.coinReward;
  player.lifetimeCoins += quest.coinReward;
  for (let i = 0; i < quest.moonPacks; i++) {
    const result = rollMoonPack();
    player.seedInventory[result.cropId] = (player.seedInventory[result.cropId] ?? 0) + 1;
  }
}

function advanceQuests(player: PlayerState, type: QuestType, amount: number) {
  for (const quest of [...player.dailyQuests, ...player.weeklyQuests]) {
    if (quest.completed || quest.type !== type) continue;
    quest.progress = Math.min(quest.target, quest.progress + amount);
    if (quest.progress >= quest.target) {
      quest.completed = true;
      grantQuestReward(player, quest);
    }
  }
}

export function rerollQuest(
  player: PlayerState,
  questSet: "daily" | "weekly",
  questId: string,
): { error?: string } {
  const quests = questSet === "daily" ? player.dailyQuests : player.weeklyQuests;
  const idx = quests.findIndex((q) => q.id === questId);
  if (idx === -1) return { error: "Quest not found." };
  const usedCount = questSet === "daily" ? player.dailyRerollCount : player.weeklyRerollCount;
  const cost =
    questSet === "daily"
      ? rerollCost(DAILY_REROLL_BASE_COST, DAILY_REROLL_STEP, usedCount)
      : rerollCost(WEEKLY_REROLL_BASE_COST, WEEKLY_REROLL_STEP, usedCount);
  if (player.coins < cost) return { error: "Not enough coins." };
  player.coins -= cost;
  const pool = questSet === "daily" ? DAILY_QUEST_POOL : WEEKLY_QUEST_POOL;
  const otherKeys = new Set(quests.filter((_, i) => i !== idx).map((q) => `${q.type}:${q.target}`));
  const candidates = pool.filter((t) => !otherKeys.has(`${t.type}:${t.target}`));
  const usable = candidates.length > 0 ? candidates : pool;
  quests[idx] = templateToQuest(usable[Math.floor(Math.random() * usable.length)]);
  if (questSet === "daily") player.dailyRerollCount += 1;
  else player.weeklyRerollCount += 1;
  return {};
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

/** Each level's value replaces the previous one (it's an upgrade, not a stacking bonus) — so this
 *  reads the value for the player's current level rather than summing across levels owned. */
function currentLevelValue(levels: number[], owned: number): number {
  if (owned <= 0) return 0;
  return levels[Math.min(owned, levels.length) - 1];
}

/** Only pets within the player's slot count (their best pets, by tier) actively contribute. */
function activePets(player: PlayerState) {
  return equippedPetIds(player.petsOwned, player.petSlots).map((id) => ({
    pet: PETS_BY_ID[id],
    size: player.petsOwned[id],
  }));
}

export function hasUnicornEquipped(player: PlayerState): boolean {
  return equippedPetIds(player.petsOwned, player.petSlots).includes("unicorn");
}

function growSpeedMultiplier(player: PlayerState): number {
  let reduction = 0;
  for (const [gearId, owned] of Object.entries(player.gearOwned)) {
    const gear = GEAR_BY_ID[gearId];
    if (gear && gear.effect.type === "growSpeed") reduction += currentLevelValue(gear.effect.levels, owned);
  }
  for (const { pet, size } of activePets(player)) {
    if (pet && pet.effect.type === "growSpeed") reduction += pet.effect.value * PET_SIZE_MULTIPLIER[size];
  }
  return Math.max(0.25, 1 - reduction);
}

function sellMultiplier(player: PlayerState): number {
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

interface PetHatchOutcome {
  petId: string;
  size: PetSize;
  isNew: boolean;
  upgraded: boolean;
}

/** Applies one hatch to the player's collection — a bigger re-roll of a pet you already own
 *  upgrades it in place, otherwise the roll is recorded but doesn't overwrite a bigger one. */
function applyHatch(player: PlayerState, hatch: { petId: string; size: PetSize }): PetHatchOutcome {
  const existingSize = player.petsOwned[hatch.petId];
  const isNew = !existingSize;
  const upgraded = !isNew && PET_SIZE_MULTIPLIER[hatch.size] > PET_SIZE_MULTIPLIER[existingSize];
  if (isNew || upgraded) player.petsOwned[hatch.petId] = hatch.size;
  return { petId: hatch.petId, size: player.petsOwned[hatch.petId], isNew, upgraded };
}

export function buyPetEgg(player: PlayerState, eggId: string): { error?: string } & Partial<PetHatchOutcome> {
  const egg = PET_EGGS_BY_ID[eggId];
  if (!egg) return { error: "Unknown egg." };
  if (player.coins < egg.cost.coins) return { error: "Not enough coins." };
  if (player.diamonds < egg.cost.diamonds) return { error: "Not enough diamonds." };
  const hatch = rollPetEgg(eggId);
  if (!hatch) return { error: "Unknown egg." };
  player.coins -= egg.cost.coins;
  player.diamonds -= egg.cost.diamonds;
  return applyHatch(player, hatch);
}

const BULK_EGG_COUNT = 10;
const BULK_EGG_DISCOUNT = 0.1;

export function nextPetEggBulkCost(egg: { cost: { coins: number; diamonds: number } }): { coins: number; diamonds: number } {
  return {
    coins: Math.round(egg.cost.coins * BULK_EGG_COUNT * (1 - BULK_EGG_DISCOUNT)),
    diamonds: Math.round(egg.cost.diamonds * BULK_EGG_COUNT * (1 - BULK_EGG_DISCOUNT)),
  };
}

export function buyPetEggBulk(
  player: PlayerState,
  eggId: string,
): { error?: string; results?: PetHatchOutcome[]; cost?: { coins: number; diamonds: number } } {
  const egg = PET_EGGS_BY_ID[eggId];
  if (!egg) return { error: "Unknown egg." };
  const cost = nextPetEggBulkCost(egg);
  if (player.coins < cost.coins) return { error: "Not enough coins." };
  if (player.diamonds < cost.diamonds) return { error: "Not enough diamonds." };
  player.coins -= cost.coins;
  player.diamonds -= cost.diamonds;
  const results = Array.from({ length: BULK_EGG_COUNT }, () => applyHatch(player, rollPetEgg(eggId)!));
  return { results, cost };
}

export function buyPetSlot(player: PlayerState): { error?: string } {
  if (player.petSlots >= MAX_PET_SLOTS) return { error: "Pet slots already maxed." };
  const cost = nextPetSlotCost(player.petSlots);
  if (!cost) return { error: "Pet slots already maxed." };
  if (player.coins < cost.coins) return { error: "Not enough coins." };
  if (player.diamonds < cost.diamonds) return { error: "Not enough diamonds." };
  player.coins -= cost.coins;
  player.diamonds -= cost.diamonds;
  player.petSlots += 1;
  return {};
}

function canPlaceAt(player: PlayerState, x: number, y: number, w: number, h: number, ignoreId?: string): boolean {
  if (x < 0 || y < 0 || x + w > player.gridWidth || y + h > player.gridHeight) return false;
  for (const p of player.plantings) {
    if (p.id === ignoreId) continue;
    if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) return false;
  }
  return true;
}

/** True if two footprints share an edge (not just a corner) — "the squares next to it". */
function isOrthogonallyAdjacent(a: Planting, b: Planting): boolean {
  const rowOverlap = a.y < b.y + b.h && b.y < a.y + a.h;
  const colOverlap = a.x < b.x + b.w && b.x < a.x + a.w;
  const touchesHorizontally = rowOverlap && (a.x + a.w === b.x || b.x + b.w === a.x);
  const touchesVertically = colOverlap && (a.y + a.h === b.y || b.y + b.h === a.y);
  return touchesHorizontally || touchesVertically;
}

/** Each Moon Blossom blesses exactly one neighbor — whichever adjacent crop has sat there the
 *  longest (ties broken by id for stability) — with +20% value ("lunar"). Computed live off
 *  current board layout rather than stored, so moving/reclaiming the Blossom updates it instantly. */
function lunarRecipientId(player: PlayerState, blossom: Planting): string | undefined {
  const adjacent = player.plantings.filter((p) => p.id !== blossom.id && isOrthogonallyAdjacent(p, blossom));
  if (adjacent.length === 0) return undefined;
  return adjacent.reduce((a, b) =>
    a.plantedAt !== b.plantedAt ? (a.plantedAt < b.plantedAt ? a : b) : a.id < b.id ? a : b,
  ).id;
}

function withLunarAura(player: PlayerState, planting: Planting, mutations: MutationId[]): MutationId[] {
  const blossoms = player.plantings.filter((p) => p.cropId === "moon_blossom" && p.id !== planting.id);
  const blessed = blossoms.some((b) => lunarRecipientId(player, b) === planting.id);
  if (!blessed || mutations.includes("lunar")) return mutations;
  return [...mutations, "lunar"];
}

/** Persistent crops regrow 10x slower than their first grow — they're a one-time seed cost that
 *  would otherwise print money forever, so the ongoing regrow needs a real time cost. */
const PERSISTENT_REGROW_MULTIPLIER = 10;

export function buySeed(player: PlayerState, cropId: string, quantity: number): { error?: string } {
  const crop = CROPS_BY_ID[cropId];
  if (!crop) return { error: "Unknown crop." };
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) return { error: "Invalid quantity." };
  if (player.coins < crop.unlockAt && player.lifetimeCoins < crop.unlockAt) {
    return { error: `${crop.name} is still locked.` };
  }
  const inStock = player.seedStock[cropId] ?? 0;
  if (inStock < quantity) {
    return { error: inStock === 0 ? `${crop.name} is out of stock right now.` : `Only ${inStock} left in stock.` };
  }
  const totalCost = crop.seedCost * quantity;
  if (player.coins < totalCost) return { error: "Not enough coins." };
  player.coins -= totalCost;
  player.seedInventory[cropId] = (player.seedInventory[cropId] ?? 0) + quantity;
  player.seedStock[cropId] = inStock - quantity;
  return {};
}

export function plant(room: RoomState, player: PlayerState, x: number, y: number, cropId: string): { error?: string } {
  const crop = getCropDef(cropId);
  if (!crop) return { error: "Unknown crop." };
  if ((player.seedInventory[cropId] ?? 0) <= 0) return { error: "You don't have that seed." };
  const { w, h } = resolveSolarFootprint(cropId, resolveFootprint(cropId, crop.footprint));
  if (!canPlaceAt(player, x, y, w, h)) return { error: "Won't fit there." };

  player.seedInventory[cropId] -= 1;
  const now = Date.now();
  const tier = rollSizeTier();
  // Once a player has harvested this crop's persistent form before, every future planting of it
  // grows at the slow persistent-regrow rate from the start — otherwise reclaiming a regrowing
  // tree and replanting the recovered seed would re-roll the fast first grow indefinitely.
  const alreadyUnlocked = !!crop.persistent && !!player.persistentUnlocked[cropId];
  const requiredMs = crop.growSeconds * 1000 * growSpeedMultiplier(player) * (alreadyUnlocked ? PERSISTENT_REGROW_MULTIPLIER : 1);
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
    mutations: rollMutations(room.createdAt, now, hasUnicornEquipped(player)),
  };
  player.plantings.push(planting);
  advanceQuests(player, "plant", 1);
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
    mutations: withLunarAura(player, planting, planting.mutations),
  };
  player.cropInventory.push(harvested);
  advanceQuests(player, "harvest", 1);

  const crop = getCropDef(planting.cropId);
  if (crop?.persistent) {
    // Persistent crops are trees/vines: they stay planted and immediately start regrowing
    // a fresh fruit (new size/mutation roll) instead of being consumed — at 10x the normal
    // grow time, since otherwise a one-time seed cost prints money forever.
    player.persistentUnlocked[planting.cropId] = true;
    const now = Date.now();
    const tier = rollSizeTier();
    const requiredMs = crop.growSeconds * 1000 * growSpeedMultiplier(player) * PERSISTENT_REGROW_MULTIPLIER;
    planting.plantedAt = now;
    planting.readyAt = computeReadyAt(room.createdAt, now, requiredMs);
    planting.sizeLabel = tier.label;
    planting.sizePriceMultiplier = tier.priceMultiplier;
    planting.sizeVisualScale = tier.visualScale;
    planting.mutations = rollMutations(room.createdAt, now, hasUnicornEquipped(player));
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

export function movePlanting(player: PlayerState, plantingId: string, x: number, y: number): { error?: string } {
  const owned = player.gearOwned["trowel"] ?? 0;
  if (owned <= 0) return { error: "You need the Trowel from the Gear Shop first." };
  const planting = player.plantings.find((p) => p.id === plantingId);
  if (!planting) return { error: "Nothing planted there." };
  if (!canPlaceAt(player, x, y, planting.w, planting.h, planting.id)) return { error: "Won't fit there." };
  planting.x = x;
  planting.y = y;
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
  const diamondReward = (crop as { diamondReward?: number }).diamondReward;
  let earned = 0;
  let diamonds = 0;
  for (const item of toSell) {
    if (diamondReward) {
      diamonds += diamondReward;
      continue;
    }
    let mutationMult = 1;
    for (const m of item.mutations) mutationMult *= MUTATIONS[m].priceMultiplier;
    earned += Math.round(crop.sellPrice * item.sizePriceMultiplier * mutationMult * mult);
  }
  const soldIds = new Set(toSell.map((item) => item.itemId));
  player.cropInventory = player.cropInventory.filter((c) => !soldIds.has(c.itemId));
  player.coins += earned;
  player.lifetimeCoins += earned;
  player.diamonds += diamonds;
  advanceQuests(player, "sell", qty);
  advanceQuests(player, "earn_coins", earned);
  return {};
}

export function sellAll(player: PlayerState): { error?: string; earned?: number; diamonds?: number; count?: number } {
  if (player.cropInventory.length === 0) return { error: "Nothing to sell." };
  const mult = sellMultiplier(player);
  let earned = 0;
  let diamonds = 0;
  for (const item of player.cropInventory) {
    const crop = getCropDef(item.cropId);
    if (!crop) continue;
    const diamondReward = (crop as { diamondReward?: number }).diamondReward;
    if (diamondReward) {
      diamonds += diamondReward;
      continue;
    }
    let mutationMult = 1;
    for (const m of item.mutations) mutationMult *= MUTATIONS[m].priceMultiplier;
    earned += Math.round(crop.sellPrice * item.sizePriceMultiplier * mutationMult * mult);
  }
  const count = player.cropInventory.length;
  player.cropInventory = [];
  player.coins += earned;
  player.lifetimeCoins += earned;
  player.diamonds += diamonds;
  advanceQuests(player, "sell", count);
  advanceQuests(player, "earn_coins", earned);
  return { earned, diamonds, count };
}

export function nextGearPrice(gear: GearItem, owned: number): GearPrice {
  if (gear.levelCosts) return gear.levelCosts[Math.min(owned, gear.levelCosts.length - 1)];
  return { coins: Math.round(gear.cost * (1 + owned * 0.5)), diamonds: 0 };
}

export function buyGear(player: PlayerState, gearId: string): { error?: string } {
  const gear = GEAR_BY_ID[gearId];
  if (!gear) return { error: "Unknown gear." };
  const owned = player.gearOwned[gearId] ?? 0;
  if (!gear.repeatable && owned > 0) return { error: "You already own that." };
  if (gear.maxOwned && owned >= gear.maxOwned) return { error: "Maxed out." };
  const price = nextGearPrice(gear, owned);
  if (player.coins < price.coins) return { error: "Not enough coins." };
  if (player.diamonds < price.diamonds) return { error: "Not enough diamonds." };
  player.coins -= price.coins;
  player.diamonds -= price.diamonds;
  player.gearOwned[gearId] = owned + 1;
  if (gear.effect.type === "expandGarden") {
    player.gridHeight = Math.min(BASE_GRID_HEIGHT + GRID_EXPANSION_MAX, player.gridHeight + gear.effect.value);
  }
  return {};
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
    dailyQuests: player.dailyQuests,
    weeklyQuests: player.weeklyQuests,
    dailyQuestBucket: player.dailyQuestBucket,
    weeklyQuestBucket: player.weeklyQuestBucket,
    dailyRerollCount: player.dailyRerollCount,
    weeklyRerollCount: player.weeklyRerollCount,
    seedStock: player.seedStock,
    seedStockBucket: player.seedStockBucket,
    diamonds: player.diamonds,
    persistentUnlocked: player.persistentUnlocked,
    petsOwned: player.petsOwned,
    petSlots: player.petSlots,
  };
}

const BULK_PACK_COUNT = 10;
const BULK_PACK_DISCOUNT = 0.1;

export function buyMoonPack(room: RoomState, player: PlayerState): { error?: string; result?: PackResult } {
  if (getFeaturedShop(room.createdAt, Date.now()) !== "moon") {
    return { error: "The Moon Shop isn't featured right now — check back later." };
  }
  if (player.coins < MOON_PACK_COST) return { error: "Not enough coins." };
  player.coins -= MOON_PACK_COST;
  const result = rollMoonPack();
  player.seedInventory[result.cropId] = (player.seedInventory[result.cropId] ?? 0) + 1;
  return { result };
}

export function buyMoonPackBulk(room: RoomState, player: PlayerState): { error?: string; results?: PackResult[]; cost?: number } {
  if (getFeaturedShop(room.createdAt, Date.now()) !== "moon") {
    return { error: "The Moon Shop isn't featured right now — check back later." };
  }
  const cost = Math.round(MOON_PACK_COST * BULK_PACK_COUNT * (1 - BULK_PACK_DISCOUNT));
  if (player.coins < cost) return { error: "Not enough coins." };
  player.coins -= cost;
  const results = Array.from({ length: BULK_PACK_COUNT }, () => rollMoonPack());
  for (const result of results) {
    player.seedInventory[result.cropId] = (player.seedInventory[result.cropId] ?? 0) + 1;
  }
  return { results, cost };
}

export function buySolarPack(room: RoomState, player: PlayerState): { error?: string; result?: SolarPackResult } {
  if (getFeaturedShop(room.createdAt, Date.now()) !== "solar") {
    return { error: "The Solar Shop isn't featured right now — check back later." };
  }
  if (player.diamonds < SOLAR_PACK_COST) return { error: "Not enough diamonds." };
  player.diamonds -= SOLAR_PACK_COST;
  const result = rollSolarPack();
  player.seedInventory[result.cropId] = (player.seedInventory[result.cropId] ?? 0) + 1;
  return { result };
}

export function buySolarPackBulk(
  room: RoomState,
  player: PlayerState,
): { error?: string; results?: SolarPackResult[]; cost?: number } {
  if (getFeaturedShop(room.createdAt, Date.now()) !== "solar") {
    return { error: "The Solar Shop isn't featured right now — check back later." };
  }
  const cost = Math.round(SOLAR_PACK_COST * BULK_PACK_COUNT * (1 - BULK_PACK_DISCOUNT));
  if (player.diamonds < cost) return { error: "Not enough diamonds." };
  player.diamonds -= cost;
  const results = Array.from({ length: BULK_PACK_COUNT }, () => rollSolarPack());
  for (const result of results) {
    player.seedInventory[result.cropId] = (player.seedInventory[result.cropId] ?? 0) + 1;
  }
  return { results, cost };
}

const DIAMOND_BUY_RATE = 1_000_000; // coins per diamond when buying
const DIAMOND_SELL_RATE = 800_000; // coins per diamond when selling back (a deliberate loss vs. buying)

export function buyDiamonds(player: PlayerState, quantity: number): { error?: string } {
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Invalid quantity." };
  const cost = quantity * DIAMOND_BUY_RATE;
  if (player.coins < cost) return { error: "Not enough coins." };
  player.coins -= cost;
  player.diamonds += quantity;
  return {};
}

export function sellDiamonds(player: PlayerState, quantity: number): { error?: string } {
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Invalid quantity." };
  if (player.diamonds < quantity) return { error: "You don't have that many diamonds." };
  player.diamonds -= quantity;
  player.coins += quantity * DIAMOND_SELL_RATE;
  return {};
}
