import { WORLD_HEIGHT, WORLD_WIDTH } from "../world";

interface Particle {
  left: number;
  delay: number;
  duration: number;
}

function seeded(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function buildParticles(count: number, seedOffset: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    left: seeded(i + seedOffset) * WORLD_WIDTH,
    delay: seeded(i + seedOffset + 500) * 1.4,
    duration: 0.6 + seeded(i + seedOffset + 900) * 0.5,
  }));
}

const RAIN_DROPS = buildParticles(60, 0);
const SNOW_FLAKES = buildParticles(40, 2000);
const FALL_DISTANCE = `${WORLD_HEIGHT + 40}px`;

export function RainParticles() {
  return (
    <div className="weather-particles" style={{ height: WORLD_HEIGHT, ["--fall-distance" as string]: FALL_DISTANCE }}>
      {RAIN_DROPS.map((d, i) => (
        <span
          key={i}
          className="raindrop"
          style={{ left: d.left, animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s` }}
        />
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
          style={{ left: d.left, animationDelay: `${d.delay * 2.5}s`, animationDuration: `${3.5 + d.duration * 2.5}s` }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}

const BOLT_X = [22, 48, 68];

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
          <polygon points="30,0 10,90 28,90 5,200 55,80 33,80 45,0" fill="#fff8d0" />
        </svg>
      ))}
    </>
  );
}
