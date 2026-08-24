import { useState } from "react";
import { SIZE_COLORS } from "../gameData";
import { getCropDef, MOON_CROPS_BY_ID } from "../moonData";
import type { PlayerState, Planting } from "../types";
import { socket } from "../socket";
import { effectiveWorkBetween, MUTATIONS, type MutationId } from "../weather";
import { CELL_SIZE, plotOrigin, type Position } from "../world";
import GrowthPlant from "./GrowthPlant";
import PlantPickerModal from "./PlantPickerModal";

/** True if two footprints share an edge (not just a corner) — mirrors the server's aura check. */
function isOrthogonallyAdjacent(a: Planting, b: Planting): boolean {
  const rowOverlap = a.y < b.y + b.h && b.y < a.y + a.h;
  const colOverlap = a.x < b.x + b.w && b.x < a.x + a.w;
  const touchesHorizontally = rowOverlap && (a.x + a.w === b.x || b.x + b.w === a.x);
  const touchesVertically = colOverlap && (a.y + a.h === b.y || b.y + b.h === a.y);
  return touchesHorizontally || touchesVertically;
}

/** Each Moon Blossom blesses exactly one neighbor — mirrors the server's pick so the preview
 *  badge matches what harvest will actually roll. */
function lunarRecipientId(allPlantings: Planting[], blossom: Planting): string | undefined {
  const adjacent = allPlantings.filter((p) => p.id !== blossom.id && isOrthogonallyAdjacent(p, blossom));
  if (adjacent.length === 0) return undefined;
  return adjacent.reduce((a, b) =>
    a.plantedAt !== b.plantedAt ? (a.plantedAt < b.plantedAt ? a : b) : a.id < b.id ? a : b,
  ).id;
}

/** Preview of the mutations this planting would harvest with right now, including the "lunar"
 *  bonus from an adjacent Moon Blossom — the real roll is finalized server-side at harvest time. */
function previewMutations(planting: Planting, allPlantings: Planting[]): MutationId[] {
  const blossoms = allPlantings.filter((p) => p.cropId === "moon_blossom" && p.id !== planting.id);
  const blessed = blossoms.some((b) => lunarRecipientId(allPlantings, b) === planting.id);
  if (!blessed || planting.mutations.includes("lunar")) return planting.mutations;
  return [...planting.mutations, "lunar"];
}

function auraTierFor(cropId: string): "divine" | "celestial" | undefined {
  const tier = MOON_CROPS_BY_ID[cropId]?.tier;
  if (tier === "mythic") return "divine";
  if (tier === "legendary") return "celestial";
  return undefined;
}

