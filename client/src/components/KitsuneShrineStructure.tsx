import { useState } from "react";
import { createPortal } from "react-dom";
import { formatPetEffect, PETS_BY_ID } from "../petData";
import type { KitsuneRecipe, KitsuneShrineState, PlayerState } from "../types";
import { socket } from "../socket";
import { CELL_SIZE } from "../world";
import PetIcon from "./PetIcon";

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

interface RecipeInfo {
  recipe: KitsuneRecipe;
  resultPetId: string;
  needsMoon: boolean;
  needsSun: boolean;
  ingredientLabel: string;
}

const RECIPES: RecipeInfo[] = [
  {
    recipe: "moon",
    resultPetId: "kitsune_moon",
    needsMoon: true,
    needsSun: false,
    ingredientLabel: "New Fox Egg + Giant Moon Blossom",
  },
  {
    recipe: "sun",
    resultPetId: "kitsune_sun",
    needsMoon: false,
    needsSun: true,
    ingredientLabel: "New Fox Egg + Giant Sun Blossom",
  },
  {
    recipe: "both",
    resultPetId: "kitsune_fused",
    needsMoon: true,
    needsSun: true,
    ingredientLabel: "New Fox Egg + Giant Moon Blossom + Giant Sun Blossom",
  },
];

function hasGiant(player: PlayerState, cropId: string): boolean {
  return player.cropInventory.some((c) => c.cropId === cropId && c.sizeLabel === "Giant");
}

/** A Kelka Kitsune Shrine planted on the plot (3x3) — tap while idle to pick a recipe and start
 *  crafting the Historic-tier Kitsune, tap again once ready to collect it. Same portal-to-<body>
 *  reasoning as IncubatorStructure: the plot's zoomed/scaled container turns `position: fixed`
 *  into "fixed to that ancestor" otherwise. */
export default function KitsuneShrineStructure({
  shrine,
  player,
  isOwner,
  now,
  moveMode,
  isMoving,
  onSelectForMove,
  reclaimMode,
  onReclaim,
  zoom,
}: {
  shrine: KitsuneShrineState;
  player: PlayerState;
  isOwner: boolean;
  now: number;
  moveMode?: boolean;
  isMoving?: boolean;
  onSelectForMove?: () => void;
  reclaimMode?: boolean;
  onReclaim?: () => void;
  /** The world canvas's own CSS scale (see WorldView.tsx) — the error banner below lives inside
   *  that same scaled subtree, so it needs an inverse transform to stay readable at low zoom
   *  (the recipe picker modal itself is portaled to <body> and unaffected). */
  zoom: number;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [submittingRecipe, setSubmittingRecipe] = useState<KitsuneRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const craft = shrine.craft;
  const ready = !!craft && now >= craft.readyAt;
  const resultPet = craft ? PETS_BY_ID[RECIPES.find((r) => r.recipe === craft.recipe)!.resultPetId] : undefined;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isOwner) return;
    if (reclaimMode) {
      onReclaim?.();
      return;
    }
    if (moveMode) {
      onSelectForMove?.();
      return;
    }
    if (!craft) {
      setShowPicker(true);
      return;
    }
    if (ready) {
      socket.emit("collect_kitsune_craft", { shrineId: shrine.id }, (res) => {
        if (!res.ok) setError(res.error ?? "Could not collect.");
      });
    }
  }

  function handleCraft(recipe: KitsuneRecipe) {
    setSubmittingRecipe(recipe);
    setError(null);
    socket.emit("start_kitsune_craft", { shrineId: shrine.id, recipe }, (res) => {
      setSubmittingRecipe(null);
      if (!res.ok) setError(res.error ?? "Could not start crafting.");
      else setShowPicker(false);
    });
  }

  const hasFoxEgg = player.foxEggsOwned >= 1;
  const hasMoon = hasGiant(player, "moon_blossom");
  const hasSun = hasGiant(player, "sun_blossom");

  return (
    <div
      className={`stud stud-kitsune-shrine ${ready ? "incubator-ready" : ""} ${isMoving ? "stud-moving" : ""} ${
        isOwner && (moveMode || reclaimMode) ? "stud-tool-target" : ""
      }`}
      style={{
        left: shrine.x * CELL_SIZE,
        top: shrine.y * CELL_SIZE,
        width: 3 * CELL_SIZE,
        height: 3 * CELL_SIZE,
      }}
      onClick={handleClick}
      title={
        reclaimMode
          ? "Tap to reclaim"
          : moveMode
            ? isMoving
              ? "Selected — pick a new spot"
              : "Tap to move"
            : !craft
              ? "Tap to fuse a Kitsune"
              : ready
                ? "Tap to collect"
                : "Fusing…"
      }
    >
      <div className="kitsune-den-mound" />
      <span className="incubator-emoji">{ready && resultPet ? <PetIcon pet={resultPet} size={30} /> : "🐺"}</span>
      {craft && !ready && <span className="incubator-timer">{formatDuration(craft.readyAt - now)}</span>}
      {craft && ready && <span className="incubator-collect-label">Tap to collect!</span>}
      {!craft && <span className="incubator-collect-label">Fuse Kitsune</span>}
      {error && (
        <div
          className="plot-move-error"
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: "center top" }}
          onClick={(e) => e.stopPropagation()}
        >
          {error}
        </div>
      )}

      {showPicker &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={(e) => {
              e.stopPropagation();
              setShowPicker(false);
            }}
          >
            <div className="modal modal-shop" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowPicker(false)} aria-label="Close">
                ✕
              </button>
              <h2>🐺 Fuse a Kitsune</h2>
              <p className="shop-sub">
                Fuse a New Fox Egg (Pet Shop) with a Giant Moon Blossom, a Giant Sun Blossom, or both — a bigger
                fusion takes longer but crafts a stronger Kitsune.
              </p>
              {!hasFoxEgg && <p className="modal-empty">You don't have a New Fox Egg yet — buy one at the Pet Shop.</p>}

              <div className="shop-list">
                {RECIPES.map((r) => {
                  const resultPet = PETS_BY_ID[r.resultPetId];
                  const haveIngredients = hasFoxEgg && (!r.needsMoon || hasMoon) && (!r.needsSun || hasSun);
                  return (
                    <div key={r.recipe} className="shop-row">
                      <div className="shop-row-icon">
                        <PetIcon pet={resultPet} size={40} />
                      </div>
                      <div className="shop-row-info">
                        <div className="shop-row-name">{resultPet.name}</div>
                        <div className="shop-row-stats">
                          <span>{r.ingredientLabel}</span>
                        </div>
                        <div className="shop-row-stats">
                          <span className="pet-effect-label">{formatPetEffect(resultPet, "normal")}</span>
                        </div>
                      </div>
                      <div className="shop-row-actions">
                        <button
                          className="btn btn-primary"
                          disabled={!haveIngredients || submittingRecipe !== null}
                          onClick={() => handleCraft(r.recipe)}
                        >
                          {submittingRecipe === r.recipe ? "Fusing…" : "Craft"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
