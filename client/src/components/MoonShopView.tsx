import { useRef, useState } from "react";
import { growSpeedMultiplier } from "../derived";
import { CROP_TIER_COLORS, CROP_TIER_LABELS, PERSISTENT_REGROW_MULTIPLIER } from "../gameData";
import { MOON_CROPS, MOON_PACK_COST, MOON_PACK_ODDS, MOON_TIER_TO_CROP_TIER, type MoonTier } from "../moonData";
import type { MoonPackAck, MoonPackBulkAck, MoonPackResult, PlayerState } from "../types";
import { socket } from "../socket";
import CropIcon from "./CropIcon";
import MoonPackCelebration from "./MoonPackCelebration";

function tierLabel(tier: MoonTier): string {
  return CROP_TIER_LABELS[MOON_TIER_TO_CROP_TIER[tier]];
}

function tierColor(tier: MoonTier): string {
  return CROP_TIER_COLORS[MOON_TIER_TO_CROP_TIER[tier]];
}

function bestOf(results: MoonPackResult[]): MoonPackResult {
  return results.reduce((best, r) => (MOON_TIER_TO_CROP_TIER[r.kind] > MOON_TIER_TO_CROP_TIER[best.kind] ? r : best));
}

const SPIN_ORDER = MOON_CROPS.map((c) => c.id);
const SPIN_MIN_STEPS = 18;
const BULK_COUNT = 10;
const BULK_DISCOUNT = 0.1;
const BULK_COST = Math.round(MOON_PACK_COST * BULK_COUNT * (1 - BULK_DISCOUNT));
/** If the connection drops between the emit and the server's response, hasAck() would otherwise
 *  never turn true — spinning forever even though the purchase may well have already gone
 *  through server-side (coins already spent, invisible until this gives up and says so). */
const ACK_TIMEOUT_MS = 10_000;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type Phase = "idle" | "spinning" | "revealed";
type SpinResult = "ok" | "superseded" | "timeout";

export default function MoonShopView({ player }: { player: PlayerState }) {
  const growMult = growSpeedMultiplier(player);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MoonPackResult | null>(null);
  const [bulkResults, setBulkResults] = useState<MoonPackResult[] | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [spinCropId, setSpinCropId] = useState(SPIN_ORDER[0]);
  const spinRunId = useRef(0);

  const affordable = player.coins >= MOON_PACK_COST;
  const bulkAffordable = player.coins >= BULK_COST;

  async function runSpin(runId: number, hasAck: () => boolean): Promise<SpinResult> {
    let step = 0;
    const deadline = Date.now() + ACK_TIMEOUT_MS;
    while (true) {
      if (runId !== spinRunId.current) return "superseded";
      setSpinCropId(SPIN_ORDER[step % SPIN_ORDER.length]);
      const t = Math.min(1, step / SPIN_MIN_STEPS);
      await delay(55 + t * t * 210);
      step++;
      if (step >= SPIN_MIN_STEPS && hasAck()) return "ok";
      if (Date.now() > deadline) return "timeout";
    }
  }

  async function handleBuyPack() {
    setError(null);
    setLastResult(null);
    setBulkResults(null);
    setPhase("spinning");
    const runId = ++spinRunId.current;

    const box: { ack: MoonPackAck | null } = { ack: null };
    socket.emit("buy_moon_pack", (res) => {
      box.ack = res;
    });

    // Cycle through the crop icons with a slot-machine deceleration curve. Keeps spinning
    // past the minimum if the server hasn't answered yet, so it never looks stuck or reveals
    // before the real (server-authoritative) result is known.
    const spinResult = await runSpin(runId, () => !!box.ack);
    if (spinResult === "superseded") return;
    if (runId !== spinRunId.current) return;
    if (spinResult === "timeout") {
      setPhase("idle");
      setError("Lost connection while opening the pack — check your coin count before trying again.");
      return;
    }

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

    const box: { ack: MoonPackBulkAck | null } = { ack: null };
    socket.emit("buy_moon_pack_bulk", (res) => {
      box.ack = res;
    });

    const spinResult = await runSpin(runId, () => !!box.ack);
    if (spinResult === "superseded") return;
    if (runId !== spinRunId.current) return;
    if (spinResult === "timeout") {
      setPhase("idle");
      setError("Lost connection while opening the packs — check your coin count before trying again.");
      return;
    }

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

  const spinningCrop = MOON_CROPS.find((c) => c.id === spinCropId);

  return (
    <div className="shop-view">
      <h2>🌙 Moon Shop</h2>
      <p className="shop-sub">
        Celestial seeds you won't find anywhere else. You can't buy them directly — crack open a pack and you're
        always guaranteed a seed.
      </p>
      {error && <p className="lobby-error">{error}</p>}

      <div className="moon-buy-row">
        <button className="btn btn-moon" disabled={!affordable || phase === "spinning"} onClick={handleBuyPack}>
          {phase === "spinning" ? "Opening…" : `🎁 Open Moon Seed Pack (${MOON_PACK_COST})`}
        </button>
        <button className="btn btn-moon btn-moon-bulk" disabled={!bulkAffordable || phase === "spinning"} onClick={handleBuyBulk}>
          <span className="moon-bulk-discount-tag">10% OFF</span>
          {phase === "spinning" ? "Opening…" : `🎁 Open 10x Moon Seed Packs (${BULK_COST})`}
        </button>
      </div>

      {phase === "spinning" && spinningCrop && (
        <div className="moon-spin">
          <div className="moon-spin-window">
            <CropIcon crop={spinningCrop} size={44} />
          </div>
          <span className="moon-spin-label">Rolling…</span>
        </div>
      )}

      {phase === "revealed" &&
        lastResult &&
        (() => {
          const crop = MOON_CROPS.find((c) => c.id === lastResult.cropId);
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
              const crop = MOON_CROPS.find((c) => c.id === r.cropId);
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

      <h3 className="moon-section-title">The 6 Moon Seeds</h3>
      <div className="shop-list">
        {MOON_CROPS.map((crop) => {
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
                  <span>💰 sells {crop.sellPrice}</span>
                  <span>📐 {crop.variableFootprint ? "2x1 or 1x2 (random)" : `${crop.footprint.w}x${crop.footprint.h}`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="moon-section-title">Pack Odds</h3>
      <div className="moon-odds-list">
        {MOON_PACK_ODDS.map((o) => (
          <div key={o.tier} className="moon-odds-row">
            <span style={{ color: tierColor(o.tier) }}>{tierLabel(o.tier)}</span>
            <span>{o.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
