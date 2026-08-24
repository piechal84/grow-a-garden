import { useState } from "react";
import { CROP_TIER_COLORS, CROP_TIER_LABELS } from "../gameData";
import { PETS } from "../petData";
import type { PlayerState } from "../types";
import { socket } from "../socket";

function formatPct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
}

export default function PetShopView({ player }: { player: PlayerState }) {
  const [error, setError] = useState<string | null>(null);

  function handleBuy(petId: string) {
    setError(null);
    socket.emit("buy_pet", { petId }, (res) => {
      if (!res.ok) setError(res.error ?? "Could not buy pet.");
    });
  }

  return (
    <div className="shop-view">
      <h2>🐾 Pet Shop</h2>
      <p className="shop-sub">
        Adopt a companion — each pet you own passively boosts your garden forever, and your best one follows you
        around the map.
      </p>
      {error && <p className="lobby-error">{error}</p>}
      <div className="shop-list">
        {PETS.map((pet) => {
          const owned = player.petsOwned.includes(pet.id);
          const affordable = player.coins >= pet.cost.coins && player.diamonds >= pet.cost.diamonds;
          const effectLabel =
            pet.effect.type === "growSpeed"
              ? `${formatPct(pet.effect.value)} faster grow time`
              : `${formatPct(pet.effect.value)} higher sale price`;

          return (
            <div key={pet.id} className="shop-row">
              <div className="shop-row-icon">
                <span style={{ fontSize: 30 }}>{pet.emoji}</span>
              </div>
              <div className="shop-row-info">
                <div className="shop-row-name">
                  {pet.name}
                  <span className="size-badge" style={{ background: CROP_TIER_COLORS[pet.tier] }}>
                    {CROP_TIER_LABELS[pet.tier]}
                  </span>
                </div>
                <div className="shop-row-stats">Passively grants {effectLabel}.</div>
              </div>
              <div className="shop-row-actions">
                {owned ? (
                  <span className="plot-ready-tag">Owned</span>
                ) : (
                  <button className="btn btn-primary" disabled={!affordable} onClick={() => handleBuy(pet.id)}>
                    Buy (
                    {pet.cost.diamonds > 0
                      ? pet.cost.coins > 0
                        ? `${pet.cost.coins} + 💎${pet.cost.diamonds}`
                        : `💎${pet.cost.diamonds}`
                      : pet.cost.coins}
                    )
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
