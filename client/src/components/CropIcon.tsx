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
        <radialGradient id="moonHalo" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#8ff0ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#8ff0ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="url(#moonHalo)" />
      <circle cx="24" cy="24" r="20" fill="url(#moonGlow)" opacity="0.45" />
      {petals.map((angle) => (
        <ellipse
          key={angle}
          cx="24"
          cy="14"
          rx="6"
          ry="9.5"
          fill="url(#moonGlow)"
          stroke="#8f6fe0"
          strokeWidth="1.1"
          transform={`rotate(${angle} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="7" fill="#211d40" stroke="#24e8ff" strokeWidth="0.8" />
      <path d="M27.5 18.5a6.5 6.5 0 100 11 5.3 5.3 0 010-11z" fill="#ffd54a" />
      {[
        [7, 9],
        [41, 11],
        [9, 39],
        [39, 37],
        [24, 4],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x},${y - 3} L${x + 1.4},${y} L${x},${y + 3} L${x - 1.4},${y} Z`} fill="#fff8d6" />
      ))}
    </svg>
  );
}

/** The mythic (Divine) moon crop gets a starry, glowing cosmic-cherry glyph of its own. */
function NebulaCherryGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="nebulaHalo" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#ffd54a" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffd54a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cherrySheen" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ff9ad1" />
          <stop offset="100%" stopColor="#d81159" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="26" r="21" fill="url(#nebulaHalo)" />
      <path d="M22 18 C20 10 16 7 12 6" fill="none" stroke="#3fae5a" strokeWidth="2" strokeLinecap="round" />
      <path d="M27 17 C28 9 32 6 36 5" fill="none" stroke="#3fae5a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="19" cy="30" r="10" fill="url(#cherrySheen)" stroke="#a10f45" strokeWidth="1.2" />
      <circle cx="32" cy="32" r="10" fill="url(#cherrySheen)" stroke="#a10f45" strokeWidth="1.2" />
      <ellipse cx="16" cy="26" rx="2.2" ry="1.6" fill="#ffe3f0" opacity="0.85" />
      <ellipse cx="29" cy="28" rx="2.2" ry="1.6" fill="#ffe3f0" opacity="0.85" />
      {[
        [6, 14],
        [42, 16],
        [8, 40],
        [40, 40],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x},${y - 3} L${x + 1.4},${y} L${x},${y + 3} L${x - 1.4},${y} Z`} fill="#ffd54a" />
      ))}
    </svg>
  );
}

export default function CropIcon({ crop, size = 28 }: { crop: IconCrop; size?: number }) {
  if (crop.id === "dragonfruit") return <DragonFruitGlyph size={size} />;
  if (crop.id === "moon_blossom") return <MoonBlossomGlyph size={size} />;
  if (crop.id === "nebula_cherry") return <NebulaCherryGlyph size={size} />;
  return (
    <span style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label={crop.name}>
      {crop.emoji}
    </span>
  );
}
