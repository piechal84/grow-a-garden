import type { MoonTier } from "./moonData.js";
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
}

export interface HarvestedCrop {
  itemId: string;
  cropId: string;
  sizeLabel: string;
  sizePriceMultiplier: number;
  mutations: MutationId[];
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
  move_planting: (payload: { plantingId: string; x: number; y: number }, ack?: (res: ActionAck) => void) => void;
  sell: (
    payload: { cropId: string; sizeLabel: string; mutations: MutationId[]; quantity: number | "all" },
    ack?: (res: ActionAck) => void,
  ) => void;
  sell_all: (ack?: (res: SellAllAck) => void) => void;
  buy_gear: (payload: { gearId: string }, ack?: (res: ActionAck) => void) => void;
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

export interface AuthAck {
  ok: boolean;
  error?: string;
  userId?: string;
  username?: string;
}
