import { useState } from "react";
import { createPortal } from "react-dom";
import { CROP_TIER_COLORS, CROP_TIER_LABELS } from "../gameData";
import type { PlayerState, YggdrasilState } from "../types";
import { socket } from "../socket";
import {
  EXTEND_ROOTS_TOKEN_COST,
  VIKING_CROPS,
  VIKING_PACK_ODDS,
  VIKING_TIER_TO_CROP_TIER,
  YGGDRASIL_BUILD_MS,
  YGGDRASIL_MAX_SLOTS,
  yggdrasilSlotUpgradeCost,
  type VikingTier,
} from "../vikingData";
import { CELL_SIZE, ROOT_EXPANSION_MAX } from "../world";
import CropIcon from "./CropIcon";
import YggdrasilTreeArt from "./YggdrasilTreeArt";

/** 5 growth stages spread evenly across the 24h build — matches the reference life-cycle art
 *  (sprout -> bush -> sapling -> young tree -> full World Tree). Progress is derived purely from
 *  time-left-until-constructionReadyAt against the fixed build duration, so no separate "planted
 *  at" timestamp needs to be stored. */
function growthStage(constructionReadyAt: number, now: number): 0 | 1 | 2 | 3 | 4 {
  const remaining = Math.max(0, constructionReadyAt - now);
  const progress = Math.min(1, Math.max(0, 1 - remaining / YGGDRASIL_BUILD_MS));
  return Math.min(4, Math.floor(progress * 5)) as 0 | 1 | 2 | 3 | 4;
}

function tierLabel(tier: VikingTier): string {
  return CROP_TIER_LABELS[VIKING_TIER_TO_CROP_TIER[tier]];
}

