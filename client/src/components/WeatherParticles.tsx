import { useEffect, useState } from "react";
import { WORLD_HEIGHT, WORLD_WIDTH, type Position } from "../world";

interface Particle {
  left: number;
  top: number;
  delay: number;
  duration: number;
  scale: number;
}

function seeded(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function buildParticles(count: number, seedOffset: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    left: seeded(i + seedOffset) * WORLD_WIDTH,
    top: 20 + seeded(i + seedOffset + 300) * (WORLD_HEIGHT - 40),
    delay: seeded(i + seedOffset + 500) * 2.4,
    duration: 1.7 + seeded(i + seedOffset + 900) * 0.9,
    scale: 0.75 + seeded(i + seedOffset + 1300) * 0.7,
  }));
}

const RAIN_DROPS = buildParticles(45, 0);
const SNOW_FLAKES = buildParticles(30, 2000);
const STARS = buildParticles(40, 5000);
const SHOOTING_STARS = buildParticles(3, 8000);
const FALL_DISTANCE = `${WORLD_HEIGHT + 60}px`;

/** A bold, cartoon teardrop — not a thin CSS line — so rain reads clearly at a glance. */
function DropSVG({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 16 28" width={size} height={size * 1.75}>
      <path
        d="M8 0C8 0 1 13 1 19a7 7 0 0 0 14 0C15 13 8 0 8 0Z"
        fill="#1e88ff"
        stroke="#0d47a1"
        strokeWidth="1.6"
      />
      <ellipse cx="5.5" cy="17" rx="1.6" ry="2.6" fill="#fff" opacity="0.85" />
    </svg>
  );
}

/**
 * Each drop falls a short distance within its own randomized zone on the map, splashes,
 * and fades — then loops — instead of one continuous curtain crossing the whole world.
 */
export function RainParticles() {
  return (
    <div className="weather-particles" style={{ height: WORLD_HEIGHT }}>
      {RAIN_DROPS.map((d, i) => (
        <span
          key={i}
          className="raindrop-zone"
          style={{
            left: d.left,
            top: d.top,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        >
          <span className="raindrop-fall">
            <DropSVG size={14 * d.scale} />
          </span>
          <span className="raindrop-splash" />
        </span>
      ))}
    </div>
  );
}

export function SnowParticles() {
  return (
    <div className="weather-particles" style={{ height: WORLD_HEIGHT, ["--fall-distance" as string]: FALL_DISTANCE }}>
      {SNOW_FLAKES.map((d, i) => (
        <span
          key={i}
          className="snowflake"
          style={{
            left: d.left,
            animationDelay: `${d.delay}s`,
            animationDuration: `${3.5 + d.duration * 2.5}s`,
            fontSize: 18 + d.scale * 10,
          }}
        >
          ❄️
        </span>
      ))}
    </div>
  );
}

/** Gives the night sky some life beyond just a darker tint — a scatter of twinkling
 *  stars plus the occasional shooting star streaking across the map. */
export function NightStars() {
  return (
    <div className="weather-particles" style={{ height: WORLD_HEIGHT }}>
      {STARS.map((s, i) => (
        <span
          key={i}
          className="night-star"
          style={{
            left: s.left,
            top: s.top,
            width: 2 + s.scale * 2.4,
            height: 2 + s.scale * 2.4,
            animationDelay: `${s.delay}s`,
            animationDuration: `${1.8 + s.duration}s`,
          }}
        />
      ))}
      {SHOOTING_STARS.map((s, i) => (
        <span
          key={`shoot-${i}`}
          className="shooting-star"
          style={{
            left: s.left * 0.5,
            top: s.top * 0.35,
            animationDelay: `${i * 6 + s.delay * 4}s`,
          }}
        />
      ))}
    </div>
  );
}

const BOLT_COUNT = 3;

function randomTarget(targets: Position[]): Position {
  if (targets.length > 0) return targets[Math.floor(Math.random() * targets.length)];
  return { x: WORLD_WIDTH * (0.15 + Math.random() * 0.7), y: WORLD_HEIGHT * (0.25 + Math.random() * 0.6) };
}

/**
 * Bolts strike down at real crop positions when any are available (each bolt rerolls its target
 * every time its 7s strike cycle loops via onAnimationIteration), falling back to random spots
 * across the map when nothing is planted yet.
 */
export function LightningBolts({ targets }: { targets: Position[] }) {
  const [picks, setPicks] = useState<Position[]>(() =>
    Array.from({ length: BOLT_COUNT }, () => randomTarget(targets)),
  );

  useEffect(() => {
    setPicks(Array.from({ length: BOLT_COUNT }, () => randomTarget(targets)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets.length > 0]);

  function reroll(i: number) {
    setPicks((prev) => {
      const next = [...prev];
      next[i] = randomTarget(targets);
      return next;
    });
  }

  return (
    <>
      {picks.map((pos, i) => (
        <svg
          key={i}
          className="lightning-bolt"
          style={{ left: pos.x - 24, height: pos.y, animationDelay: `${i * 0.15}s` }}
          viewBox="0 0 60 200"
          preserveAspectRatio="none"
          onAnimationIteration={() => reroll(i)}
        >
          <polygon
            points="32,0 8,95 26,95 2,200 58,78 34,78 50,0"
            fill="#fff6b8"
            stroke="#ffe066"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      ))}
      {picks.map((pos, i) => (
        <span
          key={`impact-${i}`}
          className="lightning-strike-impact"
          style={{ left: pos.x, top: pos.y, animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </>
  );
}
