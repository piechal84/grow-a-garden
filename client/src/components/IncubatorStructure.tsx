import { useState } from "react";
import { createPortal } from "react-dom";
import { MERGE_COUNT, nextEvolutionId, PETS_BY_ID, PET_SIZES, PET_SIZE_LABELS, type PetSize } from "../petData";
import type { IncubatorState, PlayerState } from "../types";
import { socket } from "../socket";
import { CELL_SIZE } from "../world";

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

interface Selection {
  petId: string;
  size: PetSize;
}

/** A Kelka Egg Incubator planted on the plot (3x3) — tap while idle to feed it 4 identical pets
 *  and start a merge, tap again once ready to collect the evolved result. The picker modal is
 *  portaled to <body> since the plot lives inside a zoomed/scaled container — a `transform` on
 *  an ancestor turns `position: fixed` into "fixed to that ancestor", not the real screen. */
export default function IncubatorStructure({
  incubator,
  player,
  isOwner,
  now,
}: {
  incubator: IncubatorState;
  player: PlayerState;
  isOwner: boolean;
  now: number;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const merge = incubator.merge;
  const ready = !!merge && now >= merge.readyAt;
  const targetPet = merge ? PETS_BY_ID[nextEvolutionId(merge.petId) ?? ""] : undefined;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isOwner) return;
    if (!merge) {
      setSelected(null);
      setShowPicker(true);
      return;
    }
    if (ready) {
      socket.emit("collect_pet_merge", { incubatorId: incubator.id }, (res) => {
        if (!res.ok) setError(res.error ?? "Could not collect.");
      });
    }
  }

  function handleConfirmMerge() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    socket.emit("start_pet_merge", { incubatorId: incubator.id, petId: selected.petId, size: selected.size }, (res) => {
      setSubmitting(false);
      if (!res.ok) setError(res.error ?? "Could not start merge.");
      else {
        setShowPicker(false);
        setSelected(null);
      }
    });
  }

  const groups: { petId: string; size: PetSize; count: number }[] = [];
  for (const [petId, sizes] of Object.entries(player.petsOwned)) {
    if (!nextEvolutionId(petId)) continue;
    for (const size of PET_SIZES) {
      const count = sizes[size] ?? 0;
      if (count >= MERGE_COUNT) groups.push({ petId, size, count });
    }
  }

  const selectedPet = selected ? PETS_BY_ID[selected.petId] : undefined;
  const outcomePet = selected ? PETS_BY_ID[nextEvolutionId(selected.petId)!] : undefined;

  return (
    <div
      className={`stud stud-incubator ${ready ? "incubator-ready" : ""}`}
      style={{
        left: incubator.x * CELL_SIZE,
        top: incubator.y * CELL_SIZE,
        width: 3 * CELL_SIZE,
        height: 3 * CELL_SIZE,
      }}
      onClick={handleClick}
      title={!merge ? "Tap to merge 4 identical pets" : ready ? "Tap to collect" : "Merging…"}
    >
      <span className="incubator-emoji">{ready && targetPet ? targetPet.emoji : "🥚"}</span>
      {merge && !ready && <span className="incubator-timer">{formatDuration(merge.readyAt - now)}</span>}
      {merge && ready && <span className="incubator-collect-label">Tap to collect!</span>}
      {!merge && <span className="incubator-collect-label">Merge 4 pets</span>}
      {error && (
        <div className="plot-move-error" onClick={(e) => e.stopPropagation()}>
          {error}
        </div>
      )}

      {showPicker &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={(e) => {
              e.stopPropagation();
              setShowPicker(false);
            }}
          >
            <div className="modal modal-shop" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowPicker(false)} aria-label="Close">
                ✕
              </button>
              <h2>🥚 Merge Pets</h2>
              <p className="shop-sub">Fill all 4 slots with the same pet (same pet, same size) to merge them into a stronger evolved form.</p>

              <div className="merge-slots">
                {Array.from({ length: MERGE_COUNT }, (_, i) => (
                  <button
                    key={i}
                    className={`merge-slot ${selected ? "merge-slot-filled" : ""}`}
                    onClick={() => selected && setSelected(null)}
                    title={selected ? "Tap to clear" : "Empty slot"}
                  >
                    {selectedPet ? selectedPet.emoji : "+"}
                  </button>
                ))}
              </div>

              {selected && outcomePet && (
                <div className="merge-outcome">
                  <span>Becomes</span>
                  <span className="merge-outcome-emoji">{outcomePet.emoji}</span>
                  <strong>{outcomePet.name}</strong>
                </div>
              )}

              {selected ? (
                <button className="btn btn-primary" disabled={submitting} onClick={handleConfirmMerge}>
                  {submitting ? "Merging…" : "Confirm Merge"}
                </button>
              ) : groups.length === 0 ? (
                <p className="modal-empty">You need 4 identical pets (same pet + size) to fill the slots.</p>
              ) : (
                <div className="shop-list">
                  {groups.map((g) => {
                    const pet = PETS_BY_ID[g.petId];
                    const resultPet = PETS_BY_ID[nextEvolutionId(g.petId)!];
                    return (
                      <div key={`${g.petId}#${g.size}`} className="shop-row">
                        <div className="shop-row-icon">
                          <span style={{ fontSize: 30 }}>{pet.emoji}</span>
                        </div>
                        <div className="shop-row-info">
                          <div className="shop-row-name">
                            {pet.name} ({PET_SIZE_LABELS[g.size]}) x{g.count}
                          </div>
                          <div className="shop-row-stats">Becomes {resultPet.name}</div>
                        </div>
                        <div className="shop-row-actions">
                          <button className="btn btn-primary" onClick={() => setSelected({ petId: g.petId, size: g.size })}>
                            Fill 4 Slots
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
