/**
 * Shared world-layout geometry. Mirrors server/src/world.ts so both sides agree on
 * plot placement, spawn points, and movement bounds without a shared package.
 */

export const CELL_SIZE = 56;
export const PLOT_GRID_WIDTH = 6;
export const BASE_GRID_HEIGHT = 4;
export const GRID_EXPANSION_MAX = 8;
export const MAX_GRID_HEIGHT = BASE_GRID_HEIGHT + GRID_EXPANSION_MAX;

/** Plots render 2-per-row (bigger, wrapping into further rows) instead of one long strip. */
export const PLOTS_PER_ROW = 2;
export const PLOT_ORIGIN_X_START = 80;
export const PLOT_SPACING_X = PLOT_GRID_WIDTH * CELL_SIZE + 84;
export const PLOT_ORIGIN_Y = 230;
export const PLOT_ROW_SPACING_Y = MAX_GRID_HEIGHT * CELL_SIZE + 80;

export const MARKET_Y = 90;
export const NPC_POSITIONS = {
  seed: { x: 140, y: MARKET_Y },
  gear: { x: 290, y: MARKET_Y },
  quests: { x: 440, y: MARKET_Y },
  merchant: { x: 590, y: MARKET_Y },
  moon: { x: 740, y: MARKET_Y },
  premium: { x: 890, y: MARKET_Y },
};

export const WORLD_WIDTH = PLOT_ORIGIN_X_START + PLOTS_PER_ROW * PLOT_SPACING_X + 80;
/** 3 rows of PLOTS_PER_ROW covers all 6 player seats. */
export const WORLD_HEIGHT = PLOT_ORIGIN_Y + 3 * PLOT_ROW_SPACING_Y;
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
