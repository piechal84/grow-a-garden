import { useState } from "react";
import { CROPS_BY_ID, SIZE_COLORS } from "../gameData";
import { MOON_CROPS_BY_ID, MOON_TIER_TO_CROP_TIER } from "../moonData";
import {
  formatPetEffect,
  PET_SIZES,
  PET_SIZE_LABELS,
  PETS_BY_ID,
  petSpecialAbility,
  petSpecialAbilityBadge,
  type Pet,
  type PetSize,
} from "../petData";
import { getAnyCropDef as getCropDef, SOLAR_CROPS_BY_ID, SOLAR_TIER_TO_CROP_TIER } from "../solarData";
import { socket } from "../socket";
import type { PlayerState } from "../types";
import { MUTATIONS, mutationKey, type MutationId } from "../weather";
import CropIcon from "./CropIcon";
import PetIcon from "./PetIcon";
import PetTierBadge from "./PetTierBadge";

function sortRank(cropId: string): number {
  const normal = CROPS_BY_ID[cropId];
  if (normal) return normal.tier;
  const moon = MOON_CROPS_BY_ID[cropId];
  if (moon) return MOON_TIER_TO_CROP_TIER[moon.tier];
  const solar = SOLAR_CROPS_BY_ID[cropId];
  if (solar) return SOLAR_TIER_TO_CROP_TIER[solar.tier];
  return 999;
}

interface HarvestGroup {
  cropId: string;
  sizeLabel: string;
  mutations: MutationId[];
  count: number;
}

export default function InventoryView({ player }: { player: PlayerState }) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [petError, setPetError] = useState<string | null>(null);

  function handleToggleEquip(petId: string, size: PetSize, isEquipped: boolean) {
    setPetError(null);
    setBusyKey(`${petId}#${size}`);
    const event = isEquipped ? "unequip_pet" : "equip_pet";
    socket.emit(event, { petId, size }, (res) => {
      setBusyKey(null);
      if (!res.ok) setPetError(res.error ?? "Could not update pet.");
    });
  }

  const seedEntries = Object.entries(player.seedInventory)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => sortRank(a) - sortRank(b));

  const harvestGroups = new Map<string, HarvestGroup>();
  for (const item of player.cropInventory) {
    const key = `${item.cropId}:${item.sizeLabel}:${mutationKey(item.mutations)}`;
    const existing = harvestGroups.get(key);
    if (existing) existing.count += 1;
    else harvestGroups.set(key, { cropId: item.cropId, sizeLabel: item.sizeLabel, mutations: item.mutations, count: 1 });
  }
  const sortedHarvest = Array.from(harvestGroups.values()).sort((a, b) => sortRank(a.cropId) - sortRank(b.cropId));

  const petGroups: { petId: string; size: PetSize; count: number; pet: Pet }[] = [];
  for (const [petId, sizes] of Object.entries(player.petsOwned)) {
    const pet = PETS_BY_ID[petId];
    if (!pet) continue;
    for (const size of PET_SIZES) {
      const count = sizes[size] ?? 0;
      if (count > 0) petGroups.push({ petId, size, count, pet });
    }
  }
  petGroups.sort((a, b) => b.pet.tier - a.pet.tier || b.count - a.count);
  const equipped = new Set(player.petsEquipped);

  return (
    <div className="shop-view">
      <h2>🎒 Inventory</h2>
      <p className="shop-sub">Every seed, harvested crop, and pet you're currently holding.</p>

      <h3 className="inventory-section-title">🌱 Seeds ({seedEntries.reduce((sum, [, c]) => sum + c, 0)})</h3>
      {seedEntries.length === 0 ? (
        <p className="modal-empty">No seeds yet — visit a seed shop.</p>
      ) : (
        <div className="inventory-grid">
          {seedEntries.map(([cropId, count]) => {
            const crop = getCropDef(cropId);
            if (!crop) return null;
            return (
              <div key={cropId} className="inventory-tile" title={crop.name}>
                <span className="inventory-count">{count}</span>
                <CropIcon crop={crop} size={32} />
                <span className="inventory-tile-name">{crop.name}</span>
              </div>
            );
          })}
        </div>
      )}

      <h3 className="inventory-section-title">
        🧺 Harvested Crops ({sortedHarvest.reduce((sum, g) => sum + g.count, 0)})
      </h3>
      {sortedHarvest.length === 0 ? (
        <p className="modal-empty">Nothing harvested yet — go pick some crops!</p>
      ) : (
        <div className="inventory-grid">
          {sortedHarvest.map((g) => {
            const crop = getCropDef(g.cropId);
            if (!crop) return null;
            const key = `${g.cropId}:${g.sizeLabel}:${mutationKey(g.mutations)}`;
            return (
              <div key={key} className="inventory-tile" title={`${crop.name} (${g.sizeLabel})`}>
                <span className="inventory-count">{g.count}</span>
                <CropIcon crop={crop} size={32} />
                <span className="inventory-tile-name">{crop.name}</span>
                <div className="inventory-tile-badges">
                  <span className="size-badge" style={{ background: SIZE_COLORS[g.sizeLabel] }}>
                    {g.sizeLabel}
                  </span>
                  {g.mutations.map((m) => (
                    <span key={m} className="size-badge" style={{ background: MUTATIONS[m].color }} title={MUTATIONS[m].label}>
                      {MUTATIONS[m].emoji}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3 className="inventory-section-title">
        🐾 Pets ({petGroups.reduce((sum, g) => sum + g.count, 0)}) — {equipped.size}/{player.petSlots} slots used
      </h3>
      {petError && <p className="lobby-error">{petError}</p>}
      {petGroups.length === 0 ? (
        <p className="modal-empty">No pets yet — visit the Pet Shop.</p>
      ) : (
        <div className="inventory-grid">
          {petGroups.map(({ petId, size, count, pet }) => {
            const key = `${petId}#${size}`;
            const isEquipped = equipped.has(key);
            const stage = pet.id.includes("_tenacious") ? "tenacious" : pet.id.includes("_empowered") ? "empowered" : undefined;
            const special = petSpecialAbility(petId);
            return (
              <div
                key={key}
                className={`inventory-tile ${stage ? `pet-aura-${stage}` : ""}`}
                title={`${pet.name} (${PET_SIZE_LABELS[size]}) — ${formatPetEffect(pet, size)}${special ? `. ${special}` : ""}`}
              >
                <span className="inventory-count">x{count}</span>
                <PetIcon pet={pet} size={32} />
                <span className="inventory-tile-name">{pet.name}</span>
                <span className="pet-effect-label">{formatPetEffect(pet, size)}</span>
                {special && <span className="pet-special-label">{petSpecialAbilityBadge(petId)}</span>}
                <div className="inventory-tile-badges">
                  <PetTierBadge tier={pet.tier} />
                  <span className="size-badge" style={{ background: "#5c6b56" }}>
                    {PET_SIZE_LABELS[size]}
                  </span>
                </div>
                <button
                  className={`btn ${isEquipped ? "btn-secondary" : "btn-primary"} pet-equip-btn`}
                  disabled={busyKey === key || (!isEquipped && equipped.size >= player.petSlots)}
                  onClick={() => handleToggleEquip(petId, size, isEquipped)}
                >
                  {isEquipped ? "Unequip" : "Equip"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
