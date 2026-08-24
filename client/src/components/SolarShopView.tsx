import { useRef, useState } from "react";
import { growSpeedMultiplier } from "../derived";
import { CROP_TIER_COLORS, CROP_TIER_LABELS, PERSISTENT_REGROW_MULTIPLIER } from "../gameData";
import { SOLAR_CROPS, SOLAR_PACK_COST, SOLAR_PACK_ODDS, SOLAR_TIER_TO_CROP_TIER, type SolarTier } from "../solarData";
import type { PlayerState, SolarPackAck, SolarPackBulkAck, SolarPackResult } from "../types";
import { socket } from "../socket";
import CropIcon from "./CropIcon";
import MoonPackCelebration from "./MoonPackCelebration";

function tierLabel(tier: SolarTier): string {
  return CROP_TIER_LABELS[SOLAR_TIER_TO_CROP_TIER[tier]];
}

function tierColor(tier: SolarTier): string {
  return CROP_TIER_COLORS[SOLAR_TIER_TO_CROP_TIER[tier]];
}

function bestOf(results: SolarPackResult[]): SolarPackResult {
  return results.reduce((best, r) => (SOLAR_TIER_TO_CROP_TIER[r.kind] > SOLAR_TIER_TO_CROP_TIER[best.kind] ? r : best));
}

const SPIN_ORDER = SOLAR_CROPS.map((c) => c.id);
const SPIN_MIN_STEPS = 18;
const BULK_COUNT = 10;
const BULK_DISCOUNT = 0.1;
const BULK_COST = Math.round(SOLAR_PACK_COST * BULK_COUNT * (1 - BULK_DISCOUNT));

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type Phase = "idle" | "spinning" | "revealed";

