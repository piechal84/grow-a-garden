import type { BlossomColor, MoonTier } from "./moonData.js";
import type { PetSize } from "./petData.js";
import type { Quest } from "./quests.js";
import type { SolarTier } from "./solarData.js";
import type { MutationId } from "./weather.js";
import type { Position } from "./world.js";

export interface Planting {
  id: string;
  cropId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  plantedAt: number;
  readyAt: number;
  sizeLabel: string;
  sizePriceMultiplier: number;
  sizeVisualScale: number;
  mutations: MutationId[];
  /** Moon Blossom only — purely cosmetic color rolled at plant time. */
  blossomColor?: BlossomColor;
}

export interface HarvestedCrop {
  itemId: string;
  cropId: string;
  sizeLabel: string;
  sizePriceMultiplier: number;
  mutations: MutationId[];
}

export interface IncubatorMerge {
  petId: string;
  size: PetSize;
  startedAt: number;
  readyAt: number;
}

export interface IncubatorState {
  id: string;
  x: number;
  y: number;
  merge: IncubatorMerge | null;
}

export type KitsuneRecipe = "moon" | "sun" | "both";

export interface KitsuneCraft {
  recipe: KitsuneRecipe;
  startedAt: number;
  readyAt: number;
}

export interface KitsuneShrineState {
  id: string;
  x: number;
  y: number;
  craft: KitsuneCraft | null;
}

export interface PlayerState {
  id: string;
  name: string;
  connected: boolean;
  coins: number;
  lifetimeCoins: number;
  slotIndex: number;
  gridWidth: number;
  gridHeight: number;
  plantings: Planting[];
  seedInventory: Record<string, number>;
  cropInventory: HarvestedCrop[];
  gearOwned: Record<string, number>;
  /** Set when this player is a logged-in account (vs an anonymous guest) — their progress persists. */
  accountUsername?: string;
  dailyQuests: Quest[];
  weeklyQuests: Quest[];
  dailyQuestBucket: number;
  weeklyQuestBucket: number;
  dailyRerollCount: number;
  weeklyRerollCount: number;
  /** Units currently purchasable per crop — refilled/rolled every 2-minute real-world bucket. */
  seedStock: Record<string, number>;
  seedStockBucket: number;
  /** Premium currency — bought with coins or earned from events, spent on Solar Seed Packs. */
  diamonds: number;
  /** Crop IDs whose persistent (regrowing) form this player has produced at least once — once
   *  set, every future planting of that crop grows at the slow persistent-regrow rate from the
   *  start, so reclaiming and replanting can't be used to keep re-rolling the fast first grow. */
  persistentUnlocked: Record<string, boolean>;
  /** Pets hatched/merged, keyed by pet ID -> size -> how many copies owned. Duplicates stack —
   *  4 identical (pet, size) copies can be merged into the next evolution via an Incubator. */
  petsOwned: Record<string, Partial<Record<PetSize, number>>>;
  petSlots: number;
  /** "{petId}#{size}" slot keys actively contributing their bonus, manually chosen
   *  (equip_pet/unequip_pet), capped at petSlots. New hatches auto-equip only if a slot is free. */
  petsEquipped: string[];
  /** Kelka Egg Incubators planted on this player's plot (up to gearOwned.kelka_incubator, max 2). */
  incubators: IncubatorState[];
  /** New Fox Eggs bought from the Pet Shop for diamonds — not a gacha roll, just a deterministic
   *  crafting ingredient consumed by a Kelka Kitsune Shrine (see startKitsuneCraft). */
  foxEggsOwned: number;
  /** Kelka Kitsune Shrines planted on this player's plot (max 1, gated by gearOwned.kelka_kitsune_shrine). */
  kitsuneShrines: KitsuneShrineState[];
  /** Next timestamp (ms) each equipped pet with its own independent-cooldown ability (keyed by
   *  its slotKey) can proc again — Baby Dragon's insta-grow, Fox's auto-harvest. Every equipped
   *  instance procs on its own independent 60s cooldown, never shared. See tickDragonInstaGrow /
   *  tickFoxAutoHarvest in rooms.ts. */
  petProcAt: Record<string, number>;
}

export interface RoomState {
  code: string;
  hostId: string;
  players: PlayerState[];
  createdAt: number;
}

