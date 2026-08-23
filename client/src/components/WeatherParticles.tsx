import { WORLD_HEIGHT, WORLD_WIDTH } from "../world";

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

const BOLT_X = [20, 46, 70];

export function LightningBolts() {
  return (
    <>
      {BOLT_X.map((x, i) => (
        <svg
          key={i}
          className="lightning-bolt"
          style={{ left: `${x}%`, animationDelay: `${i * 0.15}s` }}
          viewBox="0 0 60 200"
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
    </>
  );
}
