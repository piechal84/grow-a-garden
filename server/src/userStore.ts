import { Redis } from "@upstash/redis";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { STARTING_COINS } from "./gameData.js";
import type { Quest } from "./quests.js";
import type { HarvestedCrop, Planting } from "./types.js";
import { BASE_GRID_HEIGHT, PLOT_GRID_WIDTH } from "./world.js";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export interface SavedProgress {
  coins: number;
  lifetimeCoins: number;
  gridWidth: number;
  gridHeight: number;
  plantings: Planting[];
  seedInventory: Record<string, number>;
  cropInventory: HarvestedCrop[];
  gearOwned: Record<string, number>;
  dailyQuests: Quest[];
  weeklyQuests: Quest[];
  dailyQuestBucket: number;
  weeklyQuestBucket: number;
  dailyRerollCount: number;
  weeklyRerollCount: number;
  seedStock: Record<string, number>;
  seedStockBucket: number;
  diamonds: number;
}

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: number;
  progress: SavedProgress;
}

function defaultProgress(): SavedProgress {
  return {
    coins: STARTING_COINS,
    lifetimeCoins: STARTING_COINS,
    gridWidth: PLOT_GRID_WIDTH,
    gridHeight: BASE_GRID_HEIGHT,
    plantings: [],
    seedInventory: {},
    cropInventory: [],
    gearOwned: {},
    dailyQuests: [],
    weeklyQuests: [],
    dailyQuestBucket: -1,
    weeklyQuestBucket: -1,
    dailyRerollCount: 0,
    weeklyRerollCount: 0,
    seedStock: {},
    seedStockBucket: -1,
    diamonds: 0,
  };
}

// When UPSTASH_REDIS_REST_URL/TOKEN are set (e.g. on a Render deploy), accounts persist in
// Redis so they survive redeploys and restarts. Without them (local dev), falls back to the
// local JSON file. Either way, reads/writes stay synchronous against this in-memory cache —
// Redis is only touched at boot (load) and fire-and-forget on every write (persist).
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null;

const usersByName = new Map<string, UserRecord>();
const usersById = new Map<string, UserRecord>();

function ingest(list: UserRecord[]) {
  for (const u of list) {
    usersByName.set(u.username.toLowerCase(), u);
    usersById.set(u.id, u);
  }
}

export async function initUserStore(): Promise<void> {
  if (redis) {
    try {
      const list = (await redis.get<UserRecord[]>("users")) ?? [];
      ingest(list);
      console.log(`Loaded ${list.length} account(s) from Redis.`);
    } catch (err) {
      console.error("Failed to load accounts from Redis — starting empty:", err);
    }
    return;
  }
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(USERS_FILE)) return;
  try {
    const list: UserRecord[] = JSON.parse(readFileSync(USERS_FILE, "utf-8"));
    ingest(list);
  } catch {
    // Corrupt or unreadable file — start fresh rather than crash the server.
  }
}

function persist() {
  const list = Array.from(usersByName.values());
  if (redis) {
    redis.set("users", list).catch((err) => console.error("Failed to save accounts to Redis:", err));
    return;
  }
  writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), "utf-8");
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

export function findUserById(id: string): UserRecord | undefined {
  return usersById.get(id);
}

export function register(username: string, password: string): { ok: boolean; error?: string; user?: UserRecord } {
  const trimmed = username.trim();
  const key = trimmed.toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 20) return { ok: false, error: "Username must be 3-20 characters." };
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { ok: false, error: "Username can only contain letters, numbers, and underscores." };
  }
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (usersByName.has(key)) return { ok: false, error: "That username is already taken." };

  const salt = randomBytes(16).toString("hex");
  const user: UserRecord = {
    id: randomUUID(),
    username: trimmed,
    passwordHash: hashPassword(password, salt),
    passwordSalt: salt,
    createdAt: Date.now(),
    progress: defaultProgress(),
  };
  usersByName.set(key, user);
  usersById.set(user.id, user);
  persist();
  return { ok: true, user };
}

export function login(username: string, password: string): { ok: boolean; error?: string; user?: UserRecord } {
  const user = usersByName.get(username.trim().toLowerCase());
  if (!user) return { ok: false, error: "No account with that username." };
  const attemptHash = Buffer.from(hashPassword(password, user.passwordSalt), "hex");
  const storedHash = Buffer.from(user.passwordHash, "hex");
  if (attemptHash.length !== storedHash.length || !timingSafeEqual(attemptHash, storedHash)) {
    return { ok: false, error: "Incorrect password." };
  }
  return { ok: true, user };
}

export function saveProgress(userId: string, progress: SavedProgress) {
  const user = usersById.get(userId);
  if (!user) return;
  user.progress = progress;
  persist();
}
