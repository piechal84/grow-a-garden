import type { BlossomColor } from "../moonData";
import { CELL_SIZE } from "../world";
import CropIcon, { type IconCrop } from "./CropIcon";

const SEED_END = 12;
const SPROUT_END = 35;
const SAPLING_END = 70;

// Icon sizes scale with the stud/cell size so bigger plots render visibly bigger crops.
const SEED_DOT_SIZE = Math.round(CELL_SIZE * 0.24);
const SPROUT_FONT_SIZE = Math.round(CELL_SIZE * 0.57);
const SAPLING_FONT_SIZE = Math.round(CELL_SIZE * 0.68);
const CROP_ICON_SIZE = Math.round(CELL_SIZE * 0.82);

/**
 * Renders a plot's plant at its current growth stage. Between SAPLING_END and 100% the
 * crop icon fades in and scales from a stub toward the plot's secretly-rolled visualScale,
 * so a lucky "Huge"/"Massive" roll visibly balloons in size as the timer finishes.
 */
export default function GrowthPlant({
  crop,
  pct,
  ready,
  targetScale,
  glowColor,
  auraTier,
  rainbow,
  blossomColor,
}: {
  crop: IconCrop;
  pct: number;
  ready: boolean;
  targetScale: number;
  glowColor?: string;
  /** Divine/Celestial moon crops get a persistent sparkle aura at every growth stage. */
  auraTier?: "divine" | "celestial";
  /** The Unicorn pet's rain-only mutation — swaps the flat mutation glow for a spinning
   *  multi-color ring so it's unmistakable at a glance. */
  rainbow?: boolean;
  /** Moon Blossom only — the cosmetic color rolled for this planting. */
  blossomColor?: BlossomColor;
}) {
  const auraClass = auraTier ? `plant-aura-${auraTier}` : "";

  if (pct < SEED_END) {
    return (
      <div className="plant-visual-wrap">
        <div
          key="seed"
          className={`plant-seed plant-stage-enter ${auraClass}`}
          style={{ width: SEED_DOT_SIZE, height: SEED_DOT_SIZE }}
        />
      </div>
    );
  }

  if (pct < SPROUT_END) {
    return (
      <div className="plant-visual-wrap">
        <span
          key="sprout"
          className={`plant-visual plant-sway plant-stage-enter ${auraClass}`}
          style={{ fontSize: SPROUT_FONT_SIZE }}
        >
          🌱
        </span>
      </div>
    );
  }

  if (pct < SAPLING_END) {
    return (
      <div className="plant-visual-wrap">
        <span
          key="sapling"
          className={`plant-visual plant-sway plant-stage-enter ${auraClass}`}
          style={{ fontSize: SAPLING_FONT_SIZE }}
        >
          🌿
        </span>
      </div>
    );
  }

  const growPct = Math.min(1, (pct - SAPLING_END) / (100 - SAPLING_END));
  const scale = 0.45 + (targetScale - 0.45) * growPct;

  return (
    <div className="plant-visual-wrap">
      <div
        key="crop"
        className={`plant-visual plant-sway plant-stage-enter ${ready ? "plant-ready-pulse" : ""} ${
          glowColor ? "plant-mutation-glow" : ""
        } ${rainbow ? "plant-mutation-rainbow" : ""} ${auraClass}`}
        style={{ scale: String(scale), ["--mutation-glow" as string]: glowColor }}
      >
        <CropIcon crop={crop} size={CROP_ICON_SIZE} blossomColor={blossomColor} />
      </div>
    </div>
  );
}