export interface ClientToServerEvents {
  join_room: (
    payload: { roomCode?: string; playerName: string; clientId: string },
    ack: (res: JoinAck) => void,
  ) => void;
  buy_seed: (payload: { cropId: string; quantity: number }, ack?: (res: ActionAck) => void) => void;
  plant: (payload: { x: number; y: number; cropId: string }, ack?: (res: ActionAck) => void) => void;
  harvest: (payload: { plantingId: string }, ack?: (res: ActionAck) => void) => void;
  reclaim_planting: (payload: { plantingId: string }, ack?: (res: ActionAck) => void) => void;
  reclaim_incubator: (payload: { incubatorId: string }, ack?: (res: ActionAck) => void) => void;
  move_planting: (payload: { plantingId: string; x: number; y: number }, ack?: (res: ActionAck) => void) => void;
  move_incubator: (payload: { incubatorId: string; x: number; y: number }, ack?: (res: ActionAck) => void) => void;
  sell: (
    payload: { cropId: string; sizeLabel: string; mutations: MutationId[]; quantity: number | "all" },
    ack?: (res: ActionAck) => void,
  ) => void;
  sell_all: (ack?: (res: SellAllAck) => void) => void;
  buy_gear: (payload: { gearId: string }, ack?: (res: ActionAck) => void) => void;
  buy_pet_egg: (payload: { eggId: string }, ack?: (res: PetEggAck) => void) => void;
  buy_pet_egg_bulk: (payload: { eggId: string }, ack?: (res: PetEggBulkAck) => void) => void;
  buy_pet_slot: (ack?: (res: ActionAck) => void) => void;
  equip_pet: (payload: { petId: string; size: PetSize }, ack?: (res: ActionAck) => void) => void;
  unequip_pet: (payload: { petId: string; size: PetSize }, ack?: (res: ActionAck) => void) => void;
  place_incubator: (payload: { x: number; y: number }, ack?: (res: ActionAck) => void) => void;
  start_pet_merge: (payload: { incubatorId: string; petId: string; size: PetSize }, ack?: (res: ActionAck) => void) => void;
  collect_pet_merge: (payload: { incubatorId: string }, ack?: (res: PetEggAck) => void) => void;
  buy_fox_egg: (ack?: (res: ActionAck) => void) => void;
  place_kitsune_shrine: (payload: { x: number; y: number }, ack?: (res: ActionAck) => void) => void;
  move_kitsune_shrine: (payload: { shrineId: string; x: number; y: number }, ack?: (res: ActionAck) => void) => void;
  reclaim_kitsune_shrine: (payload: { shrineId: string }, ack?: (res: ActionAck) => void) => void;
  start_kitsune_craft: (payload: { shrineId: string; recipe: KitsuneRecipe }, ack?: (res: ActionAck) => void) => void;
  collect_kitsune_craft: (payload: { shrineId: string }, ack?: (res: PetEggAck) => void) => void;
  buy_moon_pack: (ack?: (res: MoonPackAck) => void) => void;
  buy_moon_pack_bulk: (ack?: (res: MoonPackBulkAck) => void) => void;
  buy_solar_pack: (ack?: (res: SolarPackAck) => void) => void;
  buy_solar_pack_bulk: (ack?: (res: SolarPackBulkAck) => void) => void;
  buy_diamonds: (payload: { quantity: number }, ack?: (res: ActionAck) => void) => void;
  sell_diamonds: (payload: { quantity: number }, ack?: (res: ActionAck) => void) => void;
  move: (payload: { x: number; y: number }) => void;
  register: (payload: { username: string; password: string }, ack: (res: AuthAck) => void) => void;
  login: (payload: { username: string; password: string }, ack: (res: AuthAck) => void) => void;
  reroll_quest: (
    payload: { questSet: "daily" | "weekly"; questId: string },
    ack?: (res: ActionAck) => void,
  ) => void;
}

export interface ServerToClientEvents {
  state_update: (state: RoomState) => void;
  error_message: (message: string) => void;
  player_spawned: (payload: { playerId: string; x: number; y: number }) => void;
  player_moved: (payload: {
    playerId: string;
    from: Position;
    to: Position;
    startedAt: number;
    duration: number;
  }) => void;
  /** A Baby Dragon's insta-grow ability just fired — lets the client draw a one-shot fireball
   *  from the dragon to the planting it matured, purely cosmetic (the state_update already
   *  carries the real result). */
  dragon_insta_grow: (payload: { playerId: string; petId: string; size: PetSize; plantingId: string }) => void;
}

export interface JoinAck {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
  positions?: Record<string, Position>;
}

export interface ActionAck {
  ok: boolean;
  error?: string;
}

export interface SellAllAck extends ActionAck {
  earned?: number;
  diamonds?: number;
  count?: number;
}

export interface MoonPackResult {
  kind: MoonTier;
  cropId: string;
}

export interface MoonPackAck extends ActionAck {
  result?: MoonPackResult;
}

export interface MoonPackBulkAck extends ActionAck {
  results?: MoonPackResult[];
  cost?: number;
}

export interface SolarPackResult {
  kind: SolarTier;
  cropId: string;
}

export interface SolarPackAck extends ActionAck {
  result?: SolarPackResult;
}

export interface SolarPackBulkAck extends ActionAck {
  results?: SolarPackResult[];
  cost?: number;
}

export interface PetEggAck extends ActionAck {
  petId?: string;
  size?: PetSize;
  count?: number;
}

export interface PetHatchOutcome {
  petId: string;
  size: PetSize;
  count: number;
}

export interface PetEggBulkAck extends ActionAck {
  results?: PetHatchOutcome[];
  cost?: { coins: number; diamonds: number };
}

export interface AuthAck {
  ok: boolean;
  error?: string;
  userId?: string;
  username?: string;
}