export default function SolarShopView({ player }: { player: PlayerState }) {
  const growMult = growSpeedMultiplier(player);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SolarPackResult | null>(null);
  const [bulkResults, setBulkResults] = useState<SolarPackResult[] | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [spinCropId, setSpinCropId] = useState(SPIN_ORDER[0]);
  const spinRunId = useRef(0);

  const affordable = player.diamonds >= SOLAR_PACK_COST;
  const bulkAffordable = player.diamonds >= BULK_COST;

  async function runSpin(runId: number, hasAck: () => boolean) {
    let step = 0;
    while (true) {
      if (runId !== spinRunId.current) return false;
      setSpinCropId(SPIN_ORDER[step % SPIN_ORDER.length]);
      const t = Math.min(1, step / SPIN_MIN_STEPS);
      await delay(55 + t * t * 210);
      step++;
      if (step >= SPIN_MIN_STEPS && hasAck()) return true;
    }
  }

  async function handleBuyPack() {
    setError(null);
    setLastResult(null);
    setBulkResults(null);
    setPhase("spinning");
    const runId = ++spinRunId.current;

    const box: { ack: SolarPackAck | null } = { ack: null };
    socket.emit("buy_solar_pack", (res) => {
      box.ack = res;
    });

    if (!(await runSpin(runId, () => !!box.ack))) return;
    if (runId !== spinRunId.current) return;

    const res = box.ack;
    if (!res || !res.ok || !res.result) {
      setPhase("idle");
      setError(res?.error ?? "Could not buy pack.");
      return;
    }

    setSpinCropId(res.result.cropId);
    await delay(450);
    if (runId !== spinRunId.current) return;
    setLastResult(res.result);
    setPhase("revealed");
  }

  async function handleBuyBulk() {
    setError(null);
    setLastResult(null);
    setBulkResults(null);
    setPhase("spinning");
    const runId = ++spinRunId.current;

    const box: { ack: SolarPackBulkAck | null } = { ack: null };
    socket.emit("buy_solar_pack_bulk", (res) => {
      box.ack = res;
    });

    if (!(await runSpin(runId, () => !!box.ack))) return;
    if (runId !== spinRunId.current) return;

    const res = box.ack;
    if (!res || !res.ok || !res.results) {
      setPhase("idle");
      setError(res?.error ?? "Could not buy packs.");
      return;
    }

    setSpinCropId(bestOf(res.results).cropId);
    await delay(450);
    if (runId !== spinRunId.current) return;
    setBulkResults(res.results);
    setPhase("revealed");
  }

  const spinningCrop = SOLAR_CROPS.find((c) => c.id === spinCropId);

  return (
    <div className="shop-view">
      <h2>☀️ Solar Shop</h2>
      <p className="shop-sub">
        Diamond-only seeds as rare as the Moon Shop's — paid for in Diamonds, not coins. Crack open a pack and
        you're always guaranteed a seed.
      </p>
      {error && <p className="lobby-error">{error}</p>}

      <div className="moon-buy-row">
        <button className="btn btn-solar" disabled={!affordable || phase === "spinning"} onClick={handleBuyPack}>
          {phase === "spinning" ? "Opening…" : `☀️ Open Solar Seed Pack (${SOLAR_PACK_COST} 💎)`}
        </button>
        <button className="btn btn-solar btn-solar-bulk" disabled={!bulkAffordable || phase === "spinning"} onClick={handleBuyBulk}>
          <span className="moon-bulk-discount-tag">10% OFF</span>
          {phase === "spinning" ? "Opening…" : `☀️ Open 10x Solar Seed Packs (${BULK_COST} 💎)`}
        </button>
      </div>

      {phase === "spinning" && spinningCrop && (
        <div className="moon-spin solar-spin">
          <div className="moon-spin-window">
            <CropIcon crop={spinningCrop} size={44} />
          </div>
          <span className="moon-spin-label">Rolling…</span>
        </div>
      )}

      {phase === "revealed" &&
        lastResult &&
        (() => {
          const crop = SOLAR_CROPS.find((c) => c.id === lastResult.cropId);
          if (!crop) return null;
          return (
            <>
              <MoonPackCelebration tier={lastResult.kind} />
              <div className={`moon-reveal moon-reveal-${lastResult.kind}`}>
                <CropIcon crop={crop} size={44} />
                <span className="moon-reveal-title">{crop.name}</span>
                <span className="moon-reveal-tier" style={{ color: tierColor(crop.tier) }}>
                  {tierLabel(crop.tier).toUpperCase()}
                </span>
              </div>
            </>
          );
        })()}

      {phase === "revealed" && bulkResults && (
        <>
          <MoonPackCelebration tier={bestOf(bulkResults).kind} />
          <div className="moon-bulk-reveal">
            {bulkResults.map((r, i) => {
              const crop = SOLAR_CROPS.find((c) => c.id === r.cropId);
              if (!crop) return null;
              return (
                <div key={i} className="moon-bulk-card" style={{ borderColor: tierColor(r.kind) }}>
                  <CropIcon crop={crop} size={26} />
                  <span className="moon-bulk-card-tier" style={{ color: tierColor(r.kind) }}>
                    {tierLabel(r.kind)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h3 className="moon-section-title">The 6 Solar Seeds</h3>
      <div className="shop-list">
        {SOLAR_CROPS.map((crop) => {
          const regrowsSlower = !!crop.persistent && !!player.persistentUnlocked[crop.id];
          const effectiveGrow = Math.round(crop.growSeconds * growMult * (regrowsSlower ? PERSISTENT_REGROW_MULTIPLIER : 1));
          return (
            <div key={crop.id} className="shop-row">
              <div
                className={`shop-row-icon ${crop.tier === "mythic" ? "plant-aura-divine" : ""} ${
                  crop.tier === "legendary" ? "plant-aura-celestial" : ""
                }`}
              >
                <CropIcon crop={crop} size={30} />
              </div>
              <div className="shop-row-info">
                <div className="shop-row-name">
                  {crop.name}
                  <span className="size-badge" style={{ background: tierColor(crop.tier) }}>
                    {tierLabel(crop.tier)}
                  </span>
                  {crop.persistent && (
                    <span className="tree-tag" title="Regrows after harvest — never consumed">
                      🌳 Persistent
                    </span>
                  )}
                  {regrowsSlower && (
                    <span
                      className="tree-tag"
                      title={`You've harvested this before, so it (and any new one you plant) now regrows at ${PERSISTENT_REGROW_MULTIPLIER}x the normal time.`}
                    >
                      🐌 Regrows {PERSISTENT_REGROW_MULTIPLIER}x slower
                    </span>
                  )}
                </div>
                <div className="shop-row-stats">
                  <span>⏱ {effectiveGrow}s to grow</span>
                  <span>{crop.diamondReward ? `💎 sells for ${crop.diamondReward}` : `💰 sells ${crop.sellPrice}`}</span>
                  <span>📐 {crop.variableFootprint ? "2x1 or 1x2 (random)" : `${crop.footprint.w}x${crop.footprint.h}`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="moon-section-title">Pack Odds</h3>
      <div className="moon-odds-list">
        {SOLAR_PACK_ODDS.map((o) => (
          <div key={o.tier} className="moon-odds-row">
            <span style={{ color: tierColor(o.tier) }}>{tierLabel(o.tier)}</span>
            <span>{o.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
