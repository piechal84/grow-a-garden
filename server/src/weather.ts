/**
 * Day/night cycle and weather are both deterministic functions of (townCreatedAt, now) — the
 * server and every client independently compute the identical result from the TownState they
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

export function isDayAt(townCreatedAt: number, t: number): boolean {
  return mod(t - townCreatedAt, CYCLE_MS) < DAY_MS;
}

export function phaseInfo(townCreatedAt: number, t: number): { isDay: boolean; msRemaining: number } {
  const pos = mod(t - townCreatedAt, CYCLE_MS);
  if (pos < DAY_MS) return { isDay: true, msRemaining: DAY_MS - pos };
  return { isDay: false, msRemaining: CYCLE_MS - pos };
}

/** Real-world timestamp at which `requiredMs` of day(2x)/night(1x)-adjusted growth work completes. */
export function computeReadyAt(townCreatedAt: number, from: number, requiredMs: number): number {
  let remaining = requiredMs;
  let t = from;
  let guard = 0;
  while (remaining > 1e-6 && guard < 1000) {
    guard++;
    const { isDay, msRemaining } = phaseInfo(townCreatedAt, t);
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
  // Not weather-rolled — granted only while a crop sits next to a Moon Blossom (see towns.ts).
  lunar: { id: "lunar", label: "Lunar", emoji: "🌙", priceMultiplier: 1.2, color: "#b18cf0" },
  // Not a plain weather roll either — only possible while it's raining AND an equipped Unicorn
  // pet is active (see rollMutations below).
  rainbow: { id: "rainbow", label: "Rainbow", emoji: "🌈", priceMultiplier: 2.8, color: "#ff6ec7" },
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

export function getActiveWeather(townCreatedAt: number, now: number): ActiveWeather {
  const bucket = Math.floor((now - townCreatedAt) / WEATHER_CHANGE_MS);
  const temperature = pickWeighted(TEMPERATURE_WEATHER, seededRandom(bucket * 7919 + 13));
  const sky = pickWeighted(SKY_WEATHER, seededRandom(bucket * 104729 + 29));
  return { temperature, sky };
}

export type FeaturedShop = "moon" | "solar";

const SHOP_WEIGHTS: { kind: FeaturedShop; weight: number }[] = [
  { kind: "moon", weight: 80 },
  { kind: "solar", weight: 20 },
];

/** Moon and Solar shops never both feature — each full day/night cycle rolls (deterministically,
 *  from townCreatedAt+now like everything else here) which one is open next, Moon 80% of cycles. */
export function getFeaturedShop(townCreatedAt: number, now: number): FeaturedShop {
  const bucket = Math.floor((now - townCreatedAt) / CYCLE_MS);
  return pickWeighted(SHOP_WEIGHTS, seededRandom(bucket * 50021 + 7)).kind;
}

/** Order-independent key for grouping/matching items by their mutation set. */
export function mutationKey(mutations: MutationId[]): string {
  return [...mutations].sort().join(",");
}

const MUTATION_BASE_CHANCE = 0.1;
const RAINBOW_CHANCE = 0.18;

/** Rolls which mutations a freshly-planted seed catches from whatever weather is active right now.
 *  `unicornEquipped` gives rain an extra independent shot at the Unicorn-only Rainbow mutation. */
export function rollMutations(townCreatedAt: number, now: number, unicornEquipped: boolean): MutationId[] {
  const { temperature, sky } = getActiveWeather(townCreatedAt, now);
  const chance = MUTATION_BASE_CHANCE * (isDayAt(townCreatedAt, now) ? 1 : 2);
  const mutations: MutationId[] = [];
  for (const cond of [temperature, sky]) {
    if (cond.mutation && Math.random() < chance) mutations.push(cond.mutation);
  }
  if (unicornEquipped && sky.id === "rain" && Math.random() < RAINBOW_CHANCE) mutations.push("rainbow");
  return mutations;
}
