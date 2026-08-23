import { useState } from "react";
import { CROP_TIER_COLORS, CROP_TIER_LABELS, CROPS } from "../gameData";
import { growSpeedMultiplier, isUnlocked, sellMultiplier } from "../derived";
import type { PlayerState } from "../types";
import { socket } from "../socket";
import CropIcon from "./CropIcon";

export default function SeedShopView({ player }: { player: PlayerState }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const growMult = growSpeedMultiplier(player);
  const sellMult = sellMultiplier(player);

  function qty(cropId: string) {
    return quantities[cropId] ?? 1;
  }

  function setQty(cropId: string, value: number) {
    setQuantities((q) => ({ ...q, [cropId]: Math.min(99, Math.max(1, value)) }));
  }

  function handleBuy(cropId: string) {
    setError(null);
    socket.emit("buy_seed", { cropId, quantity: qty(cropId) }, (res) => {
      if (!res.ok) setError(res.error ?? "Could not buy seeds.");
    });
  }

  return (
    <div className="shop-view">
      <h2>🌱 Seed Shop</h2>
      <p className="shop-sub">Buy seeds, then plant them from an empty garden plot.</p>
      {error && <p className="lobby-error">{error}</p>}
      <div className="shop-list">
        {CROPS.map((crop) => {
          const unlocked = isUnlocked(player, crop.unlockAt);
          const owned = player.seedInventory[crop.id] ?? 0;
          const effectiveGrow = Math.round(crop.growSeconds * growMult);
          const effectiveSell = Math.round(crop.sellPrice * sellMult);
          const cost = crop.seedCost * qty(crop.id);
          const affordable = player.coins >= cost;

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
                  {owned > 0 && <span className="owned-badge">own {owned}</span>}
                </div>
                {unlocked ? (
                  <div className="shop-row-stats">
                    <span>🪙 {crop.seedCost} / seed</span>
                    <span>⏱ {effectiveGrow}s to grow</span>
                    <span>💰 sells {effectiveSell}</span>
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
                    max={99}
                    value={qty(crop.id)}
                    onChange={(e) => setQty(crop.id, Number(e.target.value))}
                  />
                  <button className="btn btn-primary" disabled={!affordable} onClick={() => handleBuy(crop.id)}>
                    Buy ({cost})
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
