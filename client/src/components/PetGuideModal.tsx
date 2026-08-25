import { createPortal } from "react-dom";
import { evolutionInfo, formatPetEffect, PETS, petSpecialAbility, type PetSize } from "../petData";
import PetIcon from "./PetIcon";
import PetTierBadge from "./PetTierBadge";

const GUIDE_SIZE: PetSize = "normal";

/** Every base (stage-0) species, in the same tier order they hatch in — Empowered/Tenacious
 *  forms aren't listed separately since they're the same ability at a bigger number, already
 *  explained by the "multiplies further" line in the Pet Shop's own intro text. */
const BASE_SPECIES = PETS.filter((p) => evolutionInfo(p.id).stage === 0).sort((a, b) => a.tier - b.tier);

/** A reference list of every pet species and what its passive actually does — opened from the
 *  Pet Shop's "?" button so a player can check an ability without having hatched that pet yet. */
export default function PetGuideModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-shop" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2>📖 Pet Guide</h2>
        <p className="shop-sub">
          Every pet species and what its passive does. Big/Giant sizes multiply the effect (1.5x / 2.5x), and merging
          into Empowered/Tenacious forms multiplies it further (2.5x / 5x) — shown here at Normal size, base form.
        </p>
        <div className="shop-list">
          {BASE_SPECIES.map((pet) => {
            const special = petSpecialAbility(pet.id);
            return (
              <div key={pet.id} className="shop-row">
                <div className="shop-row-icon">
                  <PetIcon pet={pet} size={34} />
                </div>
                <div className="shop-row-info">
                  <div className="shop-row-name">
                    {pet.name}
                    <PetTierBadge tier={pet.tier} />
                  </div>
                  <div className="shop-row-stats">
                    <span className="pet-effect-label">{formatPetEffect(pet, GUIDE_SIZE)}</span>
                  </div>
                  {special && <div className="shop-row-stats">{special}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
