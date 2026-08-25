import { customAlphabet, nanoid } from "nanoid";
import {
  CROPS,
  CROPS_BY_ID,
  GEAR_BY_ID,
  GROW_SPEED_FLOOR,
  INCUBATOR_SPEED_FLOOR,
  MAX_PLAYERS_PER_ROOM,
  PERSISTENT_REGROW_MULTIPLIER,
  rollSizeTier,
  STARTING_COINS,
  type GearItem,
  type GearPrice,
} from "./gameData.js";
import { MOON_PACK_COST, resolveFootprint, rollBlossomColor, rollMoonPack, type PackResult } from "./moonData.js";
import {
  BASE_PET_SLOTS,
  defaultEquippedSlots,
  evolutionInfo,
  MAX_EVOLUTION_STAGE,
  MAX_PET_SLOTS,
  MERGE_COUNT,
  nextEvolutionId,
  nextPetSlotCost,
  parseSlotKey,
  PET_EGGS_BY_ID,
  PET_SIZE_MULTIPLIER,
  PETS_BY_ID,
  rollPetEgg,
  slotKey,
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
import type {
  HarvestedCrop,
  IncubatorState,
  KitsuneRecipe,
  KitsuneShrineState,
  PlayerState,
  Planting,
  RoomState,
} from "./types.js";
import { findUserById, type SavedProgress } from "./userStore.js";
import {
  computeReadyAt,
  effectiveWorkBetween,
  getFeaturedShop,
  MUTATIONS,
  mutationKey,
  rollMutations,
  type MutationId,
} from "./weather.js";
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
    kelkaCrystals: saved?.kelkaCrystals ?? 0,
    persistentUnlocked: saved?.persistentUnlocked ?? {},
    petsOwned: saved?.petsOwned ?? {},
    petSlots: saved?.petSlots ?? BASE_PET_SLOTS,
    // Saves from before manual equipping existed have no petsEquipped — fill in the pets that
    // used to auto-contribute (best by tier) so nobody's bonuses silently disappear on upgrade.
    petsEquipped: saved?.petsEquipped ?? defaultEquippedSlots(saved?.petsOwned ?? {}, saved?.petSlots ?? BASE_PET_SLOTS),
    incubators: saved?.incubators ?? [],
    petProcAt: saved?.petProcAt ?? {},
    foxEggsOwned: saved?.foxEggsOwned ?? 0,
    kitsuneShrines: saved?.kitsuneShrines ?? [],
  };
  sanitizePetState(player);
  ensureQuestsFresh(player, Date.now());
  ensureStockFresh(player, Date.now());
  return player;
}

/** Pets went through a few storage shapes as the feature grew (owned-list -> single size per pet
 *  -> stacked counts) — a save from an older shape, or any other corruption, could otherwise
 *  leave `petsEquipped` pointing at a (pet, size) with zero real copies backing it, which would
 *  silently keep granting its bonus forever while the pet lists show nothing owned. Called once
 *  on load to make sure equipped slots always match reality. */
function sanitizePetState(player: PlayerState) {
  if (!player.petsOwned || typeof player.petsOwned !== "object" || Array.isArray(player.petsOwned)) {
    player.petsOwned = {};
  }
  if (!Array.isArray(player.petsEquipped)) player.petsEquipped = [];
  if (!player.petProcAt || typeof player.petProcAt !== "object" || Array.isArray(player.petProcAt)) {
    player.petProcAt = {};
  }
  for (const [petId, sizes] of Object.entries(player.petsOwned)) {
    if (!sizes || typeof sizes !== "object") {
      delete player.petsOwned[petId];
      continue;
    }
    for (const size of Object.keys(sizes) as PetSize[]) {
      const count = sizes[size];
      if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) delete sizes[size];
    }
    if (Object.keys(sizes).length === 0) delete player.petsOwned[petId];
  }
  player.petsEquipped = player.petsEquipped.filter((key) => {
    const { petId, size } = parseSlotKey(key);
    return (player.petsOwned[petId]?.[size] ?? 0) > 0;
  });
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

/** Kelka Crystals (Grow All's currency) are daily-only and never come from weekly quests —
 *  weekly quests are already worth much more in coins/Moon Packs, and Kelka Crystals need to
 *  stay scarce enough to actually rate-limit Grow All rather than becoming another reward to
 *  stockpile. */
