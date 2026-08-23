import { useState } from "react";
import { SIZE_COLORS } from "../gameData";
import { getCropDef } from "../moonData";
import type { PlayerState } from "../types";
import { socket } from "../socket";
import { effectiveWorkBetween, MUTATIONS } from "../weather";
import { CELL_SIZE, plotOrigin, type Position } from "../world";
import GrowthPlant from "./GrowthPlant";
import PlantPickerModal from "./PlantPickerModal";

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
    onWalkTo(cellWorldPos(x, y));
    setPickerCell({ x, y });
  }

  function handleHarvest(e: React.MouseEvent, plantingId: string, x: number, y: number, w: number, h: number) {
    e.stopPropagation();
    onWalkTo(cellWorldPos(x, y, w, h));
    socket.emit("harvest", { plantingId });
  }

  function handleReclaim(e: React.MouseEvent, plantingId: string, x: number, y: number, w: number, h: number) {
    e.stopPropagation();
    onWalkTo(cellWorldPos(x, y, w, h));
    socket.emit("reclaim_planting", { plantingId });
  }

  const hasReclaimer = (player.gearOwned["reclaimer"] ?? 0) > 0;

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
      {emptyCells.map(({ x, y }) => (
        <button
          key={`e-${x}-${y}`}
          className="stud stud-empty"
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
        const glowColor = planting.mutations.length > 0 ? MUTATIONS[planting.mutations[0]].color : undefined;

        return (
          <div
            key={planting.id}
            className={`stud stud-planted ${ready ? "stud-ready" : ""}`}
            style={{
              left: planting.x * CELL_SIZE,
              top: planting.y * CELL_SIZE,
              width: planting.w * CELL_SIZE,
              height: planting.h * CELL_SIZE,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (ready && isOwner) handleHarvest(e, planting.id, planting.x, planting.y, planting.w, planting.h);
            }}
          >
            <GrowthPlant
              crop={crop}
              pct={pct}
              ready={ready}
              targetScale={planting.sizeVisualScale}
              glowColor={glowColor}
            />
            {crop.persistent && <span className="tree-badge" title="Regrows after harvest — never consumed">🌳</span>}
            {isOwner && hasReclaimer && (
              <button
                className="reclaim-btn"
                title="Reclaim seed"
                onClick={(e) => handleReclaim(e, planting.id, planting.x, planting.y, planting.w, planting.h)}
              >
                🧲
              </button>
            )}
            {pct >= 70 && planting.mutations.length > 0 && (
              <span className="mutation-badges">
                {planting.mutations.map((m) => (
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
            {!ready && <span className="stud-timer">{secondsLeft}s</span>}
            {ready && isOwner && (
              <span className="stud-harvest-hint">{crop.persistent ? "Tap to harvest (regrows)" : "Tap to harvest"}</span>
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
