export interface IconCrop {
  id: string;
  name: string;
  emoji: string;
}

/** Dragon fruit has no reliable emoji glyph, so it gets a hand-drawn icon. */
function DragonFruitGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <ellipse cx="24" cy="26" rx="14" ry="17" fill="#e0499a" />
      <ellipse cx="24" cy="26" rx="14" ry="17" fill="url(#dfSpots)" opacity="0.5" />
      <defs>
        <radialGradient id="dfSpots" cx="30%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffd1ec" />
          <stop offset="100%" stopColor="#e0499a" />
        </radialGradient>
      </defs>
      {[
        [24, 9],
        [15, 12],
        [33, 12],
        [10, 20],
        [38, 20],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x},${y} L${x - 3},${y + 6} L${x + 3},${y + 6} Z`} fill="#3fae5a" />
      ))}
      <circle cx="18" cy="22" r="1.6" fill="#fff8" />
      <circle cx="27" cy="30" r="1.6" fill="#fff8" />
      <circle cx="20" cy="33" r="1.6" fill="#fff8" />
      <circle cx="30" cy="20" r="1.6" fill="#fff8" />
    </svg>
  );
}

/** The flagship legendary moon crop gets its own glowing hand-drawn blossom. */
function MoonBlossomGlyph({ size }: { size: number }) {
  const petals = Array.from({ length: 6 }, (_, i) => i * 60);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="moonGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#fff9e8" />
          <stop offset="100%" stopColor="#cdb8f0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="url(#moonGlow)" opacity="0.25" />
      {petals.map((angle) => (
        <ellipse
          key={angle}
          cx="24"
          cy="14"
          rx="5.5"
          ry="9"
          fill="url(#moonGlow)"
          stroke="#b9a6e8"
          strokeWidth="0.6"
          transform={`rotate(${angle} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="6.5" fill="#2f2b52" />
      <path d="M27 19a6 6 0 100 10 5 5 0 010-10z" fill="#f2b23a" />
      {[
        [8, 10],
        [40, 12],
        [10, 38],
        [38, 36],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x},${y - 2} L${x + 1},${y} L${x},${y + 2} L${x - 1},${y} Z`} fill="#fff2c2" />
      ))}
    </svg>
  );
}

export default function CropIcon({ crop, size = 28 }: { crop: IconCrop; size?: number }) {
  if (crop.id === "dragonfruit") return <DragonFruitGlyph size={size} />;
  if (crop.id === "moon_blossom") return <MoonBlossomGlyph size={size} />;
  return (
    <span style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label={crop.name}>
      {crop.emoji}
    </span>
  );
}
