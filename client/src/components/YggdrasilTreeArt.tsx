/** A tiny 4-point sparkle, used to dress the fully-grown canopy in stage 4. */
function Sparkle({ cx, cy, r, color = "#ffe27a" }: { cx: number; cy: number; r: number; color?: string }) {
  return (
    <path
      d={`M${cx} ${cy - r} L${cx + r * 0.28} ${cy - r * 0.28} L${cx + r} ${cy} L${cx + r * 0.28} ${cy + r * 0.28} L${cx} ${cy + r} L${cx - r * 0.28} ${cy + r * 0.28} L${cx - r} ${cy} L${cx - r * 0.28} ${cy - r * 0.28} Z`}
      fill={color}
    />
  );
}

/** Stage 0 — a fresh sprout just breaking soil. */
function SproutStage() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <ellipse cx="50" cy="90" rx="20" ry="7" fill="#6b4a2f" />
      <ellipse cx="50" cy="88" rx="18" ry="5" fill="#8a6a4a" opacity="0.6" />
      <path d="M50 88 C49 79 51 73 50 67" stroke="#3f8f5e" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M50 75 C44 73 40 69 38 65 C43 65 48 68 50 73 Z" fill="#5fb87a" />
      <path d="M50 73 C56 70 60 66 62 62 C57 63 52 66 50 71 Z" fill="#6fc98a" />
    </svg>
  );
}

/** Stage 1 — a round, bushy little sapling. */
function BushStage() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <ellipse cx="50" cy="93" rx="14" ry="4" fill="#6b4a2f" opacity="0.45" />
      <path d="M50 90 L50 68" stroke="#5c8a49" strokeWidth="5" strokeLinecap="round" />
      <g fill="#5fb87a">
        <circle cx="50" cy="54" r="20" />
        <circle cx="36" cy="62" r="13" />
        <circle cx="64" cy="62" r="13" />
        <circle cx="50" cy="68" r="14" />
      </g>
      <g fill="#7fd190" opacity="0.7">
        <circle cx="44" cy="47" r="9" />
        <circle cx="59" cy="51" r="7" />
      </g>
    </svg>
  );
}

/** Stage 2 — a taller, thin sapling with the first real branches. */
function SaplingStage() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <ellipse cx="50" cy="95" rx="10" ry="3" fill="#6b4a2f" opacity="0.45" />
      <path d="M50 92 C49 75 51 60 50 45" stroke="#6b8f4a" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M50 68 C42 62 36 58 29 56" stroke="#6b8f4a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M50 55 C58 50 64 46 71 44" stroke="#6b8f4a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M50 45 C46 38 44 33 41 27" stroke="#6b8f4a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <g fill="#5fb87a">
        <ellipse cx="27" cy="53" rx="9" ry="6" />
        <ellipse cx="73" cy="41" rx="9" ry="6" />
        <ellipse cx="39" cy="24" rx="8" ry="6" />
        <ellipse cx="50" cy="42" rx="10" ry="7" />
      </g>
      <g>
        <ellipse cx="60" cy="49" rx="4" ry="3" fill="#5b8fd6" />
        <path d="M57 49 L52 47 L57 50 Z" fill="#3f6fb0" />
      </g>
    </svg>
  );
}

/** Stage 3 — a young tree: real bark, a root flare, and the first glowing vein. */
function YoungTreeStage() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id="ygg3-trunk" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8a6a4a" />
          <stop offset="100%" stopColor="#4a3320" />
        </linearGradient>
        <radialGradient id="ygg3-canopy" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#7fc98c" />
          <stop offset="100%" stopColor="#2f6b40" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="94" rx="26" ry="5" fill="#4a3320" opacity="0.45" />
      <path
        d="M32 92 C34 84 30 80 24 82 M68 92 C66 84 70 80 76 82 M50 92 L50 78"
        stroke="#6b4a2f"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M50 80 C48 68 52 56 50 44 C50 40 52 36 54 32" stroke="url(#ygg3-trunk)" strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M50 78 C46 66 54 58 50 46" stroke="#8cffb0" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9" />
      <g fill="url(#ygg3-canopy)">
        <circle cx="54" cy="28" r="22" />
        <circle cx="36" cy="34" r="16" />
        <circle cx="70" cy="36" r="14" />
      </g>
    </svg>
  );
}

/** Stage 4 — the fully-grown World Tree: wide root flare, glowing rune veins and a carved mark,
 *  a full canopy, and a couple of galaxy "portals" nestled in the leaves. */
function FullYggdrasilStage() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id="ygg4-trunk" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8a6a4a" />
          <stop offset="100%" stopColor="#4a3320" />
        </linearGradient>
        <radialGradient id="ygg4-canopy" cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#84d494" />
          <stop offset="100%" stopColor="#2a6440" />
        </radialGradient>
        <radialGradient id="ygg4-root-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#8cffb0" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#8cffb0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ygg4-portal" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#e6e6ff" />
          <stop offset="45%" stopColor="#6a5acd" />
          <stop offset="100%" stopColor="#1a1440" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="95" rx="34" ry="7" fill="url(#ygg4-root-glow)" />
      <path
        d="M28 92 C30 82 22 78 14 82 M72 92 C70 82 78 78 86 82 M50 92 L50 76"
        stroke="#6b4a2f"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M50 78 C46 62 54 50 50 34 C50 28 54 22 58 16" stroke="url(#ygg4-trunk)" strokeWidth="18" strokeLinecap="round" fill="none" />
      <path d="M50 76 C45 60 55 50 50 36" stroke="#8cffb0" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.95" />
      <path d="M41 70 C43 64 41 58 45 52" stroke="#8cffb0" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <rect x="46" y="55" width="8" height="8" rx="1.5" fill="none" stroke="#8cffb0" strokeWidth="1.5" opacity="0.9" />
      <g fill="url(#ygg4-canopy)">
        <circle cx="60" cy="20" r="26" />
        <circle cx="36" cy="26" r="19" />
        <circle cx="78" cy="30" r="17" />
        <circle cx="55" cy="7" r="16" />
      </g>
      <ellipse cx="41" cy="13" rx="7" ry="5" fill="url(#ygg4-portal)" stroke="#c9c9e8" strokeWidth="1" />
      <ellipse cx="75" cy="17" rx="6" ry="4.2" fill="url(#ygg4-portal)" stroke="#c9c9e8" strokeWidth="1" />
      <Sparkle cx={20} cy={18} r={3} />
      <Sparkle cx={88} cy={10} r={2.4} color="#c9c9e8" />
      <Sparkle cx={63} cy={0} r={2.2} />
    </svg>
  );
}

/** Renders one of 5 growth stages (0 = just planted, 4 = fully grown) — see YggdrasilStructure
 *  for how `stage` is derived from construction progress. */
export default function YggdrasilTreeArt({ stage }: { stage: 0 | 1 | 2 | 3 | 4 }) {
  if (stage === 0) return <SproutStage />;
  if (stage === 1) return <BushStage />;
  if (stage === 2) return <SaplingStage />;
  if (stage === 3) return <YoungTreeStage />;
  return <FullYggdrasilStage />;
}
