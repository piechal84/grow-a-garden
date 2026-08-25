import { useState } from "react";
import { SIZE_COLORS } from "../gameData";
import { MOON_CROPS_BY_ID } from "../moonData";
import { getAnyCropDef as getCropDef, SOLAR_CROPS_BY_ID } from "../solarData";
import type { PlayerState, Planting } from "../types";
import { socket } from "../socket";
import { effectiveWorkBetween, MUTATIONS, type MutationId } from "../weather";
import { CELL_SIZE, plotOrigin } from "../world";
import GrowthPlant from "./GrowthPlant";
import IncubatorStructure from "./IncubatorStructure";
import KitsuneShrineStructure from "./KitsuneShrineStructure";
import { ChargedSlotEffect } from "./MutationEffects";
import PlantPickerModal from "./PlantPickerModal";
import RoamingPets from "./RoamingPets";

const INCUBATOR_SIZE = 3;
/** Must match HARVEST_ALL_COST_COINS / GROW_ALL_COST_KELKA_CRYSTALS in server/src/rooms.ts. */
const HARVEST_ALL_COST_COINS = 1000;
const GROW_ALL_COST_KELKA_CRYSTALS = 3;
const KITSUNE_SHRINE_SIZE = 3;

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
  const tier = MOON_CROPS_BY_ID[cropId]?.tier ?? SOLAR_CROPS_BY_ID[cropId]?.tier;
  if (tier === "mythic") return "divine";
  if (tier === "legendary") return "celestial";
  return undefined;
}

