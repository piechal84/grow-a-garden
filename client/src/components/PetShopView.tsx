import { useState } from "react";
import { CROP_TIER_COLORS, CROP_TIER_LABELS } from "../gameData";
import { equippedPetIds, MAX_PET_SLOTS, nextPetSlotCost, PET_EGGS, PET_SIZE_LABELS, PETS_BY_ID, type Pet, type PetSize } from "../petData";
import type { PetEggAck, PetEggBulkAck, PetHatchOutcome, PlayerState } from "../types";
import { socket } from "../socket";

const BULK_EGG_COUNT = 10;
const BULK_EGG_DISCOUNT = 0.1;

function formatPct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
}

function formatPrice(cost: { coins: number; diamonds: number }): string {
  if (cost.diamonds > 0) return cost.coins > 0 ? `${cost.coins} + 💎${cost.diamonds}` : `💎${cost.diamonds}`;
  return `${cost.coins}`;
}

function bulkCost(cost: { coins: number; diamonds: number }): { coins: number; diamonds: number } {
  return {
    coins: Math.round(cost.coins * BULK_EGG_COUNT * (1 - BULK_EGG_DISCOUNT)),
    diamonds: Math.round(cost.diamonds * BULK_EGG_COUNT * (1 - BULK_EGG_DISCOUNT)),
  };
}

function bestOf(results: PetHatchOutcome[]): Pet {
  return results.map((r) => PETS_BY_ID[r.petId]).reduce((best, p) => (p.tier > best.tier ? p : best));
}

interface HatchMessage {
  petId: string;
  size: PetSize;
  isNew: boolean;
  upgraded: boolean;
}

