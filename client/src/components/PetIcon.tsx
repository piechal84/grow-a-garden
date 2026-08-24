import { evolutionInfo } from "../petData";

export interface IconPet {
  id: string;
  name: string;
  emoji: string;
}

/** A single feather rendered as a rotated ellipse pivoting from (px, py) — used to fan out both
 *  wings and the tail from a shared pivot point, the same "rotated ellipse" technique the Moon
 *  Blossom's petals use. */
function Feather({
  px,
  py,
  rx,
  ry,
  angle,
  fill,
}: {
  px: number;
  py: number;
  rx: number;
  ry: number;
  angle: number;
  fill: string;
}) {
  return (
    <ellipse
      cx={px}
      cy={py - ry}
      rx={rx}
      ry={ry}
      fill={fill}
      stroke="#c2410c"
      strokeWidth="0.4"
      transform={`rotate(${angle} ${px} ${py})`}
    />
  );
}

/** The Phoenix Chick pet: a plump fire-bird chick with a flame crest and teal-tipped fanned
 *  wings, shared across all evolution stages (Empowered/Tenacious are distinguished elsewhere by
 *  their aura glow and name label, not a separate glyph). */
function PhoenixChickGlyph({ size }: { size: number }) {
  const leftAngles = [-10, -30, -50];
  const rightAngles = [10, 30, 50];
  const tailAngles = [158, 180, 202];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="pcHalo" cx="50%" cy="55%" r="65%">
          <stop offset="0%" stopColor="#ffb23d" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffb23d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pcFeather" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ffe27a" />
          <stop offset="55%" stopColor="#ffc23d" />
          <stop offset="100%" stopColor="#e8571e" />
        </linearGradient>
        <radialGradient id="pcBody" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="55%" stopColor="#ff9a3d" />
          <stop offset="100%" stopColor="#e0601e" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="28" r="21" fill="url(#pcHalo)" />
      {tailAngles.map((a) => (
        <Feather key={`t${a}`} px={24} py={33} rx={2.4} ry={6.5} angle={a} fill="url(#pcFeather)" />
      ))}
      {leftAngles.map((a) => (
        <Feather key={`lw${a}`} px={15} py={27} rx={3} ry={8} angle={a} fill="url(#pcFeather)" />
      ))}
      <Feather px={15} py={27} rx={3} ry={8} angle={-68} fill="#5fe0c8" />
      {rightAngles.map((a) => (
        <Feather key={`rw${a}`} px={33} py={27} rx={3} ry={8} angle={a} fill="url(#pcFeather)" />
      ))}
      <Feather px={33} py={27} rx={3} ry={8} angle={68} fill="#5fe0c8" />
      <ellipse cx="24" cy="29" rx="10.5" ry="11.5" fill="url(#pcBody)" stroke="#c2410c" strokeWidth="0.9" />
      <path d="M24 5 C21.5 9 20.5 13 22.5 17 C22.7 13 24 10 24 5 Z" fill="#ff6a1e" />
      <path d="M19 8 C18 11 18 14 20 17 C19.6 14 20 11 19 8 Z" fill="#ffa23d" />
      <path d="M29 8 C30 11 30 14 28 17 C28.4 14 28 11 29 8 Z" fill="#ffa23d" />
      <circle cx="20.5" cy="27" r="2.4" fill="#2a1806" />
      <circle cx="19.8" cy="26.2" r="0.75" fill="#fff" opacity="0.85" />
      <path d="M25 29 L31.5 27.3 L25 26.2 Z" fill="#ff8a1e" stroke="#c2410c" strokeWidth="0.5" />
      {[
        [6, 12],
        [42, 14],
        [10, 42],
        [38, 40],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x},${y - 3} L${x + 1.4},${y} L${x},${y + 3} L${x - 1.4},${y} Z`} fill="#ffe27a" />
      ))}
    </svg>
  );
}

/** The Phoenix Chick as seen from above while roaming the garden — real artwork rather than a
 *  redrawn glyph, since this one has enough illustrative detail (individually inked feathers)
 *  that an SVG approximation loses too much. Two variants: a cooler purple/pink resting pose and
 *  a warmer yellow-shifted pose used while actually walking between spots. */
function PhoenixChickTopImage({ size, moving }: { size: number; moving: boolean }) {
  const src = moving ? "/images/pets/phoenix-chick-top-moving.png" : "/images/pets/phoenix-chick-top-stationary.png";
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

/** The Baby Dragon as seen from above while roaming the garden — real artwork, single pose
 *  (no moving/stationary distinction like the Phoenix Chick, since only one reference image
 *  exists for it). No portrait glyph exists yet, so the front-facing shop/inventory tile still
 *  falls back to the plain emoji. */
function BabyDragonTopImage({ size }: { size: number }) {
  return (
    <img
      src="/images/pets/baby-dragon-top.png"
      alt=""
      aria-hidden="true"
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

export default function PetIcon({
  pet,
  size = 28,
  variant = "portrait",
  moving = false,
}: {
  pet: IconPet;
  size?: number;
  /** "top" is used only for the roaming-garden sprite (viewed from above); every other UI spot
   *  uses the default front-facing "portrait". Species without a top-down art fall back to their
   *  portrait (or plain emoji) either way. */
  variant?: "portrait" | "top";
  /** "top" variant only — swaps to a warmer walking pose while the pet is mid-move. */
  moving?: boolean;
}) {
  const { baseId } = evolutionInfo(pet.id);
  if (baseId === "phoenix_chick") {
    return variant === "top" ? <PhoenixChickTopImage size={size} moving={moving} /> : <PhoenixChickGlyph size={size} />;
  }
  if (baseId === "baby_dragon" && variant === "top") {
    return <BabyDragonTopImage size={size} />;
  }
  return (
    <span style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label={pet.name}>
      {pet.emoji}
    </span>
  );
}