function grantQuestReward(player: PlayerState, quest: Quest, isDaily: boolean) {
  player.coins += quest.coinReward;
  player.lifetimeCoins += quest.coinReward;
  for (let i = 0; i < quest.moonPacks; i++) {
    const result = rollMoonPack();
    player.seedInventory[result.cropId] = (player.seedInventory[result.cropId] ?? 0) + 1;
  }
  if (isDaily) player.kelkaCrystals += 1;
}

function advanceQuests(player: PlayerState, type: QuestType, amount: number) {
  for (const quest of player.dailyQuests) {
    if (quest.completed || quest.type !== type) continue;
    quest.progress = Math.min(quest.target, quest.progress + amount);
    if (quest.progress >= quest.target) {
      quest.completed = true;
      grantQuestReward(player, quest, true);
    }
  }
  for (const quest of player.weeklyQuests) {
    if (quest.completed || quest.type !== type) continue;
    quest.progress = Math.min(quest.target, quest.progress + amount);
    if (quest.progress >= quest.target) {
      quest.completed = true;
      grantQuestReward(player, quest, false);
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
    // The room (and this player object) lives in memory for as long as the room is alive —
    // reconnecting (refresh, relogin) reuses it rather than rebuilding via makePlayer, so a
    // fixed-on-load check like this needs to also run here or it never takes effect until the
    // server itself restarts.
    sanitizePetState(existing);
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

/** Only manually-equipped pets (equip_pet/unequip_pet) actively contribute. */
function activePets(player: PlayerState) {
  return player.petsEquipped.map((key) => {
    const { petId, size } = parseSlotKey(key);
    return { pet: PETS_BY_ID[petId], size };
  });
}

/** An Empowered/Tenacious Unicorn still counts as a Unicorn for the Rainbow mutation. */
export function hasUnicornEquipped(player: PlayerState): boolean {
  return player.petsEquipped.some((key) => evolutionInfo(parseSlotKey(key).petId).baseId === "unicorn");
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
  return Math.max(GROW_SPEED_FLOOR, 1 - reduction);
}

/** Rescales every still-growing planting's remaining time to a new grow-speed multiplier,
 *  preserving whatever fraction of work was already done — so upgrading (or unequipping) a
 *  growSpeed source retroactively speeds up (or slows down) crops already in the ground instead
 *  of only affecting things planted afterward. Called after anything that can change
 *  growSpeedMultiplier: gear purchases and pet equip/unequip/auto-equip-on-hatch. */
function rebaseGrowTimers(room: RoomState, player: PlayerState, oldMultiplier: number, newMultiplier: number) {
  if (oldMultiplier === newMultiplier || oldMultiplier <= 0) return;
  const now = Date.now();
  const scale = newMultiplier / oldMultiplier;
  for (const planting of player.plantings) {
    if (now >= planting.readyAt) continue;
    const totalOldWork = effectiveWorkBetween(room.createdAt, planting.plantedAt, planting.readyAt);
    if (totalOldWork <= 0) continue;
    const doneWork = effectiveWorkBetween(room.createdAt, planting.plantedAt, now);
    const progress = Math.min(1, doneWork / totalOldWork);
    const remainingWork = totalOldWork * scale * (1 - progress);
    planting.readyAt = computeReadyAt(room.createdAt, now, remainingWork);
  }
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

/** Kitsune only — no gear source, pets only. Applies to crops that pay out in diamonds directly
 *  (Sun Blossom, Phoenix Sunflower) rather than the normal coin sellMultiplier path. */
function diamondSellMultiplier(player: PlayerState): number {
  let bonus = 0;
  for (const { pet, size } of activePets(player)) {
    if (pet && pet.effect.type === "diamondSellBonus") bonus += pet.effect.value * PET_SIZE_MULTIPLIER[size];
  }
  return 1 + bonus;
}

/** Only Bunny/Owl (and their evolutions) carry this effect — no gear source, pets only. */
function incubatorSpeedMultiplier(player: PlayerState): number {
  let reduction = 0;
  for (const { pet, size } of activePets(player)) {
    if (pet && pet.effect.type === "incubatorSpeed") reduction += pet.effect.value * PET_SIZE_MULTIPLIER[size];
  }
  return Math.max(INCUBATOR_SPEED_FLOOR, 1 - reduction);
}

/** Same idea as rebaseGrowTimers but simpler — incubator merges run on a plain wall-clock
 *  duration (no day/night work curve), so rescaling the remaining time is a straight linear
 *  scale rather than needing effectiveWorkBetween/computeReadyAt. */
function rebaseIncubatorTimers(player: PlayerState, oldMultiplier: number, newMultiplier: number) {
  if (oldMultiplier === newMultiplier || oldMultiplier <= 0) return;
  const now = Date.now();
  const scale = newMultiplier / oldMultiplier;
  for (const incubator of player.incubators) {
    if (!incubator.merge || now >= incubator.merge.readyAt) continue;
    const remaining = incubator.merge.readyAt - now;
    incubator.merge.readyAt = now + remaining * scale;
  }
}

const DRAGON_PROC_INTERVAL_MS = 60 * 1000;

/** Every equipped Baby Dragon (any evolution stage) instantly finishes one of its owner's still-
 *  growing plantings (the one with the most time left, for the biggest payoff) on its own
 *  independent 60s cooldown — multiple equipped dragons never share a timer, so N dragons
 *  insta-grow N crops every interval. This needs to fire even when the player isn't taking any
 *  action, so it's driven by a fixed server tick (see index.ts) rather than lazily on read like
 *  everything else in this file. Returns one entry per successful proc, so the caller knows both
 *  which rooms to broadcast and which pet/planting pair to signal a fireball for. */
export interface DragonProc {
  roomCode: string;
  playerId: string;
  petId: string;
  size: PetSize;
  plantingId: string;
}

export function tickDragonInstaGrow(): DragonProc[] {
  const now = Date.now();
  const procs: DragonProc[] = [];
  for (const room of rooms.values()) {
    for (const player of room.players) {
      for (const key of player.petsEquipped) {
        const { petId, size } = parseSlotKey(key);
        if (evolutionInfo(petId).baseId !== "baby_dragon") continue;
        const nextAt = player.petProcAt[key];
        if (nextAt === undefined) {
          // First tick since this dragon was equipped — start its cooldown instead of
          // proc'ing immediately, so equip timing can't be used to grab a free insta-grow.
          player.petProcAt[key] = now + DRAGON_PROC_INTERVAL_MS;
          continue;
        }
        if (now < nextAt) continue;
        player.petProcAt[key] = now + DRAGON_PROC_INTERVAL_MS;
        const target = player.plantings.filter((p) => now < p.readyAt).sort((a, b) => b.readyAt - a.readyAt)[0];
        if (target) {
          target.readyAt = now;
          procs.push({ roomCode: room.code, playerId: player.id, petId, size, plantingId: target.id });
        }
      }
    }
  }
  return procs;
}

const FOX_PROC_INTERVAL_MS = 60 * 1000;

/** Every equipped Fox (any evolution stage) auto-harvests some of its owner's ready-to-collect
 *  plantings on its own independent 60s cooldown, the same petProcAt bookkeeping and
 *  equip-timing protection tickDragonInstaGrow uses. Harvest count scales with evolution stage —
 *  base Fox harvests 1, Empowered 2, Tenacious 3 (one extra per merge) — picking whichever
 *  plantings have been sitting ready longest. Just calls the real harvest() so
 *  mutations/persistent-regrow/quest progress all happen exactly as if the player had tapped it
 *  themselves. Returns the rooms that actually changed, so the caller knows which ones to
 *  broadcast. */
export function tickFoxAutoHarvest(): RoomState[] {
  const now = Date.now();
  const changed: RoomState[] = [];
  for (const room of rooms.values()) {
    let roomChanged = false;
    for (const player of room.players) {
      for (const key of player.petsEquipped) {
        const { petId } = parseSlotKey(key);
        const { baseId, stage } = evolutionInfo(petId);
        if (baseId !== "fox") continue;
        const nextAt = player.petProcAt[key];
        if (nextAt === undefined) {
          player.petProcAt[key] = now + FOX_PROC_INTERVAL_MS;
          continue;
        }
        if (now < nextAt) continue;
        player.petProcAt[key] = now + FOX_PROC_INTERVAL_MS;
        const harvestCount = stage + 1;
        const targets = player.plantings
          .filter((p) => now >= p.readyAt)
          .sort((a, b) => a.readyAt - b.readyAt)
          .slice(0, harvestCount);
        for (const target of targets) {
          harvest(room, player, target.id);
          roomChanged = true;
        }
      }
    }
    if (roomChanged) changed.push(room);
  }
  return changed;
}

interface PetHatchOutcome {
  petId: string;
  size: PetSize;
  count: number;
}

/** Adds `count` copies of (petId, size) to the player's stacked collection. */
function addOwnedPet(player: PlayerState, petId: string, size: PetSize, count: number) {
  const bucket = (player.petsOwned[petId] ??= {});
  bucket[size] = (bucket[size] ?? 0) + count;
}

/** Removes `count` copies of (petId, size) if the player has enough; returns false otherwise. */
/** Removes `count` copies of (petId, size). If that empties the stack entirely, also unequips
 *  it — otherwise a merged-away pet would keep contributing its bonus from a "ghost" slot with
 *  zero copies left backing it. */
function removeOwnedPet(player: PlayerState, petId: string, size: PetSize, count: number): boolean {
  const bucket = player.petsOwned[petId];
  const have = bucket?.[size] ?? 0;
  if (have < count) return false;
  const remaining = have - count;
  if (remaining > 0) {
    bucket![size] = remaining;
  } else {
    delete bucket![size];
    const idx = player.petsEquipped.indexOf(slotKey(petId, size));
    if (idx !== -1) player.petsEquipped.splice(idx, 1);
  }
  if (bucket && Object.keys(bucket).length === 0) delete player.petsOwned[petId];
  return true;
}

/** Applies one hatch to the player's stacked collection. Only the very first copy of a pet
 *  auto-equips (and only if a slot happens to be free), so newcomers don't have to learn the
 *  equip UI immediately — every hatch after that is purely stacked for future merging. */
function applyHatch(player: PlayerState, hatch: { petId: string; size: PetSize }): PetHatchOutcome {
  const before = player.petsOwned[hatch.petId]?.[hatch.size] ?? 0;
  addOwnedPet(player, hatch.petId, hatch.size, 1);
  const key = slotKey(hatch.petId, hatch.size);
  if (before === 0 && player.petsEquipped.length < player.petSlots && !player.petsEquipped.includes(key)) {
    player.petsEquipped.push(key);
  }
  return { petId: hatch.petId, size: hatch.size, count: before + 1 };
}

export function equipPet(room: RoomState, player: PlayerState, petId: string, size: PetSize): { error?: string } {
  if ((player.petsOwned[petId]?.[size] ?? 0) <= 0) return { error: "You don't own that pet." };
  const key = slotKey(petId, size);
  if (player.petsEquipped.includes(key)) return { error: "Already equipped." };
  if (player.petsEquipped.length >= player.petSlots) return { error: "No free pet slots — unequip one first." };
  const oldGrowMult = growSpeedMultiplier(player);
  const oldIncubatorMult = incubatorSpeedMultiplier(player);
  player.petsEquipped.push(key);
  rebaseGrowTimers(room, player, oldGrowMult, growSpeedMultiplier(player));
  rebaseIncubatorTimers(player, oldIncubatorMult, incubatorSpeedMultiplier(player));
  return {};
}

export function unequipPet(room: RoomState, player: PlayerState, petId: string, size: PetSize): { error?: string } {
  const key = slotKey(petId, size);
  const idx = player.petsEquipped.indexOf(key);
  if (idx === -1) return { error: "That pet isn't equipped." };
  const oldGrowMult = growSpeedMultiplier(player);
  const oldIncubatorMult = incubatorSpeedMultiplier(player);
  player.petsEquipped.splice(idx, 1);
  // Otherwise a stale (already-elapsed) cooldown would let a re-equipped Dragon/Fox proc
  // immediately instead of waiting out a fresh 60s — see tickDragonInstaGrow/tickFoxAutoHarvest.
  delete player.petProcAt[key];
  rebaseGrowTimers(room, player, oldGrowMult, growSpeedMultiplier(player));
  rebaseIncubatorTimers(player, oldIncubatorMult, incubatorSpeedMultiplier(player));
  return {};
}

export function buyPetEgg(
  room: RoomState,
  player: PlayerState,
  eggId: string,
): { error?: string } & Partial<PetHatchOutcome> {
  const egg = PET_EGGS_BY_ID[eggId];
  if (!egg) return { error: "Unknown egg." };
  if (player.coins < egg.cost.coins) return { error: "Not enough coins." };
  if (player.diamonds < egg.cost.diamonds) return { error: "Not enough diamonds." };
  const hatch = rollPetEgg(eggId);
  if (!hatch) return { error: "Unknown egg." };
  player.coins -= egg.cost.coins;
  player.diamonds -= egg.cost.diamonds;
  const oldGrowMult = growSpeedMultiplier(player);
  const oldIncubatorMult = incubatorSpeedMultiplier(player);
  const outcome = applyHatch(player, hatch);
  rebaseGrowTimers(room, player, oldGrowMult, growSpeedMultiplier(player));
  rebaseIncubatorTimers(player, oldIncubatorMult, incubatorSpeedMultiplier(player));
  return outcome;
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
  room: RoomState,
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
  const oldGrowMult = growSpeedMultiplier(player);
  const oldIncubatorMult = incubatorSpeedMultiplier(player);
  const results = Array.from({ length: BULK_EGG_COUNT }, () => applyHatch(player, rollPetEgg(eggId)!));
  rebaseGrowTimers(room, player, oldGrowMult, growSpeedMultiplier(player));
  rebaseIncubatorTimers(player, oldIncubatorMult, incubatorSpeedMultiplier(player));
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

const INCUBATOR_SIZE = 3;
const KITSUNE_SHRINE_SIZE = 3;
const EMPOWER_DURATION_MS = 10 * 60 * 1000;
const TENACIOUS_DURATION_MS = 60 * 60 * 1000;

function canPlaceAt(player: PlayerState, x: number, y: number, w: number, h: number, ignoreId?: string): boolean {
  if (x < 0 || y < 0 || x + w > player.gridWidth || y + h > player.gridHeight) return false;
  for (const p of player.plantings) {
    if (p.id === ignoreId) continue;
    if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) return false;
  }
  for (const inc of player.incubators) {
    if (inc.id === ignoreId) continue;
    if (x < inc.x + INCUBATOR_SIZE && x + w > inc.x && y < inc.y + INCUBATOR_SIZE && y + h > inc.y) return false;
  }
  for (const shrine of player.kitsuneShrines) {
    if (shrine.id === ignoreId) continue;
    if (x < shrine.x + KITSUNE_SHRINE_SIZE && x + w > shrine.x && y < shrine.y + KITSUNE_SHRINE_SIZE && y + h > shrine.y) return false;
  }
  return true;
}

export function placeIncubator(player: PlayerState, x: number, y: number): { error?: string } {
  const owned = player.gearOwned["kelka_incubator"] ?? 0;
  if (owned <= 0) return { error: "You need the Kelka Egg Incubator from the Gear Shop first." };
  if (player.incubators.length >= owned) return { error: "You've placed all your incubators — buy another from the Gear Shop." };
  if (!canPlaceAt(player, x, y, INCUBATOR_SIZE, INCUBATOR_SIZE)) return { error: "Won't fit there." };
  player.incubators.push({ id: nanoid(8), x, y, merge: null });
  return {};
}

export function startPetMerge(
  player: PlayerState,
  incubatorId: string,
  petId: string,
  size: PetSize,
): { error?: string } {
  const incubator = player.incubators.find((i) => i.id === incubatorId);
  if (!incubator) return { error: "Incubator not found." };
  if (incubator.merge) return { error: "This incubator is already merging." };
  const targetId = nextEvolutionId(petId);
  if (!targetId) return { error: "Already at max evolution." };
  if (!removeOwnedPet(player, petId, size, MERGE_COUNT)) return { error: `Need ${MERGE_COUNT} identical pets (same pet, same size) to merge.` };
  const targetStage = evolutionInfo(targetId).stage;
  const baseDurationMs = targetStage >= MAX_EVOLUTION_STAGE ? TENACIOUS_DURATION_MS : EMPOWER_DURATION_MS;
  const durationMs = baseDurationMs * incubatorSpeedMultiplier(player);
  const now = Date.now();
  incubator.merge = { petId, size, startedAt: now, readyAt: now + durationMs };
  return {};
}

export function collectPetMerge(player: PlayerState, incubatorId: string): { error?: string; petId?: string; size?: PetSize } {
  const incubator = player.incubators.find((i) => i.id === incubatorId);
  if (!incubator) return { error: "Incubator not found." };
  if (!incubator.merge) return { error: "Nothing merging in this incubator." };
  if (Date.now() < incubator.merge.readyAt) return { error: "Not ready yet." };
  const resultId = nextEvolutionId(incubator.merge.petId)!;
  const size = incubator.merge.size;
  addOwnedPet(player, resultId, size, 1);
  incubator.merge = null;
  return { petId: resultId, size };
}

const FOX_EGG_COST_DIAMONDS = 10;

/** The New Fox Egg is a deterministic Pet Shop purchase, not a gacha roll — it only ever exists
 *  to be fed into a Kelka Kitsune Shrine (see startKitsuneCraft), so it's tracked as a plain
 *  counter rather than going through the usual petsOwned/hatch machinery. */
export function buyFoxEgg(player: PlayerState): { error?: string } {
  if (player.diamonds < FOX_EGG_COST_DIAMONDS) return { error: "Not enough diamonds." };
  player.diamonds -= FOX_EGG_COST_DIAMONDS;
  player.foxEggsOwned += 1;
  return {};
}

export function placeKitsuneShrine(player: PlayerState, x: number, y: number): { error?: string } {
  const owned = player.gearOwned["kelka_kitsune_shrine"] ?? 0;
  if (owned <= 0) return { error: "You need the Kelka Kitsune Shrine from the Gear Shop first." };
  if (player.kitsuneShrines.length >= owned) return { error: "You've already placed your Kitsune Shrine." };
  if (!canPlaceAt(player, x, y, KITSUNE_SHRINE_SIZE, KITSUNE_SHRINE_SIZE)) return { error: "Won't fit there." };
  player.kitsuneShrines.push({ id: nanoid(8), x, y, craft: null });
  return {};
}

/** Removes one Giant-size copy of the given crop from inventory if present; returns whether it
 *  found one (and thus whether anything changed). */
function consumeGiantCrop(player: PlayerState, cropId: string): boolean {
  const idx = player.cropInventory.findIndex((c) => c.cropId === cropId && c.sizeLabel === "Giant");
  if (idx === -1) return false;
  player.cropInventory.splice(idx, 1);
  return true;
}

const KITSUNE_RESULT_BY_RECIPE: Record<KitsuneRecipe, string> = {
  moon: "kitsune_moon",
  sun: "kitsune_sun",
  both: "kitsune_fused",
};

/** Fuses a New Fox Egg with a Giant Moon Blossom ("moon"), a Giant Sun Blossom ("sun"), or both
 *  ("both") into the Historic-tier Kitsune — the only way to obtain it, since it's not in any
 *  egg's hatch pool. Mirrors startPetMerge's timing: the "both" recipe (rarest result) takes the
 *  full Tenacious duration, the single-blossom recipes take the shorter Empowered duration, both
 *  sped up by the same incubator-speed pets as a normal merge. */
export function startKitsuneCraft(player: PlayerState, shrineId: string, recipe: KitsuneRecipe): { error?: string } {
  const shrine = player.kitsuneShrines.find((s) => s.id === shrineId);
  if (!shrine) return { error: "Kitsune Shrine not found." };
  if (shrine.craft) return { error: "This shrine is already crafting." };
  if (player.foxEggsOwned < 1) return { error: "You need a New Fox Egg from the Pet Shop first." };
  const needsMoon = recipe === "moon" || recipe === "both";
  const needsSun = recipe === "sun" || recipe === "both";
  if (needsMoon && !player.cropInventory.some((c) => c.cropId === "moon_blossom" && c.sizeLabel === "Giant")) {
    return { error: "You need a Giant Moon Blossom in your inventory." };
  }
  if (needsSun && !player.cropInventory.some((c) => c.cropId === "sun_blossom" && c.sizeLabel === "Giant")) {
    return { error: "You need a Giant Sun Blossom in your inventory." };
  }
  player.foxEggsOwned -= 1;
  if (needsMoon) consumeGiantCrop(player, "moon_blossom");
  if (needsSun) consumeGiantCrop(player, "sun_blossom");
  const baseDurationMs = recipe === "both" ? TENACIOUS_DURATION_MS : EMPOWER_DURATION_MS;
  const durationMs = baseDurationMs * incubatorSpeedMultiplier(player);
  const now = Date.now();
  shrine.craft = { recipe, startedAt: now, readyAt: now + durationMs };
  return {};
}

export function collectKitsuneCraft(player: PlayerState, shrineId: string): { error?: string; petId?: string; size?: PetSize } {
  const shrine = player.kitsuneShrines.find((s) => s.id === shrineId);
  if (!shrine) return { error: "Kitsune Shrine not found." };
  if (!shrine.craft) return { error: "Nothing crafting in this shrine." };
  if (Date.now() < shrine.craft.readyAt) return { error: "Not ready yet." };
  const resultId = KITSUNE_RESULT_BY_RECIPE[shrine.craft.recipe];
  addOwnedPet(player, resultId, "normal", 1);
  shrine.craft = null;
  return { petId: resultId, size: "normal" };
}

export function moveKitsuneShrine(player: PlayerState, shrineId: string, x: number, y: number): { error?: string } {
  const owned = player.gearOwned["trowel"] ?? 0;
  if (owned <= 0) return { error: "You need the Trowel from the Gear Shop first." };
  const shrine = player.kitsuneShrines.find((s) => s.id === shrineId);
  if (!shrine) return { error: "Kitsune Shrine not found." };
  if (!canPlaceAt(player, x, y, KITSUNE_SHRINE_SIZE, KITSUNE_SHRINE_SIZE, shrine.id)) return { error: "Won't fit there." };
  shrine.x = x;
  shrine.y = y;
  return {};
}

export function reclaimKitsuneShrine(player: PlayerState, shrineId: string): { error?: string } {
  const owned = player.gearOwned["reclaimer"] ?? 0;
  if (owned <= 0) return { error: "You need the Reclaimer tool from the Gear Shop first." };
  const idx = player.kitsuneShrines.findIndex((s) => s.id === shrineId);
  if (idx === -1) return { error: "Kitsune Shrine not found." };
  if (player.kitsuneShrines[idx].craft) return { error: "Finish or collect the craft in progress first." };
  player.kitsuneShrines.splice(idx, 1);
  return {};
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

/** Basic Seed Shop crops (as opposed to Moon/Solar shop crops) are exempt from the
 *  persistent-regrow slowdown below — new players kept getting hit with it just from reclaiming
 *  and replanting normally, which read as an unadvertised, unfairly harsh growth penalty. Moon
 *  and Solar crops keep the exact same penalty as before. */
function isBasicShopCrop(cropId: string): boolean {
  return !!CROPS_BY_ID[cropId];
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
  // tree and replanting the recovered seed would re-roll the fast first grow indefinitely. Basic
  // Seed Shop crops are exempt (see isBasicShopCrop) — always the advertised speed, reclaimed or not.
  const alreadyUnlocked = !!crop.persistent && !!player.persistentUnlocked[cropId] && !isBasicShopCrop(cropId);
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
    blossomColor: cropId === "moon_blossom" ? rollBlossomColor() : undefined,
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
    // grow time, since otherwise a one-time seed cost prints money forever. Basic Seed Shop
    // crops are exempt (see isBasicShopCrop) — they always regrow at the advertised speed.
    player.persistentUnlocked[planting.cropId] = true;
    const now = Date.now();
    const tier = rollSizeTier();
    const regrowMult = isBasicShopCrop(planting.cropId) ? 1 : PERSISTENT_REGROW_MULTIPLIER;
    const requiredMs = crop.growSeconds * 1000 * growSpeedMultiplier(player) * regrowMult;
    planting.plantedAt = now;
    planting.readyAt = computeReadyAt(room.createdAt, now, requiredMs);
    planting.sizeLabel = tier.label;
    planting.sizePriceMultiplier = tier.priceMultiplier;
    planting.sizeVisualScale = tier.visualScale;
    planting.mutations = rollMutations(room.createdAt, now, hasUnicornEquipped(player));
    if (planting.cropId === "moon_blossom") planting.blossomColor = rollBlossomColor();
  } else {
    player.plantings.splice(idx, 1);
  }
  return {};
}

const HARVEST_ALL_COST_COINS = 1000;
/** Kelka Crystals instead of diamonds — diamonds are earnable fast enough (selling Solar crops)
 *  that Grow All was trivially spammable; Kelka Crystals only come from daily quests (1 each, 3
 *  dailies/day), which directly caps how often the whole plot can be insta-grown. */
const GROW_ALL_COST_KELKA_CRYSTALS = 3;

/** Pays a flat coin fee to harvest every currently-ready planting at once — reuses harvest()
 *  per planting so persistent crops replant themselves exactly as they would from a manual tap.
 *  The ready-planting IDs are snapshotted up front so splicing consumable crops out of
 *  player.plantings mid-loop can't skip or double-process anything. */
export function harvestAll(room: RoomState, player: PlayerState): { error?: string; count?: number } {
  const readyIds = player.plantings.filter((p) => Date.now() >= p.readyAt).map((p) => p.id);
  if (readyIds.length === 0) return { error: "Nothing ready to harvest." };
  if (player.coins < HARVEST_ALL_COST_COINS) return { error: "Not enough coins." };
  player.coins -= HARVEST_ALL_COST_COINS;
  for (const id of readyIds) harvest(room, player, id);
  return { count: readyIds.length };
}

/** Pays a flat Kelka Crystal fee to instantly finish growing every currently-growing planting at
 *  once — the same effect Baby Dragon's insta-grow has on a single crop (readyAt = now), just
 *  applied to everything. Doesn't harvest them — still needs a tap (or Harvest All) afterward
 *  like any other readied crop. */
export function growAll(player: PlayerState): { error?: string; count?: number } {
  const now = Date.now();
  const growing = player.plantings.filter((p) => now < p.readyAt);
  if (growing.length === 0) return { error: "Nothing growing right now." };
  if (player.kelkaCrystals < GROW_ALL_COST_KELKA_CRYSTALS) return { error: "Not enough Kelka Crystals." };
  player.kelkaCrystals -= GROW_ALL_COST_KELKA_CRYSTALS;
  for (const p of growing) p.readyAt = now;
  return { count: growing.length };
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

/** Picks up a placed incubator, freeing its 3x3 footprint. Doesn't touch gearOwned["kelka_incubator"]
 *  (the count you've bought) — only how many are currently placed — so it can immediately be
 *  placed again elsewhere via placeIncubator, same relationship movePlanting/reclaim have with a
 *  planting's seed. Blocked mid-merge so the 4 pets already spent on it can't be stranded. */
export function reclaimIncubator(player: PlayerState, incubatorId: string): { error?: string } {
  const owned = player.gearOwned["reclaimer"] ?? 0;
  if (owned <= 0) return { error: "You need the Reclaimer tool from the Gear Shop first." };
  const idx = player.incubators.findIndex((i) => i.id === incubatorId);
  if (idx === -1) return { error: "Incubator not found." };
  if (player.incubators[idx].merge) return { error: "Finish or collect the merge in progress first." };
  player.incubators.splice(idx, 1);
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

export function moveIncubator(player: PlayerState, incubatorId: string, x: number, y: number): { error?: string } {
  const owned = player.gearOwned["trowel"] ?? 0;
  if (owned <= 0) return { error: "You need the Trowel from the Gear Shop first." };
  const incubator = player.incubators.find((i) => i.id === incubatorId);
  if (!incubator) return { error: "Incubator not found." };
  if (!canPlaceAt(player, x, y, INCUBATOR_SIZE, INCUBATOR_SIZE, incubator.id)) return { error: "Won't fit there." };
  incubator.x = x;
  incubator.y = y;
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
  const diamondMult = diamondSellMultiplier(player);
  const diamondReward = (crop as { diamondReward?: number }).diamondReward;
  let earned = 0;
  let diamonds = 0;
  for (const item of toSell) {
    if (diamondReward) {
      diamonds += Math.round(diamondReward * diamondMult);
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
  const diamondMult = diamondSellMultiplier(player);
  let earned = 0;
  let diamonds = 0;
  for (const item of player.cropInventory) {
    const crop = getCropDef(item.cropId);
    if (!crop) continue;
    const diamondReward = (crop as { diamondReward?: number }).diamondReward;
    if (diamondReward) {
      diamonds += Math.round(diamondReward * diamondMult);
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

export function buyGear(room: RoomState, player: PlayerState, gearId: string): { error?: string } {
  const gear = GEAR_BY_ID[gearId];
  if (!gear) return { error: "Unknown gear." };
  const owned = player.gearOwned[gearId] ?? 0;
  if (!gear.repeatable && owned > 0) return { error: "You already own that." };
  if (gear.maxOwned && owned >= gear.maxOwned) return { error: "Maxed out." };
  const price = nextGearPrice(gear, owned);
  if (player.coins < price.coins) return { error: "Not enough coins." };
  if (player.diamonds < price.diamonds) return { error: "Not enough diamonds." };
  const oldGrowMult = growSpeedMultiplier(player);
  player.coins -= price.coins;
  player.diamonds -= price.diamonds;
  player.gearOwned[gearId] = owned + 1;
  if (gear.effect.type === "expandGarden") {
    player.gridHeight = Math.min(BASE_GRID_HEIGHT + GRID_EXPANSION_MAX, player.gridHeight + gear.effect.value);
  }
  if (gear.effect.type === "growSpeed") rebaseGrowTimers(room, player, oldGrowMult, growSpeedMultiplier(player));
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
    kelkaCrystals: player.kelkaCrystals,
    persistentUnlocked: player.persistentUnlocked,
    petsOwned: player.petsOwned,
    petSlots: player.petSlots,
    petsEquipped: player.petsEquipped,
    incubators: player.incubators,
    petProcAt: player.petProcAt,
    foxEggsOwned: player.foxEggsOwned,
    kitsuneShrines: player.kitsuneShrines,
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