export default function PetShopView({ player }: { player: PlayerState }) {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [lastHatch, setLastHatch] = useState<HatchMessage | null>(null);
  const [bulkResults, setBulkResults] = useState<PetHatchOutcome[] | null>(null);

  const equipped = new Set(equippedPetIds(player.petsOwned, player.petSlots));
  const slotCost = nextPetSlotCost(player.petSlots);

  function handleOpenEgg(eggId: string) {
    setError(null);
    setOpening(eggId);
    socket.emit("buy_pet_egg", { eggId }, (res: PetEggAck) => {
      setOpening(null);
      if (!res.ok || !res.petId || !res.size) {
        setError(res.error ?? "Could not open egg.");
        return;
      }
      setBulkResults(null);
      setLastHatch({ petId: res.petId, size: res.size, isNew: !!res.isNew, upgraded: !!res.upgraded });
    });
  }

  function handleOpenEggBulk(eggId: string) {
    setError(null);
    setOpening(eggId);
    socket.emit("buy_pet_egg_bulk", { eggId }, (res: PetEggBulkAck) => {
      setOpening(null);
      if (!res.ok || !res.results) {
        setError(res.error ?? "Could not open eggs.");
        return;
      }
      setLastHatch(null);
      setBulkResults(res.results);
    });
  }

  function handleBuySlot() {
    setError(null);
    socket.emit("buy_pet_slot", (res) => {
      if (!res.ok) setError(res.error ?? "Could not buy pet slot.");
    });
  }

  const hatchPet = lastHatch ? PETS_BY_ID[lastHatch.petId] : undefined;
  const bulkBest = bulkResults && bulkResults.length > 0 ? bestOf(bulkResults) : undefined;

  return (
    <div className="shop-view">
      <h2>🐾 Pet Shop</h2>
      <p className="shop-sub">
        Hatch pets from eggs — better eggs favor rarer pets. Each pet also hatches Normal, Big, or Giant, and bigger
        is always better. Your best pets (by rarity) auto-equip into your slots — no manual equipping needed.
      </p>
      {error && <p className="lobby-error">{error}</p>}

      <div className="restock-banner">
        <span>
          🎪 Pet Slots: <strong>{player.petSlots}</strong>/{MAX_PET_SLOTS}
        </span>
        {slotCost ? (
          <button className="btn btn-secondary" onClick={handleBuySlot}>
            Expand ({formatPrice(slotCost)})
          </button>
        ) : (
          <span className="plot-ready-tag">Maxed</span>
        )}
      </div>

      {hatchPet && lastHatch && (
        <div className="pet-hatch-reveal" style={{ borderColor: CROP_TIER_COLORS[hatchPet.tier] }}>
          <span className="pet-hatch-emoji">{hatchPet.emoji}</span>
          <div>
            <div className="pet-hatch-title">
              {lastHatch.isNew ? "New pet!" : lastHatch.upgraded ? "Upgraded!" : "Already owned"} {hatchPet.name} —{" "}
              {PET_SIZE_LABELS[lastHatch.size]}
            </div>
            <div className="pet-hatch-sub" style={{ color: CROP_TIER_COLORS[hatchPet.tier] }}>
              {CROP_TIER_LABELS[hatchPet.tier]}
              {!lastHatch.isNew && !lastHatch.upgraded && " — no upgrade this time"}
            </div>
          </div>
        </div>
      )}

      {bulkResults && bulkBest && (
        <div className="pet-hatch-reveal" style={{ borderColor: CROP_TIER_COLORS[bulkBest.tier] }}>
          <span className="pet-hatch-emoji">{bulkBest.emoji}</span>
          <div style={{ flex: 1 }}>
            <div className="pet-hatch-title">10 eggs opened — best pull: {bulkBest.name}</div>
            <div className="inventory-grid" style={{ marginTop: 8 }}>
              {bulkResults.map((r, i) => {
                const pet = PETS_BY_ID[r.petId];
                return (
                  <div key={i} className="inventory-tile" title={`${pet.name} (${PET_SIZE_LABELS[r.size]})`}>
                    <span className="inventory-count">{r.isNew ? "New" : r.upgraded ? "Up" : "—"}</span>
                    <span style={{ fontSize: 26 }}>{pet.emoji}</span>
                    <div className="inventory-tile-badges">
                      <span className="size-badge" style={{ background: CROP_TIER_COLORS[pet.tier] }}>
                        {CROP_TIER_LABELS[pet.tier]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <h3 className="inventory-section-title">Eggs</h3>
      <div className="shop-list">
        {PET_EGGS.map((egg) => {
          const affordable = player.coins >= egg.cost.coins && player.diamonds >= egg.cost.diamonds;
          return (
            <div key={egg.id} className="shop-row">
              <div className="shop-row-icon">
                <span style={{ fontSize: 30 }}>{egg.emoji}</span>
              </div>
              <div className="shop-row-info">
                <div className="shop-row-name">{egg.name}</div>
                <div className="shop-row-stats">
                  {egg.odds.map((o) => (
                    <span key={o.tier} style={{ color: CROP_TIER_COLORS[o.tier] }}>
                      {CROP_TIER_LABELS[o.tier]} {formatPct(o.weight / egg.odds.reduce((s, x) => s + x.weight, 0))}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shop-row-actions">
                <button
                  className="btn btn-primary"
                  disabled={!affordable || opening === egg.id}
                  onClick={() => handleOpenEgg(egg.id)}
                >
                  {opening === egg.id ? "Opening…" : `Open (${formatPrice(egg.cost)})`}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={
                    opening === egg.id ||
                    player.coins < bulkCost(egg.cost).coins ||
                    player.diamonds < bulkCost(egg.cost).diamonds
                  }
                  onClick={() => handleOpenEggBulk(egg.id)}
                >
                  {opening === egg.id ? "Opening…" : `Open 10x (${formatPrice(bulkCost(egg.cost))})`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="inventory-section-title">Your Pets ({Object.keys(player.petsOwned).length})</h3>
      {Object.keys(player.petsOwned).length === 0 ? (
        <p className="modal-empty">No pets yet — open an egg above!</p>
      ) : (
        <div className="inventory-grid">
          {Object.entries(player.petsOwned)
            .map(([id, size]) => ({ pet: PETS_BY_ID[id], size }))
            .sort((a, b) => b.pet.tier - a.pet.tier)
            .map(({ pet, size }) => (
              <div key={pet.id} className="inventory-tile" title={`${pet.name} (${PET_SIZE_LABELS[size]})`}>
                <span className="inventory-count">{equipped.has(pet.id) ? "✓" : "—"}</span>
                <span style={{ fontSize: 32 }}>{pet.emoji}</span>
                <span className="inventory-tile-name">{pet.name}</span>
                <div className="inventory-tile-badges">
                  <span className="size-badge" style={{ background: CROP_TIER_COLORS[pet.tier] }}>
                    {CROP_TIER_LABELS[pet.tier]}
                  </span>
                  <span className="size-badge" style={{ background: "#5c6b56" }}>
                    {PET_SIZE_LABELS[size]}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
