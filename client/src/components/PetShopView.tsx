import { useState } from "react";
import { CROP_TIER_COLORS, CROP_TIER_LABELS } from "../gameData";
import {
  formatPetEffect,
  MAX_PET_SLOTS,
  nextPetSlotCost,
  parseSlotKey,
  PET_EFFECT_LABELS,
  PET_EGGS,
  petEffectValue,
  PET_SIZE_LABELS,
  PET_SIZES,
  PETS_BY_ID,
  petSpecialAbility,
  petSpecialAbilityBadge,
  type Pet,
  type PetSize,
} from "../petData";
import type { PetEggAck, PetEggBulkAck, PetHatchOutcome, PlayerState } from "../types";
import { socket } from "../socket";
import GrowSpeedBanner from "./GrowSpeedBanner";
import PetIcon from "./PetIcon";

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
  count: number;
}

interface OwnedGroup {
  petId: string;
  size: PetSize;
  count: number;
  pet: Pet;
}

export default function PetShopView({ player }: { player: PlayerState }) {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [lastHatch, setLastHatch] = useState<HatchMessage | null>(null);
  const [bulkResults, setBulkResults] = useState<PetHatchOutcome[] | null>(null);

  const equipped = new Set(player.petsEquipped);
  const slotCost = nextPetSlotCost(player.petSlots);
  const incubatorsOwned = player.gearOwned["kelka_incubator"] ?? 0;

  const groups: OwnedGroup[] = [];
  for (const [petId, sizes] of Object.entries(player.petsOwned)) {
    const pet = PETS_BY_ID[petId];
    if (!pet) continue;
    for (const size of PET_SIZES) {
      const count = sizes[size] ?? 0;
      if (count > 0) groups.push({ petId, size, count, pet });
    }
  }
  groups.sort((a, b) => b.pet.tier - a.pet.tier || b.count - a.count);
  const unequippedGroups = groups.filter((g) => !equipped.has(`${g.petId}#${g.size}`));

  const equippedList = player.petsEquipped
    .map((key) => {
      const { petId, size } = parseSlotKey(key);
      const pet = PETS_BY_ID[petId];
      return pet ? { key, petId, size, pet } : undefined;
    })
    .filter((e): e is { key: string; petId: string; size: PetSize; pet: Pet } => !!e)
    .sort((a, b) => b.pet.tier - a.pet.tier);
  const emptySlotCount = Math.max(0, player.petSlots - equippedList.length);

  function handleOpenEgg(eggId: string) {
    setError(null);
    setOpening(eggId);
    socket.emit("buy_pet_egg", { eggId }, (res: PetEggAck) => {
      setOpening(null);
      if (!res.ok || !res.petId || !res.size || res.count === undefined) {
        setError(res.error ?? "Could not open egg.");
        return;
      }
      setBulkResults(null);
      setLastHatch({ petId: res.petId, size: res.size, count: res.count });
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

  function handleToggleEquip(petId: string, size: PetSize, isEquipped: boolean) {
    setError(null);
    setBusyKey(`${petId}#${size}`);
    const event = isEquipped ? "unequip_pet" : "equip_pet";
    socket.emit(event, { petId, size }, (res) => {
      setBusyKey(null);
      if (!res.ok) setError(res.error ?? "Could not update pet.");
    });
  }

  /** Fills only the currently-open slots (never touches what's already equipped) with the
   *  player's strongest owned-but-unequipped pets of the given effect type, best value first. */
  function handleAutoFillBest(effectType: Pet["effect"]["type"]) {
    const openSlots = player.petSlots - equipped.size;
    if (openSlots <= 0) return;
    const best = unequippedGroups
      .filter((g) => g.pet.effect.type === effectType)
      .sort((a, b) => petEffectValue(b.pet, b.size) - petEffectValue(a.pet, a.size))
      .slice(0, openSlots);
    if (best.length === 0) {
      setError(`No owned ${PET_EFFECT_LABELS[effectType]} pets to add.`);
      return;
    }
    setError(null);
    for (const { petId, size } of best) {
      socket.emit("equip_pet", { petId, size }, (res) => {
        if (!res.ok) setError(res.error ?? "Could not equip pet.");
      });
    }
  }

  function handleUnequipAll() {
    if (equippedList.length === 0) return;
    setError(null);
    for (const { petId, size } of equippedList) {
      socket.emit("unequip_pet", { petId, size }, (res) => {
        if (!res.ok) setError(res.error ?? "Could not unequip pet.");
      });
    }
  }

  const hatchPet = lastHatch ? PETS_BY_ID[lastHatch.petId] : undefined;
  const bulkBest = bulkResults && bulkResults.length > 0 ? bestOf(bulkResults) : undefined;

  return (
    <div className="shop-view">
      <h2>🐾 Pet Shop</h2>
      <p className="shop-sub">
        Hatch pets from eggs — better eggs favor rarer pets. Each pet also hatches Normal, Big, or Giant. Duplicates
        stack: gather 4 identical pets (same pet, same size) and feed them to a planted Kelka Egg Incubator (Gear
        Shop) to merge them into a stronger evolved form.
      </p>
      <p className="shop-sub">
        Every equipped pet passively boosts ⏩ Grow Speed (crops finish faster), 💰 Sell Price (crops sell for more),
        or 🥚 Incubator Speed (merges finish faster — Bunny and Owl only) — bonuses stack across all equipped pets.
        Big and Giant sizes multiply the bonus (1.5x / 2.5x), and merging into Empowered / Tenacious forms multiplies
        it further (2.5x / 5x).
      </p>
      {error && <p className="lobby-error">{error}</p>}

      <GrowSpeedBanner player={player} showIncubatorSpeed />

      <div className="restock-banner">
        <span>
          🎪 Pet Slots: <strong>{equipped.size}</strong>/{player.petSlots} used (max {MAX_PET_SLOTS})
        </span>
        {slotCost ? (
          <button className="btn btn-secondary" onClick={handleBuySlot}>
            Expand ({formatPrice(slotCost)})
          </button>
        ) : (
          <span className="plot-ready-tag">Maxed</span>
        )}
        <button
          className="btn btn-secondary"
          disabled={emptySlotCount === 0}
          title="Fill open slots with your best owned Grow Speed pets"
          onClick={() => handleAutoFillBest("growSpeed")}
        >
          ⏩ Best Growth
        </button>
        <button
          className="btn btn-secondary"
          disabled={emptySlotCount === 0}
          title="Fill open slots with your best owned Sell Price pets"
          onClick={() => handleAutoFillBest("sellBonus")}
        >
          💰 Best Sell
        </button>
        <button
          className="btn btn-secondary"
          disabled={emptySlotCount === 0}
          title="Fill open slots with your best owned Incubator Speed pets (Bunny/Owl)"
          onClick={() => handleAutoFillBest("incubatorSpeed")}
        >
          🥚 Best Incubator
        </button>
        <button
          className="btn btn-secondary"
          disabled={equippedList.length === 0}
          title="Unequip every pet in your slots"
          onClick={handleUnequipAll}
        >
          🚫 Unequip All
        </button>
      </div>

      <div className="inventory-grid">
        {equippedList.map(({ key, petId, size, pet }) => {
          const stage = pet.id.includes("_tenacious") ? "tenacious" : pet.id.includes("_empowered") ? "empowered" : undefined;
          const special = petSpecialAbility(petId);
          return (
            <div
              key={key}
              className={`inventory-tile ${stage ? `pet-aura-${stage}` : ""}`}
              title={`${pet.name} (${PET_SIZE_LABELS[size]}) — ${formatPetEffect(pet, size)}${special ? `. ${special}` : ""}`}
            >
              <PetIcon pet={pet} size={32} />
              <span className="inventory-tile-name">{pet.name}</span>
              <span className="pet-effect-label">{formatPetEffect(pet, size)}</span>
              {special && <span className="pet-special-label">{petSpecialAbilityBadge(petId)}</span>}
              <div className="inventory-tile-badges">
                <span className="size-badge" style={{ background: CROP_TIER_COLORS[pet.tier] }}>
                  {CROP_TIER_LABELS[pet.tier]}
                </span>
                <span className="size-badge" style={{ background: "#5c6b56" }}>
                  {PET_SIZE_LABELS[size]}
                </span>
              </div>
              <button
                className="btn btn-secondary pet-equip-btn"
                disabled={busyKey === key}
                onClick={() => handleToggleEquip(petId, size, true)}
              >
                Unequip
              </button>
            </div>
          );
        })}
        {Array.from({ length: emptySlotCount }, (_, i) => (
          <div key={`empty-${i}`} className="inventory-tile pet-slot-empty">
            <span style={{ fontSize: 32 }}>➕</span>
            <span className="inventory-tile-name">Empty slot</span>
          </div>
        ))}
      </div>

      <div className="restock-banner">
        <span>
          🥚 Kelka Egg Incubators: <strong>{player.incubators.length}</strong>/{incubatorsOwned || 0} placed
        </span>
        <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>
          {incubatorsOwned === 0
            ? "Buy one from the Gear Shop, then plant it on a 3x3 clearing in your garden."
            : "Plant it on a 3x3 clearing in your garden to start merging."}
        </span>
      </div>

      <h3 className="inventory-section-title">
        Your Pets ({unequippedGroups.reduce((sum, g) => sum + g.count, 0)}) — tap Equip to fill an open slot above
      </h3>
      {groups.length === 0 ? (
        <p className="modal-empty">No pets yet — open an egg below!</p>
      ) : unequippedGroups.length === 0 ? (
        <p className="modal-empty">Everything you own is equipped — nice.</p>
      ) : (
        <div className="inventory-grid">
          {unequippedGroups.map(({ petId, size, count, pet }) => {
            const key = `${petId}#${size}`;
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
                  <span className="size-badge" style={{ background: CROP_TIER_COLORS[pet.tier] }}>
                    {CROP_TIER_LABELS[pet.tier]}
                  </span>
                  <span className="size-badge" style={{ background: "#5c6b56" }}>
                    {PET_SIZE_LABELS[size]}
                  </span>
                </div>
                <button
                  className="btn btn-primary pet-equip-btn"
                  disabled={busyKey === key || equipped.size >= player.petSlots}
                  onClick={() => handleToggleEquip(petId, size, false)}
                >
                  Equip
                </button>
              </div>
            );
          })}
        </div>
      )}

      {hatchPet && lastHatch && (
        <div className="pet-hatch-reveal" style={{ borderColor: CROP_TIER_COLORS[hatchPet.tier] }}>
          <span className="pet-hatch-emoji">
            <PetIcon pet={hatchPet} size={40} />
          </span>
          <div>
            <div className="pet-hatch-title">
              {hatchPet.name} — {PET_SIZE_LABELS[lastHatch.size]}
            </div>
            <div className="pet-hatch-sub" style={{ color: CROP_TIER_COLORS[hatchPet.tier] }}>
              {CROP_TIER_LABELS[hatchPet.tier]} — you now have {lastHatch.count}
            </div>
            <div className="pet-effect-label" style={{ textAlign: "left" }}>
              {formatPetEffect(hatchPet, lastHatch.size)}
            </div>
          </div>
        </div>
      )}

      {bulkResults && bulkBest && (
        <div className="pet-hatch-reveal" style={{ borderColor: CROP_TIER_COLORS[bulkBest.tier] }}>
          <span className="pet-hatch-emoji">
            <PetIcon pet={bulkBest} size={40} />
          </span>
          <div style={{ flex: 1 }}>
            <div className="pet-hatch-title">10 eggs opened — best pull: {bulkBest.name}</div>
            <div className="inventory-grid" style={{ marginTop: 8 }}>
              {bulkResults.map((r, i) => {
                const pet = PETS_BY_ID[r.petId];
                return (
                  <div
                    key={i}
                    className="inventory-tile"
                    title={`${pet.name} (${PET_SIZE_LABELS[r.size]}) — ${formatPetEffect(pet, r.size)}`}
                  >
                    <span className="inventory-count">x{r.count}</span>
                    <PetIcon pet={pet} size={26} />
                    <span className="pet-effect-label">{formatPetEffect(pet, r.size)}</span>
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
    </div>
  );
}
