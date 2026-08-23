import { canPlaceAt } from "../derived";
import { getCropDef, MOON_CROPS_BY_ID, possibleFootprints } from "../moonData";
import type { PlayerState } from "../types";
import { socket } from "../socket";
import CropIcon from "./CropIcon";

export default function PlantPickerModal({
  player,
  x,
  y,
  onClose,
}: {
  player: PlayerState;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const owned = Object.entries(player.seedInventory).filter(([, count]) => count > 0);

  function handlePlant(cropId: string) {
    socket.emit("plant", { x, y, cropId }, () => onClose());
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Plant a seed</h2>
        {owned.length === 0 ? (
          <p className="modal-empty">You have no seeds yet. Visit the Seed Shop first!</p>
        ) : (
          <div className="seed-picker-list">
            {owned.map(([cropId, count]) => {
              const crop = getCropDef(cropId);
              if (!crop) return null;
              const variable = MOON_CROPS_BY_ID[cropId]?.variableFootprint;
              const fits = possibleFootprints(cropId, crop.footprint).some((fp) =>
                canPlaceAt(player, x, y, fp.w, fp.h),
              );
              return (
                <button
                  key={cropId}
                  className="seed-picker-item"
                  disabled={!fits}
                  title={fits ? undefined : "Won't fit here"}
                  onClick={() => handlePlant(cropId)}
                >
                  <CropIcon crop={crop} size={26} />
                  <span className="seed-picker-name">
                    {crop.name}
                    <span className="seed-picker-footprint">
                      {variable ? "2x1/1x2" : `${crop.footprint.w}x${crop.footprint.h}`}
                    </span>
                  </span>
                  <span className="seed-picker-count">{fits ? `x${count}` : "won't fit"}</span>
                </button>
              );
            })}
          </div>
        )}
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
