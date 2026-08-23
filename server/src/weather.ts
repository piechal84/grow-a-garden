/**
 * Day/night cycle and weather are both deterministic functions of (roomCreatedAt, now) — the
 * server and every client independently compute the identical result from the RoomState they
 * already have, with no extra sync traffic needed.
 */

export const DAY_MS = 4 * 60 * 1000;
export const NIGHT_MS = 1 * 60 * 1000;
export const CYCLE_MS = DAY_MS + NIGHT_MS;
export const DAY_SPEED = 2;
export const NIGHT_SPEED = 1;

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export function isDayAt(roomCreatedAt: number, t: number): boolean {
  return mod(t - roomCreatedAt, CYCLE_MS) < DAY_MS;
}

export function phaseInfo(roomCreatedAt: number, t: number): { isDay: boolean; msRemaining: number } {
  const pos = mod(t - roomCreatedAt, CYCLE_MS);
  if (pos < DAY_MS) return { isDay: true, msRemaining: DAY_MS - pos };
  return { isDay: false, msRemaining: CYCLE_MS - pos };
}

/** Real-world timestamp at which `requiredMs` of day(2x)/night(1x)-adjusted growth work completes. */
export function computeReadyAt(roomCreatedAt: number, from: number, requiredMs: number): number {
  let remaining = requiredMs;
  let t = from;
  let guard = 0;
  while (remaining > 1e-6 && guard < 1000) {
    guard++;
    const { isDay, msRemaining } = phaseInfo(roomCreatedAt, t);
    const speed = isDay ? DAY_SPEED : NIGHT_SPEED;
    const availableWork = msRemaining * speed;
    if (availableWork >= remaining) {
      t += remaining / speed;
      remaining = 0;
    } else {
      remaining -= availableWork;
      t += msRemaining;
    }
  }
  return t;
}

/** Effective (day/night-adjusted) growth work accumulated in real time between `from` and `to`. */
export function effectiveWorkBetween(roomCreatedAt: number, from: number, to: number): number {
  if (to <= from) return 0;
  let total = 0;
  let t = from;
  let guard = 0;
  while (t < to && guard < 1000) {
    guard++;
    const { isDay, msRemaining } = phaseInfo(roomCreatedAt, t);
    const speed = isDay ? DAY_SPEED : NIGHT_SPEED;
    const segEnd = Math.min(to, t + msRemaining);
    total += (segEnd - t) * speed;
    t = segEnd;
  }
  return total;
}

// ---------- Weather & mutations ----------

export type MutationId = "scorched" | "frozen" | "wet" | "charged" | "lunar";

export interface Mutation {
  id: MutationId;
  label: string;
  emoji: string;
  priceMultiplier: number;
  color: string;
}

export const MUTATIONS: Record<MutationId, Mutation> = {
  scorched: { id: "scorched", label: "Scorched", emoji: "🔥", priceMultiplier: 1.5, color: "#e0602a" },
  frozen: { id: "frozen", label: "Frozen", emoji: "❄️", priceMultiplier: 1.8, color: "#5fc9e0" },
  wet: { id: "wet", label: "Wet", emoji: "💧", priceMultiplier: 1.3, color: "#3f8fe0" },
  charged: { id: "charged", label: "Charged", emoji: "⚡", priceMultiplier: 2.2, color: "#f2d43a" },
  // Not weather-rolled — granted only while a crop sits next to a Moon Blossom (see rooms.ts).
  lunar: { id: "lunar", label: "Lunar", emoji: "🌙", priceMultiplier: 1.2, color: "#b18cf0" },
};

export interface WeatherCondition {
  id: string;
  label: string;
  emoji: string;
  weight: number;
  mutation: MutationId | null;
}

/**
 * Temperature and sky are independent layers — exactly one condition is active per layer, so
 * mutually-exclusive weather (Heatwave vs Freeze) can never occur together, while conditions
 * from different layers (e.g. Freeze + Thunderstorm) can stack.
 */
export const TEMPERATURE_WEATHER: WeatherCondition[] = [
  { id: "clear", label: "Clear", emoji: "🌤️", weight: 60, mutation: null },
  { id: "heatwave", label: "Heatwave", emoji: "☀️", weight: 20, mutation: "scorched" },
  { id: "freeze", label: "Freeze", emoji: "❄️", weight: 20, mutation: "frozen" },
];

export const SKY_WEATHER: WeatherCondition[] = [
  { id: "clear", label: "Clear", emoji: "🌤️", weight: 55, mutation: null },
  { id: "rain", label: "Rain", emoji: "🌧️", weight: 30, mutation: "wet" },
  { id: "thunderstorm", label: "Thunderstorm", emoji: "⛈️", weight: 15, mutation: "charged" },
];

export const WEATHER_CHANGE_MS = 90_000;

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pickWeighted<T extends { weight: number }>(items: T[], r: number): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let x = r * total;
  for (const item of items) {
    if (x < item.weight) return item;
    x -= item.weight;
  }
  return items[items.length - 1];
}

export interface ActiveWeather {
  temperature: WeatherCondition;
  sky: WeatherCondition;
}

export function getActiveWeather(roomCreatedAt: number, now: number): ActiveWeather {
  const bucket = Math.floor((now - roomCreatedAt) / WEATHER_CHANGE_MS);
  const temperature = pickWeighted(TEMPERATURE_WEATHER, seededRandom(bucket * 7919 + 13));
  const sky = pickWeighted(SKY_WEATHER, seededRandom(bucket * 104729 + 29));
  return { temperature, sky };
}

/** Order-independent key for grouping/matching items by their mutation set. */
export function mutationKey(mutations: MutationId[]): string {
  return [...mutations].sort().join(",");
}

const MUTATION_BASE_CHANCE = 0.1;

/** Rolls which mutations a freshly-planted seed catches from whatever weather is active right now. */
export function rollMutations(roomCreatedAt: number, now: number): MutationId[] {
  const { temperature, sky } = getActiveWeather(roomCreatedAt, now);
  const chance = MUTATION_BASE_CHANCE * (isDayAt(roomCreatedAt, now) ? 1 : 2);
  const mutations: MutationId[] = [];
  for (const cond of [temperature, sky]) {
    if (cond.mutation && Math.random() < chance) mutations.push(cond.mutation);
  }
  return mutations;
}
