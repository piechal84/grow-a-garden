import { useState } from "react";
import { CROPS_BY_ID, SIZE_COLORS, SIZE_ORDER } from "../gameData";
import { sellMultiplier } from "../derived";
import { getCropDef, MOON_CROPS_BY_ID, MOON_TIER_ORDER } from "../moonData";
import type { PlayerState } from "../types";
import { socket } from "../socket";
import { MUTATIONS, mutationKey, type MutationId } from "../weather";
import CropIcon from "./CropIcon";

function sortRank(cropId: string): number {
  const normal = CROPS_BY_ID[cropId];
  if (normal) return normal.tier;
  const moon = MOON_CROPS_BY_ID[cropId];
  if (moon) return 100 + MOON_TIER_ORDER.indexOf(moon.tier);
  return 999;
}

interface Group {
  cropId: string;
  sizeLabel: string;
  mutations: MutationId[];
  count: number;
  unitPrice: number;
}

export default function MerchantView({ player }: { player: PlayerState }) {
  const [error, setError] = useState<string | null>(null);
  const sellMult = sellMultiplier(player);

  const groups = new Map<string, Group>();
  for (const item of player.cropInventory) {
    const crop = getCropDef(item.cropId);
    if (!crop) continue;
    const mKey = mutationKey(item.mutations);
    const key = `${item.cropId}:${item.sizeLabel}:${mKey}`;
    let mutationMult = 1;
    for (const m of item.mutations) mutationMult *= MUTATIONS[m].priceMultiplier;
    const unitPrice = Math.round(crop.sellPrice * item.sizePriceMultiplier * mutationMult * sellMult);
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { cropId: item.cropId, sizeLabel: item.sizeLabel, mutations: item.mutations, count: 1, unitPrice });
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    const cropDiff = sortRank(a.cropId) - sortRank(b.cropId);
    if (cropDiff !== 0) return cropDiff;
    const sizeDiff = SIZE_ORDER.indexOf(a.sizeLabel) - SIZE_ORDER.indexOf(b.sizeLabel);
    if (sizeDiff !== 0) return sizeDiff;
    return a.mutations.length - b.mutations.length;
  });

  function handleSell(g: Group, quantity: number | "all") {
    setError(null);
    socket.emit("sell", { cropId: g.cropId, sizeLabel: g.sizeLabel, mutations: g.mutations, quantity }, (res) => {
      if (!res.ok) setError(res.error ?? "Could not sell.");
    });
  }

  return (
    <div className="shop-view">
      <h2>🧺 Merchant</h2>
      <p className="shop-sub">Sell your harvest for coins — bigger sizes and mutations fetch a lot more.</p>
      {error && <p className="lobby-error">{error}</p>}
      {sortedGroups.length === 0 ? (
        <p className="modal-empty">Nothing harvested yet — go pick some crops!</p>
      ) : (
        <div className="shop-list">
          {sortedGroups.map((g) => {
            const crop = getCropDef(g.cropId);
            if (!crop) return null;
            return (
              <div key={`${g.cropId}:${g.sizeLabel}:${mutationKey(g.mutations)}`} className="shop-row">
                <div className="shop-row-icon">
                  <CropIcon crop={crop} size={30} />
                </div>
                <div className="shop-row-info">
                  <div className="shop-row-name">
                    {crop.name}
                    <span className="size-badge" style={{ background: SIZE_COLORS[g.sizeLabel] }}>
                      {g.sizeLabel}
                    </span>
                    {g.mutations.map((m) => (
                      <span
                        key={m}
                        className="size-badge"
                        style={{ background: MUTATIONS[m].color }}
                        title={`+${Math.round((MUTATIONS[m].priceMultiplier - 1) * 100)}% sell price`}
                      >
                        {MUTATIONS[m].emoji} {MUTATIONS[m].label}
                      </span>
                    ))}
                    <span className="owned-badge">have {g.count}</span>
                  </div>
                  <div className="shop-row-stats">🪙 {g.unitPrice} each</div>
                </div>
                <div className="shop-row-actions">
                  <button className="btn btn-secondary" onClick={() => handleSell(g, 1)}>
                    Sell 1
                  </button>
                  <button className="btn btn-primary" onClick={() => handleSell(g, "all")}>
                    Sell All ({g.unitPrice * g.count})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
