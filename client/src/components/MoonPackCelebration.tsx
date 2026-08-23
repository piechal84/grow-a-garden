import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { MoonTier } from "../moonData";

function seeded(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const CONFETTI_COLORS = ["#f7b733", "#e05fb0", "#6a4fd8", "#3fae5a", "#ff6b6b", "#4fc3f7", "#ffe066"];
const FIREWORK_COLORS = ["#ffd166", "#ef476f", "#06d6a0", "#4fc3f7", "#c77dff", "#fff275"];

interface Intensity {
  confetti: number;
  fireworks: number;
  flash: boolean;
}

const INTENSITY: Record<MoonTier, Intensity> = {
  common: { confetti: 16, fireworks: 0, flash: false },
  uncommon: { confetti: 24, fireworks: 0, flash: false },
  rare: { confetti: 34, fireworks: 1, flash: false },
  epic: { confetti: 46, fireworks: 2, flash: false },
  mythic: { confetti: 68, fireworks: 4, flash: true },
  legendary: { confetti: 95, fireworks: 6, flash: true },
};

interface ConfettiSpec {
  left: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
  width: number;
  height: number;
}

function buildConfetti(count: number, seedOffset: number): ConfettiSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    left: seeded(i + seedOffset) * 100,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: seeded(i + seedOffset + 500) * 0.5,
    duration: 1.7 + seeded(i + seedOffset + 900) * 1.3,
    drift: (seeded(i + seedOffset + 1300) - 0.5) * 200,
    rotate: 220 + seeded(i + seedOffset + 1700) * 620,
    width: 6 + seeded(i + seedOffset + 2100) * 6,
    height: 10 + seeded(i + seedOffset + 2500) * 6,
  }));
}

interface SparkSpec {
  x: number;
  y: number;
  color: string;
}

function buildSparks(count: number, seedOffset: number): SparkSpec[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + seeded(i + seedOffset) * 0.4;
    const dist = 55 + seeded(i + seedOffset + 400) * 45;
    return {
      x: Math.round(Math.cos(angle) * dist),
      y: Math.round(Math.sin(angle) * dist),
      color: FIREWORK_COLORS[i % FIREWORK_COLORS.length],
    };
  });
}

interface FireworkSpec {
  x: number;
  y: number;
  delay: number;
  sparks: SparkSpec[];
}

function buildFireworks(count: number, seedOffset: number): FireworkSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    x: 15 + seeded(i + seedOffset + 3000) * 70,
    y: 12 + seeded(i + seedOffset + 3400) * 55,
    delay: i * 0.22 + seeded(i + seedOffset + 3800) * 0.15,
    sparks: buildSparks(14 + Math.round(seeded(i + seedOffset + 4200) * 6), i * 97 + seedOffset),
  }));
}

/** A rarity-scaled confetti + fireworks burst for a moon pack reveal, portaled above everything. */
export default function MoonPackCelebration({ tier }: { tier: MoonTier }) {
  const intensity = INTENSITY[tier];
  const seedOffset = useState(() => Math.floor(Math.random() * 10000))[0];
  const confetti = useState(() => buildConfetti(intensity.confetti, seedOffset))[0];
  const fireworks = useState(() => buildFireworks(intensity.fireworks, seedOffset))[0];

  return createPortal(
    <div className="celebration-layer">
      {intensity.flash && <div className="celebration-flash" />}
      {confetti.map((c, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${c.left}%`,
              background: c.color,
              width: c.width,
              height: c.height,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              "--drift": `${c.drift}px`,
              "--rotate": `${c.rotate}deg`,
            } as CSSProperties
          }
        />
      ))}
      {fireworks.map((f, i) => (
        <div key={i} className="firework-burst" style={{ left: `${f.x}%`, top: `${f.y}%` }}>
          {f.sparks.map((s, j) => (
            <span
              key={j}
              className="firework-spark"
              style={
                {
                  background: s.color,
                  color: s.color,
                  animationDelay: `${f.delay}s`,
                  "--sx": `${s.x}px`,
                  "--sy": `${s.y}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
}
