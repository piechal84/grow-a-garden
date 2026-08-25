/** Charged mutation — an electric current visibly charging the whole plot slot (not just a
 *  colored halo on the plant): a double pulsing ring around the full slot's edge plus a few
 *  lightning bolts sparking in and out at the corners. Rendered as a sibling of GrowthPlant
 *  directly inside PlotView's `.stud-planted` div (which is sized to the exact footprint), since
 *  GrowthPlant's own wrapper is a small fixed-height box centered for the plant icon, not the
 *  full slot. */
interface BoltSpot {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  rotate: number;
  delay: string;
}

const CHARGED_BOLTS: BoltSpot[] = [
  { top: "2%", left: "6%", rotate: -14, delay: "0s" },
  { top: "8%", right: "4%", rotate: 20, delay: "0.5s" },
  { bottom: "6%", left: "10%", rotate: 10, delay: "1s" },
  { bottom: "4%", right: "8%", rotate: -22, delay: "1.5s" },
];

export function ChargedSlotEffect() {
  return (
    <div className="charged-slot-effect" aria-hidden="true">
      <div className="charged-slot-ring" />
      <div className="charged-slot-ring charged-slot-ring-delay" />
      {CHARGED_BOLTS.map((b, i) => (
        <span
          key={i}
          className="charged-slot-bolt"
          style={{
            top: b.top,
            left: b.left,
            right: b.right,
            bottom: b.bottom,
            animationDelay: b.delay,
            rotate: `${b.rotate}deg`,
          }}
        >
          ⚡
        </span>
      ))}
    </div>
  );
}

/** Wet mutation — a few droplets forming and falling off the plant on a loop, instead of the
 *  flat colored halo the other mutations still use. Lives inside GrowthPlant (plant-attached,
 *  not full-slot) so it only appears once the crop icon itself is rendered and moves/scales with
 *  it naturally. */
export function WetDrips() {
  const drips = [
    { left: "28%", delay: "0s" },
    { left: "50%", delay: "0.6s" },
    { left: "70%", delay: "1.2s" },
  ];
  return (
    <div className="wet-drip-wrap" aria-hidden="true">
      {drips.map((d, i) => (
        <span key={i} className="wet-drip" style={{ left: d.left, animationDelay: d.delay }} />
      ))}
    </div>
  );
}
