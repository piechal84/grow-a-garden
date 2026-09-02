import { useState } from "react";
import { GEAR, nextGearPrice, type GearItem, type GearPrice } from "../gameData";
import type { PlayerState } from "../types";
import { socket } from "../socket";
import GrowSpeedBanner from "./GrowSpeedBanner";

function formatPct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
}

function formatGearPrice(price: GearPrice): string {
  const parts: string[] = [];
  if (price.coins > 0) parts.push(`${price.coins}`);
  if (price.diamonds > 0) parts.push(`💎${price.diamonds}`);
  if (price.kelkaCrystals) parts.push(`💠${price.kelkaCrystals}`);
  return parts.length > 0 ? parts.join(" + ") : "0";
}

/** Watering Can / Fertilizer Bag have per-level values instead of one flat bonus — this
 *  describes the current level's effect and, if not maxed, what the next level bumps it to. */
function levelEffectLine(gear: GearItem, owned: number): string | null {
  if (gear.effect.type !== "growSpeed" && gear.effect.type !== "sellBonus") return null;
  const verb = gear.effect.type === "growSpeed" ? "faster grow time" : "higher sale price";
  const levels = gear.effect.levels;
  if (owned <= 0) return `Level 1: ${formatPct(levels[0])} ${verb}`;
  const current = `${formatPct(levels[owned - 1])} ${verb}`;
  if (owned >= levels.length) return `Currently ${current} (max level)`;
  return `Currently ${current} — next level: ${formatPct(levels[owned])} ${verb}`;
}

export default function GearShopView({ player }: { player: PlayerState }) {
  const [error, setError] = useState<string | null>(null);

  function handleBuy(gearId: string) {
    setError(null);
    socket.emit("buy_gear", { gearId }, (res) => {
      if (!res.ok) setError(res.error ?? "Could not buy gear.");
    });
  }

  return (
    <div className="shop-view">
      <h2>🧰 Gear Shop</h2>
      <p className="shop-sub">Permanent upgrades for your whole garden.</p>
      <div className="kelka-banner">
        <span className="kelka-mark">◆ KELKA INDUSTRIES</span>
        <span className="kelka-tagline">Manufacturer of record. More information in future updates.</span>
      </div>
      <GrowSpeedBanner player={player} />
      {error && <p className="lobby-error">{error}</p>}
      <div className="shop-list">
        {GEAR.map((gear) => {
          const owned = player.gearOwned[gear.id] ?? 0;
          const maxedOut = gear.maxOwned !== undefined && owned >= gear.maxOwned;
          const alreadyOwned = !gear.repeatable && owned > 0;
          const price = nextGearPrice(gear, owned);
          const affordable =
            player.coins >= price.coins &&
            player.diamonds >= price.diamonds &&
            player.kelkaCrystals >= (price.kelkaCrystals ?? 0);
          const icon = gear.levelEmojis ? gear.levelEmojis[Math.max(0, owned - 1)] : gear.emoji;
          const effectLine = levelEffectLine(gear, owned);

          return (
            <div key={gear.id} className="shop-row">
              <div className="shop-row-icon">
                <span style={{ fontSize: 30 }}>{icon}</span>
              </div>
              <div className="shop-row-info">
                <div className="shop-row-name">
                  {gear.name}
                  {owned > 0 &&
                    (gear.maxOwned && gear.maxOwned > 1 ? (
                      <span className="owned-badge">
                        Lv {owned}/{gear.maxOwned}
                      </span>
                    ) : (
                      <span className="owned-badge">{gear.repeatable ? `x${owned}` : "owned"}</span>
                    ))}
                </div>
                <div className="shop-row-stats">{effectLine ?? gear.description}</div>
              </div>
              <div className="shop-row-actions">
                {alreadyOwned || maxedOut ? (
                  <span className="plot-ready-tag">{maxedOut ? "Maxed" : "Owned"}</span>
                ) : (
                  <button className="btn btn-primary" disabled={!affordable} onClick={() => handleBuy(gear.id)}>
                    Buy ({formatGearPrice(price)})
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
