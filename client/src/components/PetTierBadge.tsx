import { CROP_TIER_COLORS, CROP_TIER_LABELS } from "../gameData";
import { HISTORIC_TIER } from "../petData";

/** The standard small tier pill everywhere else, except Historic tier (Kitsune) gets a fancier
 *  shimmering banner instead — it's not just another rung on the ladder, it can't be hatched or
 *  rolled at all, only crafted once through a unique recipe, and the UI should say so at a
 *  glance. */
export default function PetTierBadge({ tier }: { tier: number }) {
  if (tier === HISTORIC_TIER) {
    return (
      <span className="tier-banner-historic">
        ✨ {CROP_TIER_LABELS[tier]} ✨
      </span>
    );
  }
  return (
    <span className="size-badge" style={{ background: CROP_TIER_COLORS[tier] }}>
      {CROP_TIER_LABELS[tier]}
    </span>
  );
}
