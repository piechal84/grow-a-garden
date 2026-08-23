import { useState } from "react";
import { CROP_TIER_COLORS, CROP_TIER_LABELS } from "../gameData";
import { MOON_CROPS, MOON_PACK_COST, MOON_PACK_ODDS, MOON_TIER_TO_CROP_TIER, type MoonTier } from "../moonData";
import type { MoonPackResult, PlayerState } from "../types";
import { socket } from "../socket";
import CropIcon from "./CropIcon";

function tierLabel(tier: MoonTier): string {
  return CROP_TIER_LABELS[MOON_TIER_TO_CROP_TIER[tier]];
}

function tierColor(tier: MoonTier): string {
  return CROP_TIER_COLORS[MOON_TIER_TO_CROP_TIER[tier]];
}

export default function MoonShopView({ player }: { player: PlayerState }) {
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MoonPackResult | null>(null);
  const [opening, setOpening] = useState(false);

  const affordable = player.coins >= MOON_PACK_COST;

  function handleBuyPack() {
    setError(null);
    setOpening(true);
    socket.emit("buy_moon_pack", (res) => {
      setOpening(false);
      if (!res.ok) {
        setError(res.error ?? "Could not buy pack.");
        return;
      }
      setLastResult(res.result ?? null);
    });
  }

  return (
    <div className="shop-view">
      <h2>🌙 Moon Shop</h2>
      <p className="shop-sub">
        Celestial seeds you won't find anywhere else. You can't buy them directly — crack open a pack and you're
        always guaranteed a seed.
      </p>
      {error && <p className="lobby-error">{error}</p>}

      <button className="btn btn-moon" disabled={!affordable || opening} onClick={handleBuyPack}>
        {opening ? "Opening…" : `🎁 Open Moon Seed Pack (${MOON_PACK_COST})`}
      </button>

      {lastResult &&
        (() => {
          const crop = MOON_CROPS.find((c) => c.id === lastResult.cropId);
          if (!crop) return null;
          return (
            <div className={`moon-reveal moon-reveal-${lastResult.kind}`}>
              <CropIcon crop={crop} size={44} />
              <span className="moon-reveal-title">{crop.name}</span>
              <span className="moon-reveal-tier" style={{ color: tierColor(crop.tier) }}>
                {tierLabel(crop.tier).toUpperCase()}
              </span>
            </div>
          );
        })()}

      <h3 className="moon-section-title">The 6 Moon Seeds</h3>
      <div className="shop-list">
        {MOON_CROPS.map((crop) => (
          <div key={crop.id} className="shop-row">
            <div className="shop-row-icon">
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
              </div>
              <div className="shop-row-stats">
                <span>⏱ {crop.growSeconds}s to grow</span>
                <span>💰 sells {crop.sellPrice}</span>
                <span>📐 {crop.variableFootprint ? "2x1 or 1x2 (random)" : `${crop.footprint.w}x${crop.footprint.h}`}</span>
              </div>
            </div>
          </div>
        ))}
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
