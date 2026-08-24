import { useState } from "react";
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

/** A Kelka Egg Incubator planted on the plot (3x3) — tap while idle to feed it 4 identical pets
 *  and start a merge, tap again once ready to collect the evolved result. */
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
  const [error, setError] = useState<string | null>(null);

  const merge = incubator.merge;
  const ready = !!merge && now >= merge.readyAt;
  const targetPet = merge ? PETS_BY_ID[nextEvolutionId(merge.petId) ?? ""] : undefined;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isOwner) return;
    if (!merge) {
      setShowPicker(true);
      return;
    }
    if (ready) {
      socket.emit("collect_pet_merge", { incubatorId: incubator.id }, (res) => {
        if (!res.ok) setError(res.error ?? "Could not collect.");
      });
    }
  }

  function handleStartMerge(petId: string, size: PetSize) {
    setError(null);
    socket.emit("start_pet_merge", { incubatorId: incubator.id, petId, size }, (res) => {
      if (!res.ok) setError(res.error ?? "Could not start merge.");
      else setShowPicker(false);
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

      {showPicker && (
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
            <p className="shop-sub">Pick 4 identical pets (same pet, same size) to merge into a stronger evolved form.</p>
            {groups.length === 0 ? (
              <p className="modal-empty">You need 4 identical pets (same pet + size) to merge.</p>
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
                        <button className="btn btn-primary" onClick={() => handleStartMerge(g.petId, g.size)}>
                          Merge 4
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