export default function PlotView({
  player,
  isOwner,
  now,
  roomCreatedAt,
}: {
  player: PlayerState;
  isOwner: boolean;
  now: number;
  roomCreatedAt: number;
}) {
  const [pickerCell, setPickerCell] = useState<{ x: number; y: number } | null>(null);
  const [activeTool, setActiveTool] = useState<"reclaim" | "move" | "place_incubator" | "place_kitsune_shrine" | null>(
    null,
  );
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const origin = plotOrigin(player.slotIndex);

  const occupied = new Set<string>();
  for (const p of player.plantings) {
    for (let cx = p.x; cx < p.x + p.w; cx++) {
      for (let cy = p.y; cy < p.y + p.h; cy++) occupied.add(`${cx},${cy}`);
    }
  }
  for (const inc of player.incubators) {
    for (let cx = inc.x; cx < inc.x + INCUBATOR_SIZE; cx++) {
      for (let cy = inc.y; cy < inc.y + INCUBATOR_SIZE; cy++) occupied.add(`${cx},${cy}`);
    }
  }
  for (const shrine of player.kitsuneShrines) {
    for (let cx = shrine.x; cx < shrine.x + KITSUNE_SHRINE_SIZE; cx++) {
      for (let cy = shrine.y; cy < shrine.y + KITSUNE_SHRINE_SIZE; cy++) occupied.add(`${cx},${cy}`);
    }
  }

  function handleEmptyCellClick(e: React.MouseEvent, x: number, y: number) {
    e.stopPropagation();
    if (!isOwner) return;
    if (activeTool === "move" && movingId) {
      const id = movingId;
      const onSettled = (res: { ok: boolean; error?: string }) => {
        if (res.ok) {
          setMovingId(null);
          setMoveError(null);
        } else {
          setMoveError(res.error ?? "Won't fit there.");
        }
      };
      if (player.incubators.some((inc) => inc.id === id)) {
        socket.emit("move_incubator", { incubatorId: id, x, y }, onSettled);
      } else if (player.kitsuneShrines.some((s) => s.id === id)) {
        socket.emit("move_kitsune_shrine", { shrineId: id, x, y }, onSettled);
      } else {
        socket.emit("move_planting", { plantingId: id, x, y }, onSettled);
      }
      return;
    }
    if (activeTool === "place_incubator") {
      socket.emit("place_incubator", { x, y }, (res) => {
        if (res.ok) {
          setActiveTool(null);
          setMoveError(null);
        } else {
          setMoveError(res.error ?? "Won't fit there.");
        }
      });
      return;
    }
    if (activeTool === "place_kitsune_shrine") {
      socket.emit("place_kitsune_shrine", { x, y }, (res) => {
        if (res.ok) {
          setActiveTool(null);
          setMoveError(null);
        } else {
          setMoveError(res.error ?? "Won't fit there.");
        }
      });
      return;
    }
    if (activeTool) return; // reclaim mode (or move mode with nothing selected yet) has no empty-cell action
    setPickerCell({ x, y });
  }

  function handleHarvest(plantingId: string) {
    socket.emit("harvest", { plantingId });
  }

  function handleHarvestAll() {
    setMoveError(null);
    socket.emit("harvest_all", (res) => {
      if (!res.ok) setMoveError(res.error ?? "Could not harvest all.");
    });
  }

  function handleGrowAll() {
    setMoveError(null);
    socket.emit("grow_all", (res) => {
      if (!res.ok) setMoveError(res.error ?? "Could not grow all.");
    });
  }

  function handleReclaim(plantingId: string) {
    socket.emit("reclaim_planting", { plantingId });
    setMoveError(null);
  }

  function handleReclaimIncubator(incubatorId: string) {
    socket.emit("reclaim_incubator", { incubatorId }, (res) => {
      setMoveError(res.ok ? null : (res.error ?? "Could not reclaim."));
    });
  }

  function handleReclaimKitsuneShrine(shrineId: string) {
    socket.emit("reclaim_kitsune_shrine", { shrineId }, (res) => {
      setMoveError(res.ok ? null : (res.error ?? "Could not reclaim."));
    });
  }

  function handleSelectForMove(plantingId: string) {
    setMoveError(null);
    setMovingId(plantingId);
  }

  function handlePlantingClick(planting: Planting, ready: boolean) {
    if (!isOwner) return;
    if (activeTool === "reclaim") {
      handleReclaim(planting.id);
      return;
    }
    if (activeTool === "move") {
      handleSelectForMove(planting.id);
      return;
    }
    if (ready) handleHarvest(planting.id);
  }

  function toggleTool(tool: "reclaim" | "move" | "place_incubator" | "place_kitsune_shrine") {
    setMoveError(null);
    setMovingId(null);
    setActiveTool((cur) => (cur === tool ? null : tool));
  }

  const hasReclaimer = (player.gearOwned["reclaimer"] ?? 0) > 0;
  const hasTrowel = (player.gearOwned["trowel"] ?? 0) > 0;
  const incubatorsOwned = player.gearOwned["kelka_incubator"] ?? 0;
  const canPlaceIncubator = incubatorsOwned > player.incubators.length;
  const kitsuneShrinesOwned = player.gearOwned["kelka_kitsune_shrine"] ?? 0;
  const canPlaceKitsuneShrine = kitsuneShrinesOwned > player.kitsuneShrines.length;
  const readyCount = player.plantings.filter((p) => now >= p.readyAt).length;
  const growingCount = player.plantings.filter((p) => now < p.readyAt).length;
  const canHarvestAll = readyCount > 0 && player.coins >= HARVEST_ALL_COST_COINS;
  const canGrowAll = growingCount > 0 && player.kelkaCrystals >= GROW_ALL_COST_KELKA_CRYSTALS;

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
      {isOwner && (
        <div className="plot-toolbar" onClick={(e) => e.stopPropagation()}>
          <button
            className="plot-tool-btn"
            disabled={!canHarvestAll}
            title={
              readyCount === 0
                ? "Nothing ready to harvest"
                : player.coins < HARVEST_ALL_COST_COINS
                  ? "Not enough coins"
                  : `Harvest all ${readyCount} ready crops`
            }
            onClick={handleHarvestAll}
          >
            🌾 Harvest All (🪙{HARVEST_ALL_COST_COINS})
          </button>
          <button
            className="plot-tool-btn"
            disabled={!canGrowAll}
            title={
              growingCount === 0
                ? "Nothing growing right now"
                : player.kelkaCrystals < GROW_ALL_COST_KELKA_CRYSTALS
                  ? "Not enough Kelka Crystals — earn them from daily quests"
                  : `Instantly finish growing all ${growingCount} crops`
            }
            onClick={handleGrowAll}
          >
            ⚡ Grow All (💠{GROW_ALL_COST_KELKA_CRYSTALS})
          </button>
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
          {canPlaceIncubator && (
            <button
              className={`plot-tool-btn ${activeTool === "place_incubator" ? "plot-tool-btn-active" : ""}`}
              onClick={() => toggleTool("place_incubator")}
            >
              🥚 Place Incubator
            </button>
          )}
          {canPlaceKitsuneShrine && (
            <button
              className={`plot-tool-btn ${activeTool === "place_kitsune_shrine" ? "plot-tool-btn-active" : ""}`}
              onClick={() => toggleTool("place_kitsune_shrine")}
            >
              🐺 Place Kitsune Shrine
            </button>
          )}
        </div>
      )}
      {isOwner && activeTool === "reclaim" && (
        <div className="plot-move-banner" onClick={(e) => e.stopPropagation()}>
          🧲 Tap a crop to reclaim its seed, or an incubator/shrine to pick it up
          <button className="btn btn-secondary plot-move-cancel" onClick={() => setActiveTool(null)}>
            Done
          </button>
        </div>
      )}
      {isOwner && activeTool === "place_incubator" && (
        <div className="plot-move-banner" onClick={(e) => e.stopPropagation()}>
          🥚 Tap an empty 3x3 clearing to plant the incubator
          <button className="btn btn-secondary plot-move-cancel" onClick={() => setActiveTool(null)}>
            Cancel
          </button>
        </div>
      )}
      {isOwner && activeTool === "place_kitsune_shrine" && (
        <div className="plot-move-banner" onClick={(e) => e.stopPropagation()}>
          🐺 Tap an empty 3x3 clearing to plant the Kitsune Shrine
          <button className="btn btn-secondary plot-move-cancel" onClick={() => setActiveTool(null)}>
            Cancel
          </button>
        </div>
      )}
      {isOwner && activeTool === "move" && !movingId && (
        <div className="plot-move-banner" onClick={(e) => e.stopPropagation()}>
          🛠️ Tap a crop, incubator, or shrine to move it
          <button className="btn btn-secondary plot-move-cancel" onClick={() => setActiveTool(null)}>
            Done
          </button>
        </div>
      )}
      {isOwner && activeTool === "move" && movingId && (
        <div className="plot-move-banner" onClick={(e) => e.stopPropagation()}>
          🛠️ Choose a new spot
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
        const rainbow = displayMutations.includes("rainbow");
        const charged = displayMutations.includes("charged");
        const wet = displayMutations.includes("wet");
        // Charged and Wet (unless paired with Rainbow) get their own dedicated effects below
        // instead of the flat colored halo every other mutation still uses — so they shouldn't
        // also contribute a color to it, or the halo would show through underneath them.
        const haloMutations = displayMutations.filter((m) => m !== "charged" && (m !== "wet" || rainbow));
        const glowColor = haloMutations.length > 0 ? MUTATIONS[haloMutations[0]].color : undefined;
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
              rainbow={rainbow}
              wet={wet}
              blossomColor={planting.blossomColor}
            />
            {pct >= 70 && charged && <ChargedSlotEffect />}
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

      {player.incubators.map((incubator) => (
        <IncubatorStructure
          key={incubator.id}
          incubator={incubator}
          player={player}
          isOwner={isOwner}
          now={now}
          moveMode={activeTool === "move"}
          isMoving={movingId === incubator.id}
          onSelectForMove={() => handleSelectForMove(incubator.id)}
          reclaimMode={activeTool === "reclaim"}
          onReclaim={() => handleReclaimIncubator(incubator.id)}
        />
      ))}

      {player.kitsuneShrines.map((shrine) => (
        <KitsuneShrineStructure
          key={shrine.id}
          shrine={shrine}
          player={player}
          isOwner={isOwner}
          now={now}
          moveMode={activeTool === "move"}
          isMoving={movingId === shrine.id}
          onSelectForMove={() => handleSelectForMove(shrine.id)}
          reclaimMode={activeTool === "reclaim"}
          onReclaim={() => handleReclaimKitsuneShrine(shrine.id)}
        />
      ))}

      <RoamingPets player={player} />

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