function tierColor(tier: VikingTier): string {
  return CROP_TIER_COLORS[VIKING_TIER_TO_CROP_TIER[tier]];
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** The World Tree, planted on the plot (4x4) — inert while under construction (24h), then tap to
 *  open the Research modal: start/collect jobs across its research slots, or upgrade for more.
 *  Same portal-to-<body> reasoning as Incubator/Kitsune Shrine: the plot's zoomed/scaled container
 *  turns `position: fixed` into "fixed to that ancestor" otherwise. */
export default function YggdrasilStructure({
  yggdrasil,
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
  yggdrasil: YggdrasilState;
  player: PlayerState;
  isOwner: boolean;
  now: number;
  moveMode?: boolean;
  isMoving?: boolean;
  onSelectForMove?: () => void;
  reclaimMode?: boolean;
  onReclaim?: () => void;
  /** The world canvas's own CSS scale (see WorldView.tsx) — the error banner below lives inside
   *  that same scaled subtree, so it needs an inverse transform to stay readable at low zoom (the
   *  research modal itself is portaled to <body> and unaffected). */
  zoom: number;
}) {
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const built = now >= yggdrasil.constructionReadyAt;
  const readyJobs = yggdrasil.research.filter((r) => now >= r.readyAt);

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
    if (!built) return;
    setShowModal(true);
  }

  function handleStartResearch() {
    setBusy(true);
    setError(null);
    socket.emit("start_viking_research", (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error ?? "Could not start research.");
    });
  }

  function handleCollect(researchId: string) {
    setBusy(true);
    setError(null);
    socket.emit("collect_viking_research", { researchId }, (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error ?? "Could not collect.");
    });
  }

  function handleCollectAll() {
    setBusy(true);
    setError(null);
    socket.emit("collect_all_viking_research", (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error ?? "Could not collect.");
    });
  }

  function handleUpgrade() {
    setBusy(true);
    setError(null);
    socket.emit("upgrade_yggdrasil", (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error ?? "Could not upgrade.");
    });
  }

  function handleExtendRoots() {
    setBusy(true);
    setError(null);
    socket.emit("extend_roots", (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error ?? "Could not extend roots.");
    });
  }

  const upgradeCost = yggdrasilSlotUpgradeCost(yggdrasil.slots);
  const canAffordUpgrade = upgradeCost !== undefined && player.diamonds >= upgradeCost;
  const rootsMaxed = player.rootExpansions >= ROOT_EXPANSION_MAX;
  const canAffordRoots = !rootsMaxed && player.vegvizirTokens >= EXTEND_ROOTS_TOKEN_COST;

  const emptySlotCount = Math.max(0, yggdrasil.slots - yggdrasil.research.length);
  const stage = growthStage(yggdrasil.constructionReadyAt, now);

  return (
    <div
      className={`stud stud-yggdrasil ${!built ? "stud-yggdrasil-growing" : ""} ${
        readyJobs.length > 0 ? "incubator-ready" : ""
      } ${isMoving ? "stud-moving" : ""} ${isOwner && (moveMode || reclaimMode) ? "stud-tool-target" : ""}`}
      style={{
        left: yggdrasil.x * CELL_SIZE,
        top: yggdrasil.y * CELL_SIZE,
        width: 4 * CELL_SIZE,
        height: 4 * CELL_SIZE,
      }}
      onClick={handleClick}
      title={
        reclaimMode
          ? "Tap to reclaim"
          : moveMode
            ? isMoving
              ? "Selected — pick a new spot"
              : "Tap to move"
            : !built
              ? "Still growing…"
              : readyJobs.length > 0
                ? "Tap to collect"
                : "Tap to research Viking seeds"
      }
    >
      <div className="yggdrasil-tree-wrap">
        <YggdrasilTreeArt stage={stage} />
      </div>
      {!built && <span className="incubator-timer">{formatDuration(yggdrasil.constructionReadyAt - now)} to grow</span>}
      {built && readyJobs.length > 0 && <span className="incubator-collect-label">{readyJobs.length} ready — tap to collect!</span>}
      {built && readyJobs.length === 0 && (
        <span className="incubator-collect-label">
          {yggdrasil.research.length}/{yggdrasil.slots} researching
        </span>
      )}
      {error && (
        <div
          className="plot-move-error"
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: "center top" }}
          onClick={(e) => e.stopPropagation()}
        >
          {error}
        </div>
      )}

      {showModal &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={(e) => {
              e.stopPropagation();
              setShowModal(false);
            }}
          >
            <div className="modal modal-shop" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close">
                ✕
              </button>
              <h2>🌳 Yggdrasil Research</h2>
              <p className="shop-sub">
                Each free slot can research one Viking Seed Pack at a time — 1 hour per job, guaranteed a seed. Upgrade
                for more slots running at once.
              </p>

              <div className="ygg-slots-row">
                {yggdrasil.research.map((job) => {
                  const ready = now >= job.readyAt;
                  return (
                    <div key={job.id} className={`ygg-slot ${ready ? "ygg-slot-ready" : ""}`}>
                      <span className="ygg-slot-emoji">{ready ? "🎁" : "🌱"}</span>
                      {ready ? (
                        <button className="btn btn-primary ygg-slot-btn" disabled={busy} onClick={() => handleCollect(job.id)}>
                          Collect
                        </button>
                      ) : (
                        <span className="ygg-slot-timer">{formatDuration(job.readyAt - now)}</span>
                      )}
                    </div>
                  );
                })}
                {Array.from({ length: emptySlotCount }, (_, i) => (
                  <div key={`empty-${i}`} className="ygg-slot ygg-slot-empty">
                    <span className="ygg-slot-emoji">➕</span>
                    <button className="btn btn-secondary ygg-slot-btn" disabled={busy} onClick={handleStartResearch}>
                      Research
                    </button>
                  </div>
                ))}
              </div>

              {readyJobs.length > 1 && (
                <button className="btn btn-primary ygg-collect-all" disabled={busy} onClick={handleCollectAll}>
                  🎁 Collect All ({readyJobs.length})
                </button>
              )}

              <div className="ygg-upgrade-row">
                <div>
                  <div className="shop-row-name">
                    Research Slots
                    <span className="owned-badge">
                      {yggdrasil.slots}/{YGGDRASIL_MAX_SLOTS}
                    </span>
                  </div>
                  <div className="shop-row-stats">One more Viking Seed Pack researching at once.</div>
                </div>
                {upgradeCost !== undefined ? (
                  <button className="btn btn-primary" disabled={busy || !canAffordUpgrade} onClick={handleUpgrade}>
                    Upgrade (💎{upgradeCost.toLocaleString()})
                  </button>
                ) : (
                  <span className="plot-ready-tag">Maxed</span>
                )}
              </div>

              <div className="ygg-upgrade-row">
                <div>
                  <div className="shop-row-name">
                    🌱 Extend Roots
                    <span className="owned-badge">
                      {player.rootExpansions}/{ROOT_EXPANSION_MAX}
                    </span>
                  </div>
                  <div className="shop-row-stats">Buy the plot next to your garden — one more row of growing space.</div>
                </div>
                {rootsMaxed ? (
                  <span className="plot-ready-tag">Maxed</span>
                ) : (
                  <button className="btn btn-primary" disabled={busy || !canAffordRoots} onClick={handleExtendRoots}>
                    Extend (🧭{EXTEND_ROOTS_TOKEN_COST})
                  </button>
                )}
              </div>

              <h3 className="moon-section-title">The 6 Viking Seeds</h3>
              <div className="shop-list">
                {VIKING_CROPS.map((crop) => (
                  <div key={crop.id} className="shop-row">
                    <div className={`shop-row-icon ${crop.tier === "mythic" ? "plant-aura-divine" : ""}`}>
                      <CropIcon crop={crop} size={30} />
                    </div>
                    <div className="shop-row-info">
                      <div className="shop-row-name">
                        {crop.name}
                        <span className="size-badge" style={{ background: tierColor(crop.tier) }}>
                          {tierLabel(crop.tier)}
                        </span>
                      </div>
                      <div className="shop-row-stats">
                        <span>⏱ {formatDuration(crop.growSeconds * 1000)} to grow</span>
                        <span>
                          💰 sells {crop.diamondReward ? `💎${crop.diamondReward}` : crop.sellPrice}
                          {crop.vegvizirTokenReward ? ` + 🧭${crop.vegvizirTokenReward}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="moon-section-title">Research Odds</h3>
              <div className="moon-odds-list">
                {VIKING_PACK_ODDS.map((o) => (
                  <div key={o.tier} className="moon-odds-row">
                    <span style={{ color: tierColor(o.tier) }}>{tierLabel(o.tier)}</span>
                    <span>{o.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
