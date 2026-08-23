import type { MoonTier } from "./moonData";
import type { Quest } from "./quests";
import type { MutationId } from "./weather";
import type { Position } from "./world";

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
  seedStock: Record<string, number>;
  seedStockBucket: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  players: PlayerState[];
  createdAt: number;
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

export interface MoonPackResult {
  kind: MoonTier;
  cropId: string;
}

export interface MoonPackAck extends ActionAck {
  result?: MoonPackResult;
}

export interface SellAllAck extends ActionAck {
  earned?: number;
  count?: number;
}

export interface AuthAck {
  ok: boolean;
  error?: string;
  userId?: string;
  username?: string;
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
