import type { BlossomColor } from "../moonData";

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

/** The flagship legendary moon crop: real artwork — a glassy bubble cradling a full rose bloom
 *  on a curling vine, rather than a redrawn glyph, since the reference has detail (bubble
 *  refraction, individually inked petals) an SVG approximation loses. The bloom's base color is
 *  rolled per-planting (see rollBlossomColor, server-side) — overwhelmingly purple, with rare
 *  blue/yellow/grey variants, each its own cropped image. */
function MoonBlossomImage({ size, color = "purple" }: { size: number; color?: BlossomColor }) {
  return (
    <img
      src={`/images/plants/moon-blossom-${color}.png`}
      alt=""
      aria-hidden="true"
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

/** The flagship legendary solar crop: real artwork — a faceted crystal orb cradling a fire-toned
 *  rose bloom, radiating sun-ray spikes, on a golden-brown budding vine. Moon Blossom's solar
 *  counterpart, single color variant (no per-planting roll). */
function SunBlossomImage({ size }: { size: number }) {
  return (
    <img
      src="/images/plants/sun-blossom.png"
      alt=""
      aria-hidden="true"
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
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

/** The mythic (Divine) solar crop: a yellow phoenix cradling a sunflower at its chest. */
function PhoenixSunflowerGlyph({ size }: { size: number }) {
  const petals = Array.from({ length: 10 }, (_, i) => i * 36);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="phoenixHalo" cx="50%" cy="46%" r="60%">
          <stop offset="0%" stopColor="#ffcf3d" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ff8a1e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="phoenixFeather" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe27a" />
          <stop offset="55%" stopColor="#ffc23d" />
          <stop offset="100%" stopColor="#e8571e" />
        </linearGradient>
        <radialGradient id="sunflowerCenter" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#8a5a24" />
          <stop offset="100%" stopColor="#5c3a15" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="url(#phoenixHalo)" />
      <path d="M24 29 C19 39 14 44 8 46 C16 42 20 38 24 32 Z" fill="url(#phoenixFeather)" opacity="0.9" />
      <path d="M24 29 C29 39 34 44 40 46 C32 42 28 38 24 32 Z" fill="url(#phoenixFeather)" opacity="0.9" />
      <path d="M21 21 C11 18 5 10 3 3 C9 9 17 12 22 17 Z" fill="url(#phoenixFeather)" />
      <path d="M27 21 C37 18 43 10 45 3 C39 9 31 12 26 17 Z" fill="url(#phoenixFeather)" />
      <ellipse cx="24" cy="25" rx="8" ry="10" fill="url(#phoenixFeather)" stroke="#c2410c" strokeWidth="0.8" />
      <circle cx="24" cy="12" r="4.5" fill="url(#phoenixFeather)" stroke="#c2410c" strokeWidth="0.7" />
      <path d="M24 8 L20.5 4.5 L24.5 6.5 Z" fill="#e8571e" />
      <path d="M24.5 12 L29 13.2 L24.5 14.8 Z" fill="#c2410c" />
      <circle cx="25.6" cy="11" r="0.7" fill="#2a1806" />
      {petals.map((angle) => (
        <ellipse
          key={angle}
          cx="24"
          cy="19"
          rx="2.4"
          ry="6.2"
          fill="#ffd23f"
          stroke="#e0a80e"
          strokeWidth="0.4"
          transform={`rotate(${angle} 24 25)`}
        />
      ))}
      <circle cx="24" cy="25" r="5" fill="url(#sunflowerCenter)" stroke="#3d2610" strokeWidth="0.6" />
      <circle cx="22" cy="24" r="0.6" fill="#3d2610" />
      <circle cx="26" cy="24" r="0.6" fill="#3d2610" />
      <circle cx="24" cy="27" r="0.6" fill="#3d2610" />
      <circle cx="22" cy="27" r="0.6" fill="#3d2610" />
      <circle cx="26" cy="27" r="0.6" fill="#3d2610" />
    </svg>
  );
}

export default function CropIcon({
  crop,
  size = 28,
  blossomColor,
}: {
  crop: IconCrop;
  size?: number;
  blossomColor?: BlossomColor;
}) {
  if (crop.id === "dragonfruit") return <DragonFruitGlyph size={size} />;
  if (crop.id === "moon_blossom") return <MoonBlossomImage size={size} color={blossomColor} />;
  if (crop.id === "nebula_cherry") return <NebulaCherryGlyph size={size} />;
  if (crop.id === "phoenix_sunflower") return <PhoenixSunflowerGlyph size={size} />;
  if (crop.id === "sun_blossom") return <SunBlossomImage size={size} />;
  return (
    <span style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label={crop.name}>
      {crop.emoji}
    </span>
  );
}
