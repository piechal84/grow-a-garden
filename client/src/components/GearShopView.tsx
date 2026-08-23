import { useState } from "react";
import { GEAR, nextGearCost } from "../gameData";
import type { PlayerState } from "../types";
import { socket } from "../socket";

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
      {error && <p className="lobby-error">{error}</p>}
      <div className="shop-list">
        {GEAR.map((gear) => {
          const owned = player.gearOwned[gear.id] ?? 0;
          const maxedOut = gear.maxOwned !== undefined && owned >= gear.maxOwned;
          const alreadyOwned = !gear.repeatable && owned > 0;
          const cost = nextGearCost(gear, owned);
          const affordable = player.coins >= cost;

          return (
            <div key={gear.id} className="shop-row">
              <div className="shop-row-icon">
                <span style={{ fontSize: 30 }}>{gear.emoji}</span>
              </div>
              <div className="shop-row-info">
                <div className="shop-row-name">
                  {gear.name}
                  {owned > 0 && <span className="owned-badge">{gear.repeatable ? `x${owned}` : "owned"}</span>}
                </div>
                <div className="shop-row-stats">{gear.description}</div>
              </div>
              <div className="shop-row-actions">
                {alreadyOwned || maxedOut ? (
                  <span className="plot-ready-tag">{maxedOut ? "Maxed" : "Owned"}</span>
                ) : (
                  <button className="btn btn-primary" disabled={!affordable} onClick={() => handleBuy(gear.id)}>
                    Buy ({cost})
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
