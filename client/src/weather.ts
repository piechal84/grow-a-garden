/**
 * Day/night cycle and weather are both deterministic functions of (townCreatedAt, now) — the
 * server and every client independently compute the identical result from the TownState they
 * already have, with no extra sync traffic needed. Mirrors server/src/weather.ts.
 */

export const DAY_MS = 4 * 60 * 1000;
export const NIGHT_MS = 1 * 60 * 1000;
export const CYCLE_MS = DAY_MS + NIGHT_MS;
export const DAY_SPEED = 2;
export const NIGHT_SPEED = 1;

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export function isDayAt(townCreatedAt: number, t: number): boolean {
  return mod(t - townCreatedAt, CYCLE_MS) < DAY_MS;
}

export function phaseInfo(townCreatedAt: number, t: number): { isDay: boolean; msRemaining: number } {
  const pos = mod(t - townCreatedAt, CYCLE_MS);
  if (pos < DAY_MS) return { isDay: true, msRemaining: DAY_MS - pos };
  return { isDay: false, msRemaining: CYCLE_MS - pos };
}

/** Effective (day/night-adjusted) growth work accumulated in real time between `from` and `to`. */
export function effectiveWorkBetween(townCreatedAt: number, from: number, to: number): number {
  if (to <= from) return 0;
  let total = 0;
  let t = from;
  let guard = 0;
  while (t < to && guard < 1000) {
    guard++;
    const { isDay, msRemaining } = phaseInfo(townCreatedAt, t);
    const speed = isDay ? DAY_SPEED : NIGHT_SPEED;
    const segEnd = Math.min(to, t + msRemaining);
    total += (segEnd - t) * speed;
    t = segEnd;
  }
  return total;
}

// ---------- Weather & mutations ----------

export type MutationId = "scorched" | "frozen" | "wet" | "charged" | "lunar" | "rainbow";

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
  // Not weather-rolled — granted only while a crop sits next to a Moon Blossom.
  lunar: { id: "lunar", label: "Lunar", emoji: "🌙", priceMultiplier: 1.2, color: "#b18cf0" },
  // Only possible while it's raining AND an equipped Unicorn pet is active.
  rainbow: { id: "rainbow", label: "Rainbow", emoji: "🌈", priceMultiplier: 2.8, color: "#ff6ec7" },
};

export interface WeatherCondition {
  id: string;
  label: string;
  emoji: string;
  weight: number;
  mutation: MutationId | null;
}

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

export function getActiveWeather(townCreatedAt: number, now: number): ActiveWeather {
  const bucket = Math.floor((now - townCreatedAt) / WEATHER_CHANGE_MS);
  const temperature = pickWeighted(TEMPERATURE_WEATHER, seededRandom(bucket * 7919 + 13));
  const sky = pickWeighted(SKY_WEATHER, seededRandom(bucket * 104729 + 29));
  return { temperature, sky };
}

/** Temperature and sky are rolled from the same WEATHER_CHANGE_MS bucket, so they always change
 *  together — one countdown to the next roll covers both. */
export function msUntilWeatherChange(townCreatedAt: number, now: number): number {
  return WEATHER_CHANGE_MS - mod(now - townCreatedAt, WEATHER_CHANGE_MS);
}

export type FeaturedShop = "moon" | "solar";

const SHOP_WEIGHTS: { kind: FeaturedShop; weight: number }[] = [
  { kind: "moon", weight: 80 },
  { kind: "solar", weight: 20 },
];

/** Moon and Solar shops never both feature — each full day/night cycle rolls which one is open
 *  next, Moon 80% of cycles. Mirrors server/src/weather.ts exactly. */
export function getFeaturedShop(townCreatedAt: number, now: number): FeaturedShop {
  const bucket = Math.floor((now - townCreatedAt) / CYCLE_MS);
  return pickWeighted(SHOP_WEIGHTS, seededRandom(bucket * 50021 + 7)).kind;
}

/** Order-independent key for grouping/matching items by their mutation set. */
export function mutationKey(mutations: MutationId[]): string {
  return [...mutations].sort().join(",");
}