export default function PlotView({
  player,
  isOwner,
  now,
  roomCreatedAt,
  onWalkTo,
}: {
  player: PlayerState;
  isOwner: boolean;
  now: number;
  roomCreatedAt: number;
  onWalkTo: (pos: Position) => void;
}) {
  const [pickerCell, setPickerCell] = useState<{ x: number; y: number } | null>(null);
  const [activeTool, setActiveTool] = useState<"reclaim" | "move" | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const origin = plotOrigin(player.slotIndex);

  const occupied = new Set<string>();
  for (const p of player.plantings) {
    for (let cx = p.x; cx < p.x + p.w; cx++) {
      for (let cy = p.y; cy < p.y + p.h; cy++) occupied.add(`${cx},${cy}`);
    }
  }

  function cellWorldPos(x: number, y: number, w = 1, h = 1): Position {
    return {
      x: origin.x + (x + w / 2) * CELL_SIZE,
      y: origin.y + (y + h / 2) * CELL_SIZE,
    };
  }

  function handleEmptyCellClick(e: React.MouseEvent, x: number, y: number) {
    e.stopPropagation();
    if (!isOwner) return;
    if (activeTool === "move" && movingId) {
      onWalkTo(cellWorldPos(x, y));
      const id = movingId;
      socket.emit("move_planting", { plantingId: id, x, y }, (res) => {
        if (res.ok) {
          setMovingId(null);
          setMoveError(null);
        } else {
          setMoveError(res.error ?? "Won't fit there.");
        }
      });
      return;
    }
    if (activeTool) return; // reclaim mode (or move mode with nothing selected yet) has no empty-cell action
    onWalkTo(cellWorldPos(x, y));
    setPickerCell({ x, y });
  }

  function handleHarvest(plantingId: string, x: number, y: number, w: number, h: number) {
    onWalkTo(cellWorldPos(x, y, w, h));
    socket.emit("harvest", { plantingId });
  }

  function handleReclaim(plantingId: string, x: number, y: number, w: number, h: number) {
    onWalkTo(cellWorldPos(x, y, w, h));
    socket.emit("reclaim_planting", { plantingId });
    setMoveError(null);
  }

  function handleSelectForMove(plantingId: string, x: number, y: number, w: number, h: number) {
    onWalkTo(cellWorldPos(x, y, w, h));
    setMoveError(null);
    setMovingId(plantingId);
  }

  function handlePlantingClick(planting: Planting, ready: boolean) {
    if (!isOwner) return;
    if (activeTool === "reclaim") {
      handleReclaim(planting.id, planting.x, planting.y, planting.w, planting.h);
      return;
    }
    if (activeTool === "move") {
      handleSelectForMove(planting.id, planting.x, planting.y, planting.w, planting.h);
      return;
    }
    if (ready) handleHarvest(planting.id, planting.x, planting.y, planting.w, planting.h);
  }

  function toggleTool(tool: "reclaim" | "move") {
    setMoveError(null);
    setMovingId(null);
    setActiveTool((cur) => (cur === tool ? null : tool));
  }

  const hasReclaimer = (player.gearOwned["reclaimer"] ?? 0) > 0;
  const hasTrowel = (player.gearOwned["trowel"] ?? 0) > 0;

  const emptyCells: { x: number; y: number }[] = [];
  for (let y = 0; y < player.gridHeight; y++) {
    for (let x = 0; x < player.gridWidth; x++) {
      if (!occupied.has(`${x},${y}`)) emptyCells.push({ x, y });
    }
  }

  return (
    <div
      className="world-plot"
      style={{
        left: origin.x,
        top: origin.y,
        width: player.gridWidth * CELL_SIZE,
        height: player.gridHeight * CELL_SIZE,
      }}
    >
      <span className="world-plot-name">{player.name}</span>
      {isOwner && (hasReclaimer || hasTrowel) && (
        <div className="plot-toolbar" onClick={(e) => e.stopPropagation()}>
          {hasReclaimer && (
            <button
              className={`plot-tool-btn ${activeTool === "reclaim" ? "plot-tool-btn-active" : ""}`}
              onClick={() => toggleTool("reclaim")}
            >
              🧲 Reclaim
            </button>
          )}
          {hasTrowel && (
            <button
              className={`plot-tool-btn ${activeTool === "move" ? "plot-tool-btn-active" : ""}`}
              onClick={() => toggleTool("move")}
            >
              🛠️ Move
            </button>
          )}
        </div>
      )}
      {isOwner && activeTool === "reclaim" && (
        <div className="plot-move-banner" onClick={(e) => e.stopPropagation()}>
          🧲 Tap a crop to reclaim its seed
          <button className="btn btn-secondary plot-move-cancel" onClick={() => setActiveTool(null)}>
            Done
          </button>
        </div>
      )}
      {isOwner && activeTool === "move" && !movingId && (
        <div className="plot-move-banner" onClick={(e) => e.stopPropagation()}>
          🛠️ Tap a crop to move it
          <button className="btn btn-secondary plot-move-cancel" onClick={() => setActiveTool(null)}>
            Done
          </button>
        </div>
      )}
      {isOwner && activeTool === "move" && movingId && (
        <div className="plot-move-banner" onClick={(e) => e.stopPropagation()}>
          🛠️ Choose a new spot for your crop
          <button className="btn btn-secondary plot-move-cancel" onClick={() => setMovingId(null)}>
            Cancel
          </button>
        </div>
      )}
      {isOwner && moveError && (
        <div className="plot-move-error" onClick={(e) => e.stopPropagation()}>
          {moveError}
        </div>
      )}
      {emptyCells.map(({ x, y }) => (
        <button
          key={`e-${x}-${y}`}
          className={`stud stud-empty ${activeTool === "move" && movingId ? "stud-empty-target" : ""}`}
          disabled={!isOwner}
          style={{ left: x * CELL_SIZE, top: y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE }}
          onClick={(e) => handleEmptyCellClick(e, x, y)}
        />
      ))}
      {player.plantings.map((planting) => {
        const crop = getCropDef(planting.cropId);
        if (!crop) return null;
        const ready = now >= planting.readyAt;
        const totalWork = effectiveWorkBetween(roomCreatedAt, planting.plantedAt, planting.readyAt);
        const doneWork = effectiveWorkBetween(roomCreatedAt, planting.plantedAt, now);
        const pct = totalWork > 0 ? Math.min(100, Math.max(0, (doneWork / totalWork) * 100)) : 100;
        const secondsLeft = Math.max(0, Math.ceil((planting.readyAt - now) / 1000));
        const displayMutations = previewMutations(planting, player.plantings);
        const glowColor = displayMutations.length > 0 ? MUTATIONS[displayMutations[0]].color : undefined;
        const timerFontSize = Math.round(Math.min(planting.w, planting.h) * CELL_SIZE * 0.4);
        const auraTier = auraTierFor(planting.cropId);
        const isMoving = movingId === planting.id;

        const toolHint =
          activeTool === "reclaim" ? "Tap to reclaim" : activeTool === "move" ? (isMoving ? "Selected — pick a new spot" : "Tap to move") : undefined;

        return (
          <div
            key={planting.id}
            className={`stud stud-planted ${ready ? "stud-ready" : ""} ${
              ready && isOwner && !activeTool ? "stud-harvestable" : ""
            } ${isMoving ? "stud-moving" : ""} ${isOwner && activeTool ? "stud-tool-target" : ""}`}
            style={{
              left: planting.x * CELL_SIZE,
              top: planting.y * CELL_SIZE,
              width: planting.w * CELL_SIZE,
              height: planting.h * CELL_SIZE,
            }}
            title={toolHint}
            onClick={(e) => {
              e.stopPropagation();
              handlePlantingClick(planting, ready);
            }}
          >
            <GrowthPlant
              crop={crop}
              pct={pct}
              ready={ready}
              targetScale={planting.sizeVisualScale}
              glowColor={glowColor}
              auraTier={auraTier}
            />
            {crop.persistent && <span className="tree-badge" title="Regrows after harvest — never consumed">🌳</span>}
            {pct >= 70 && displayMutations.length > 0 && (
              <span
                className="mutation-badges"
                title={displayMutations
                  .map((m) => `${MUTATIONS[m].label} (+${Math.round((MUTATIONS[m].priceMultiplier - 1) * 100)}% sell price)`)
                  .join(" · ")}
              >
                {displayMutations.map((m) => (
                  <span key={m} className="mutation-badge" style={{ background: MUTATIONS[m].color }}>
                    {MUTATIONS[m].emoji}
                  </span>
                ))}
              </span>
            )}
            {pct >= 70 && (
              <span className="size-badge stud-badge" style={{ background: SIZE_COLORS[planting.sizeLabel] }}>
                {planting.sizeLabel}
              </span>
            )}
            {!ready && (
              <span className="stud-timer" style={{ fontSize: timerFontSize }}>
                {secondsLeft}s
              </span>
            )}
          </div>
        );
      })}

      {pickerCell && (
        <PlantPickerModal
          player={player}
          x={pickerCell.x}
          y={pickerCell.y}
          onClose={() => setPickerCell(null)}
        />
      )}
    </div>
  );
}
