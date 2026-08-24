import { GROW_SPEED_FLOOR, INCUBATOR_SPEED_FLOOR } from "../gameData";
import { growSpeedInfo, incubatorSpeedInfo, sellMultiplier } from "../derived";
import type { PlayerState } from "../types";

const MAX_SPEED_FACTOR = 1 / GROW_SPEED_FLOOR;
const MAX_INCUBATOR_FACTOR = 1 / INCUBATOR_SPEED_FLOOR;

/** Shown on both the Pet Shop and Gear Shop — the two places these bonuses come from — so the
 *  current stacked totals (and whether Grow Speed is maxed out) are visible wherever a player
 *  might go looking to improve them. Sell Price has no cap, unlike Grow Speed. Incubator Speed
 *  (Bunny/Owl only — no gear source) is Pet Shop-only, since Gear Shop has nothing that affects it. */
export default function GrowSpeedBanner({ player, showIncubatorSpeed }: { player: PlayerState; showIncubatorSpeed?: boolean }) {
  const { speedFactor, capped } = growSpeedInfo(player);
  const sellBonusPct = Math.round((sellMultiplier(player) - 1) * 100);
  const incubator = showIncubatorSpeed ? incubatorSpeedInfo(player) : undefined;
  return (
    <>
      <div className="restock-banner">
        <span>
          ⏩ Growth Speed: <strong>{speedFactor.toFixed(1)}x faster</strong>
        </span>
        {capped && (
          <span
            className="size-badge"
            style={{ background: "#e0602a" }}
            title={`Maxed out — crops can never grow faster than ${MAX_SPEED_FACTOR}x normal speed, no matter how much more Grow Speed gear or pets you stack.`}
          >
            ⚠️ Maxed at {MAX_SPEED_FACTOR}x
          </span>
        )}
      </div>
      <div className="restock-banner">
        <span>
          💰 Sell Price: <strong>+{sellBonusPct}%</strong>
        </span>
      </div>
      {incubator && (
        <div className="restock-banner">
          <span>
            🥚 Incubator Speed: <strong>{incubator.speedFactor.toFixed(1)}x faster</strong>
          </span>
          {incubator.capped && (
            <span
              className="size-badge"
              style={{ background: "#e0602a" }}
              title={`Maxed out — merges can never finish faster than ${MAX_INCUBATOR_FACTOR}x normal speed, no matter how many more Bunnies/Owls you equip.`}
            >
              ⚠️ Maxed at {MAX_INCUBATOR_FACTOR}x
            </span>
          )}
        </div>
      )}
    </>
  );
}
