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

/** The Phoenix Chick as seen from above while roaming the garden: wings spread flat left-right
 *  in a cool pink→purple→blue palette (leading edge pink, trailing edge cyan), with a warm
 *  flame tail — a deliberate contrast to the front-facing portrait's fire-orange coloring. */
function PhoenixChickTopGlyph({ size }: { size: number }) {
  const leftSpecs: { a: number; rx: number; ry: number; fill: string }[] = [
    { a: -45, rx: 2.8, ry: 8, fill: "#ff9ad1" },
    { a: -68, rx: 3.2, ry: 10.5, fill: "#e08fe0" },
    { a: -92, rx: 3.4, ry: 12.5, fill: "#a07bf0" },
    { a: -115, rx: 3.2, ry: 11.5, fill: "#6fa0f0" },
    { a: -138, rx: 2.8, ry: 9, fill: "#5fe0e8" },
  ];
  const rightSpecs = leftSpecs.map((s) => ({ ...s, a: -s.a }));
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="pcTopHalo" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#c77dff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c77dff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pcTopBody" cx="42%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffd9f0" />
          <stop offset="55%" stopColor="#c77dff" />
          <stop offset="100%" stopColor="#6a4fd8" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="22" r="21" fill="url(#pcTopHalo)" />
      {leftSpecs.map((s, i) => (
        <Feather key={`l${i}`} px={19} py={21} rx={s.rx} ry={s.ry} angle={s.a} fill={s.fill} />
      ))}
      {rightSpecs.map((s, i) => (
        <Feather key={`r${i}`} px={29} py={21} rx={s.rx} ry={s.ry} angle={s.a} fill={s.fill} />
      ))}
      <ellipse cx="24" cy="20" rx="4.4" ry="9" fill="url(#pcTopBody)" stroke="#6a4fd8" strokeWidth="0.6" />
      <circle cx="24" cy="9" r="3.4" fill="url(#pcTopBody)" stroke="#6a4fd8" strokeWidth="0.6" />
      <path d="M24 5.5 C23 7 23 8 24 9 C25 8 25 7 24 5.5 Z" fill="#5fe0e8" />
      <path d="M22 6.5 C21.3 7.6 21.4 8.4 22.2 9.2 C22 8.2 22 7.3 22 6.5 Z" fill="#5fe0e8" />
      <path d="M26 6.5 C26.7 7.6 26.6 8.4 25.8 9.2 C26 8.2 26 7.3 26 6.5 Z" fill="#5fe0e8" />
      <path d="M24 34 C22 38 21 41 22 45 C22.5 42 23.5 39 24 34 Z" fill="#ffb23d" />
      <path d="M24 35 C25.5 39 27 41.5 26.5 45 C26 42 25 39.5 24 35 Z" fill="#ff6a1e" />
      <path d="M24 35 C23.6 39 23.8 42 24 45.5 C24.4 41.5 24.4 38.5 24 35 Z" fill="#ffe27a" />
    </svg>
  );
}

export default function PetIcon({
  pet,
  size = 28,
  variant = "portrait",
}: {
  pet: IconPet;
  size?: number;
  /** "top" is used only for the roaming-garden sprite (viewed from above); every other UI spot
   *  uses the default front-facing "portrait". Species without a top-down glyph fall back to
   *  their portrait (or plain emoji) either way. */
  variant?: "portrait" | "top";
}) {
  const { baseId } = evolutionInfo(pet.id);
  if (baseId === "phoenix_chick") {
    return variant === "top" ? <PhoenixChickTopGlyph size={size} /> : <PhoenixChickGlyph size={size} />;
  }
  return (
    <span style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label={pet.name}>
      {pet.emoji}
    </span>
  );
}
