/**
 * Shared world-layout geometry. Duplicated (identically) on the client so both sides agree
 * on plot placement, spawn points, and movement bounds without a shared package.
 */

export const CELL_SIZE = 56;
export const PLOT_GRID_WIDTH = 6;
export const BASE_GRID_HEIGHT = 4;
export const GRID_EXPANSION_MAX = 8;
/** Extend Roots (Yggdrasil, paid in Vegvizir Tokens) continues the same height axis Garden
 *  Expansion (gear, paid in coins) caps out at — see extendRoots in towns.ts. Deliberately NOT
 *  folded into PLOT_ROW_SPACING_Y below — reserving world-layout row space for every plot's
 *  absolute theoretical max (20 rows) bloated the map into a mostly-empty, portrait-feeling
 *  wall for the vast majority of plots that never grow that tall. A fully roots-extended plot may
 *  visually crowd the row beneath it; that's an acceptable, rare trade for a much tighter default. */
export const ROOT_EXPANSION_MAX = 8;
export const MAX_GRID_HEIGHT = BASE_GRID_HEIGHT + GRID_EXPANSION_MAX + ROOT_EXPANSION_MAX;

/** All MAX_PLAYERS_PER_TOWN (4) plots render in a single row — the town is landscape overall,
 *  not a tall stack, and there's never a partially-empty row to leave dead space below. */
export const PLOTS_PER_ROW = 4;
export const PLOT_ORIGIN_X_START = 80;
export const PLOT_SPACING_X = PLOT_GRID_WIDTH * CELL_SIZE + 84;
/** Extra headroom above the first plot row so its toolbar (which floats above the plot, see
 *  .plot-toolbar) has room to wrap into a few rows without reaching the in-world NPC shop icons
 *  pinned near the top of the map (MARKET_Y below). */
export const PLOT_ORIGIN_Y = 320;
/** Sized for Garden Expansion's cap (not Extend Roots' far larger one — see ROOT_EXPANSION_MAX). */
export const PLOT_ROW_SPACING_Y = (BASE_GRID_HEIGHT + GRID_EXPANSION_MAX) * CELL_SIZE + 80;

export const MARKET_Y = 90;
export const NPC_POSITIONS = {
  seed: { x: 140, y: MARKET_Y },
  gear: { x: 290, y: MARKET_Y },
  quests: { x: 440, y: MARKET_Y },
  merchant: { x: 590, y: MARKET_Y },
  moon: { x: 740, y: MARKET_Y },
  premium: { x: 890, y: MARKET_Y },
  pets: { x: 1040, y: MARKET_Y },
};

export const WORLD_WIDTH = PLOT_ORIGIN_X_START + PLOTS_PER_ROW * PLOT_SPACING_X + 230;
/** 1 row of PLOTS_PER_ROW covers all MAX_PLAYERS_PER_TOWN (4) seats. */
export const WORLD_HEIGHT = PLOT_ORIGIN_Y + PLOT_ROW_SPACING_Y;
export const MOVE_SPEED = 180; // px/sec

export interface Position {
  x: number;
  y: number;
}

export function plotOrigin(slotIndex: number): Position {
  const col = slotIndex % PLOTS_PER_ROW;
  const row = Math.floor(slotIndex / PLOTS_PER_ROW);
  return {
    x: PLOT_ORIGIN_X_START + col * PLOT_SPACING_X,
    y: PLOT_ORIGIN_Y + row * PLOT_ROW_SPACING_Y,
  };
}

export function spawnPositionForSlot(slotIndex: number): Position {
  const origin = plotOrigin(slotIndex);
  return { x: origin.x + (PLOT_GRID_WIDTH * CELL_SIZE) / 2, y: origin.y - 30 };
}

export function clampToWorld(pos: Position): Position {
  return {
    x: Math.max(20, Math.min(WORLD_WIDTH - 20, pos.x)),
    y: Math.max(20, Math.min(WORLD_HEIGHT - 20, pos.y)),
  };
}
