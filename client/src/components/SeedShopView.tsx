import { useState } from "react";
import { CROP_TIER_COLORS, CROP_TIER_LABELS, CROPS, PERSISTENT_REGROW_MULTIPLIER, SEED_STOCK_CYCLE_MS } from "../gameData";
import { growSpeedMultiplier, isUnlocked, sellMultiplier } from "../derived";
import type { PlayerState } from "../types";
import { socket } from "../socket";
import CropIcon from "./CropIcon";

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function SeedShopView({ player, now }: { player: PlayerState; now: number }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const growMult = growSpeedMultiplier(player);
  const sellMult = sellMultiplier(player);
  const nextRestockAt = (Math.floor(now / SEED_STOCK_CYCLE_MS) + 1) * SEED_STOCK_CYCLE_MS;
  const restockCountdown = formatCountdown(nextRestockAt - now);

  function qty(cropId: string, stock: number) {
    return Math.min(quantities[cropId] ?? 1, Math.max(1, stock));
  }

  function setQty(cropId: string, value: number, stock: number) {
    setQuantities((q) => ({ ...q, [cropId]: Math.min(99, Math.max(1, Math.min(value, stock))) }));
  }

  function handleBuy(cropId: string, quantity: number) {
    setError(null);
    socket.emit("buy_seed", { cropId, quantity }, (res) => {
      if (!res.ok) setError(res.error ?? "Could not buy seeds.");
    });
  }

  return (
    <div className="shop-view">
      <h2>🌱 Seed Shop</h2>
      <p className="shop-sub">Buy seeds, then plant them from an empty garden plot.</p>
      <div className="restock-banner">
        🔄 Stock refreshes in <strong>{restockCountdown}</strong>
        <span className="restock-banner-sub">Common–Epic always restock · Mythic+ only have a chance to</span>
      </div>
      {error && <p className="lobby-error">{error}</p>}
      <div className="shop-list">
        {CROPS.map((crop) => {
          const unlocked = isUnlocked(player, crop.unlockAt);
          const owned = player.seedInventory[crop.id] ?? 0;
          const regrowsSlower = !!crop.persistent && !!player.persistentUnlocked[crop.id];
          const effectiveGrow = Math.round(crop.growSeconds * growMult * (regrowsSlower ? PERSISTENT_REGROW_MULTIPLIER : 1));
          const effectiveSell = Math.round(crop.sellPrice * sellMult);
          const stock = player.seedStock[crop.id] ?? 0;
          const isRareTier = crop.tier >= 4;
          const q = qty(crop.id, stock);
          const cost = crop.seedCost * q;
          const affordable = player.coins >= cost && stock > 0;

          return (
            <div key={crop.id} className={`shop-row ${!unlocked ? "shop-row-locked" : ""}`}>
              <div className="shop-row-icon">
                <CropIcon crop={crop} size={30} />
              </div>
              <div className="shop-row-info">
                <div className="shop-row-name">
                  {crop.name}
                  <span className="size-badge" style={{ background: CROP_TIER_COLORS[crop.tier] }}>
                    {CROP_TIER_LABELS[crop.tier]}
                  </span>
                  {crop.persistent && (
                    <span className="tree-tag" title="Regrows after harvest — never consumed">
                      🌳 Persistent
                    </span>
                  )}
                  {regrowsSlower && (
                    <span
                      className="tree-tag"
                      title={`You've harvested this before, so it (and any new one you plant) now regrows at ${PERSISTENT_REGROW_MULTIPLIER}x the normal time — a one-time seed cost would otherwise print money forever.`}
                    >
                      🐌 Regrows {PERSISTENT_REGROW_MULTIPLIER}x slower
                    </span>
                  )}
                  {owned > 0 && <span className="owned-badge">own {owned}</span>}
                </div>
                {unlocked ? (
                  <div className="shop-row-stats">
                    <span>🪙 {crop.seedCost} / seed</span>
                    <span>⏱ {effectiveGrow}s to grow</span>
                    <span>💰 sells {effectiveSell}</span>
                    <span
                      className={stock > 0 ? "stock-tag stock-tag-available" : "stock-tag stock-tag-empty"}
                      title={
                        isRareTier
                          ? "Rare stock — has a chance to restock every 2 minutes"
                          : "Always restocks to full every 2 minutes"
                      }
                    >
                      {stock > 0 ? `📦 ${stock} in stock` : "📦 Out of stock"}
                      {isRareTier ? ` · next chance in ${restockCountdown}` : ` · resets in ${restockCountdown}`}
                    </span>
                  </div>
                ) : (
                  <div className="shop-row-stats">🔒 Unlocks once you've earned {crop.unlockAt} coins</div>
                )}
              </div>
              {unlocked && (
                <div className="shop-row-actions">
                  <input
                    type="number"
                    className="qty-input"
                    min={1}
                    max={Math.max(1, stock)}
                    value={q}
                    disabled={stock === 0}
                    onChange={(e) => setQty(crop.id, Number(e.target.value), stock)}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={!affordable}
                    onClick={() => handleBuy(crop.id, q)}
                  >
                    {stock === 0 ? "Out of stock" : `Buy (${cost})`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
