import { useEffect, useState } from "react";

/** Roughly where the blade's tip sits within the 32x32 source frame — offsetting the rendered
 *  image by this amount keeps the tip aligned under the actual pointer position, the same way a
 *  native cursor's hotspot works. */
const HOTSPOT_X = 18;
const HOTSPOT_Y = 7;

/** Browsers only ever show the first frame of an animated image used via the CSS `cursor`
 *  property — there's no way around that in CSS. This fakes a genuinely animated cursor instead:
 *  .stud-harvestable sets `cursor: none`, and this tracks the mouse while it's over any
 *  harvestable stud, rendering the real animated GIF at the pointer position. Mounted once,
 *  globally — pointer-events:none on the image itself so it never steals hover/click from the
 *  crop underneath it. */
export default function HarvestCursorFollower() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".stud-harvestable")) {
        setPos({ x: e.clientX, y: e.clientY });
      } else {
        setPos(null);
      }
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  if (!pos) return null;

  return (
    <img
      src="/images/cursor/harvest-scythe.gif"
      alt=""
      aria-hidden="true"
      className="harvest-cursor-follower"
      style={{ left: pos.x - HOTSPOT_X, top: pos.y - HOTSPOT_Y }}
    />
  );
}
