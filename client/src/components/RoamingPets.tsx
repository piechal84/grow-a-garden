import { useEffect, useRef, useState } from "react";
import { equippedPetsInfo, evolutionInfo, PET_SIZE_MULTIPLIER, type PetSize } from "../petData";
import { socket } from "../socket";
import type { PlayerState } from "../types";
import { CELL_SIZE } from "../world";
import PetIcon from "./PetIcon";

const WANDER_INTERVAL_MS = 4500;
const EMBER_LIFETIME_MS = 1100;
const EMBERS_PER_STEP = 3;
/** Must match .roaming-pet's `transition: transform` duration in index.css — how long a wander
 *  step visually takes to glide to its new spot, after which the pet reads as "landed" again. */
const MOVE_TRANSITION_MS = 3600;

/** Roaming sprite base size (before the pet's own Normal/Big/Giant multiplier). Phoenix Chick
 *  and Baby Dragon get a bigger base since their real artwork reads poorly small; every other
 *  species still falls back to a plain emoji, which stays legible at the smaller size. */
const BASE_ROAMING_SIZE = 34;
const ILLUSTRATED_ROAMING_SIZE = 46;

type FlightKind = "phoenix" | "dragon";

function flightKindFor(petId: string): FlightKind | undefined {
  const { baseId } = evolutionInfo(petId);
  if (baseId === "phoenix_chick") return "phoenix";
  if (baseId === "baby_dragon") return "dragon";
  return undefined;
}

function roamingIconSize(petId: string, size: PetSize): number {
  const base = flightKindFor(petId) ? ILLUSTRATED_ROAMING_SIZE : BASE_ROAMING_SIZE;
  return Math.round(base * PET_SIZE_MULTIPLIER[size]);
}

interface FireEffect {
  id: number;
  x: number;
  y: number;
  heading: number;
  colors: string[];
  spreadDeg: number;
  baseLen: number;
}

/** Wide, scattered warm-to-cool embers — echoes the Phoenix Chick's own palette split between
 *  its warm tail and cool wings. */
const PHOENIX_TRAIL_COLORS = ["#ffb23d", "#ff6a1e", "#ff9ad1", "#c77dff", "#6fa0f0"];
const PHOENIX_TRAIL_SPREAD_DEG = 65;
const PHOENIX_TRAIL_LEN = 7;

/** A narrow, hot-cored jet — red at the edges fading to bright yellow at the center, like an
 *  actual flame breath rather than a scatter of sparks. */
const DRAGON_BREATH_COLORS = ["#e8341e", "#ff8a1e", "#ffe27a", "#ff8a1e", "#e8341e"];
const DRAGON_BREATH_SPREAD_DEG = 30;
const DRAGON_BREATH_LEN = 10;

function flareSliverPath(len: number): string {
  return `M0,0 L-1.1,${-len * 0.55} Q0,${-len} 1.1,${-len * 0.55} Z`;
}

/** Adjusts `target` by whole turns so it lands within 180° of `reference` — without this, a CSS
 *  `rotate()` transition from e.g. 170deg to -170deg would spin the long way around (340°)
 *  instead of turning the short 20° it visually should. */
function unwrapAngle(target: number, reference: number): number {
  let a = target;
  while (a - reference > 180) a -= 360;
  while (a - reference < -180) a += 360;
  return a;
}

/** A small directional flame effect — fanned out around `heading` (the compass angle, 0=up/
 *  clockwise). Used for both the Phoenix Chick's trailing embers (heading = reverse of travel)
 *  and the Baby Dragon's forward fire breath (heading = travel direction itself). */
function FireFlare({
  heading,
  colors,
  spreadDeg,
  baseLen,
}: {
  heading: number;
  colors: string[];
  spreadDeg: number;
  baseLen: number;
}) {
  const n = colors.length;
  return (
    <svg width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true">
      {colors.map((color, i) => {
        const angle = heading - spreadDeg / 2 + (spreadDeg / (n - 1)) * i;
        const len = baseLen + (i % 3);
        return <path key={i} d={flareSliverPath(len)} fill={color} transform={`rotate(${angle})`} />;
      })}
      <circle cx="0" cy="0" r="1.4" fill="#ffe27a" />
    </svg>
  );
}

interface FireballSpec {
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  sizePx: number;
}

const FIREBALL_FLIGHT_MS = 550;
const FIREBALL_CLEANUP_MS = FIREBALL_FLIGHT_MS + 300;
const FIREBALL_BASE_SIZE = 16;

/** Flies from `from` to `to` over FIREBALL_FLIGHT_MS via a CSS transition — starts at `from` on
 *  mount, then flips to `to` on the next frame so the transition actually has something to
 *  animate (the same two-phase trick .roaming-pet's own wander step relies on). */
function Fireball({ spec, onDone }: { spec: FireballSpec; onDone: () => void }) {
  const [pos, setPos] = useState(spec.from);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPos(spec.to));
    const timer = window.setTimeout(onDone, FIREBALL_CLEANUP_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span
      className="dragon-fireball"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        width: spec.sizePx,
        height: spec.sizePx,
        marginLeft: -spec.sizePx / 2,
        marginTop: -spec.sizePx / 2,
      }}
    />
  );
}

/** Purely cosmetic — every equipped pet wanders to a new random spot within its owner's plot
 *  every few seconds. Each client picks its own random walk locally (no server sync needed,
 *  same as any other ambient animation), so exact paths can differ between viewers. Phoenix
 *  Chicks and Baby Dragons additionally turn to face the direction they're heading, and each
 *  leaves its own fire effect on every move — a trailing scatter of embers behind the phoenix,
 *  a forward jet of breath in front of the dragon. */
export default function RoamingPets({ player }: { player: PlayerState }) {
  const pets = equippedPetsInfo(player.petsEquipped);
  const width = player.gridWidth * CELL_SIZE;
  const height = player.gridHeight * CELL_SIZE;
  const petsKey = pets.map((p) => `${p.petId}#${p.size}`).join(",");

  const [positions, setPositions] = useState<{ x: number; y: number }[]>([]);
  const [moving, setMoving] = useState<boolean[]>([]);
  const [facing, setFacing] = useState<number[]>([]);
  const [fireEffects, setFireEffects] = useState<FireEffect[]>([]);
  const [fireballs, setFireballs] = useState<FireballSpec[]>([]);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const facingRef = useRef(facing);
  facingRef.current = facing;
  const petsRef = useRef(pets);
  petsRef.current = pets;
  const playerRef = useRef(player);
  playerRef.current = player;
  const effectIdRef = useRef(0);
  const fireballIdRef = useRef(0);

  // Baby Dragon's insta-grow ability fires from the server on its own timer, independent of any
  // player action — this just draws the fireball once notified, purely cosmetic (the real result
  // already landed via the normal state_update). Reads pets/player through refs since this effect
  // only resubscribes when the player identity changes, not on every render.
  useEffect(() => {
    function onDragonInstaGrow(payload: { playerId: string; petId: string; size: PetSize; plantingId: string }) {
      if (payload.playerId !== playerRef.current.id) return;
      const idx = petsRef.current.findIndex((p) => p.petId === payload.petId && p.size === payload.size);
      const from = positionsRef.current[idx];
      const planting = playerRef.current.plantings.find((p) => p.id === payload.plantingId);
      if (!from || !planting) return;
      fireballIdRef.current += 1;
      setFireballs((cur) => [
        ...cur,
        {
          id: fireballIdRef.current,
          from,
          to: { x: (planting.x + planting.w / 2) * CELL_SIZE, y: (planting.y + planting.h / 2) * CELL_SIZE },
          sizePx: Math.round(FIREBALL_BASE_SIZE * PET_SIZE_MULTIPLIER[payload.size]),
        },
      ]);
    }
    socket.on("dragon_insta_grow", onDragonInstaGrow);
    return () => {
      socket.off("dragon_insta_grow", onDragonInstaGrow);
    };
  }, [player.id]);

  useEffect(() => {
    setPositions(pets.map(() => ({ x: Math.random() * width, y: Math.random() * height })));
    setMoving(pets.map(() => false));
    setFacing(pets.map(() => 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petsKey, width, height]);

  useEffect(() => {
    if (pets.length === 0) return;
    const interval = window.setInterval(() => {
      const prevPositions = positionsRef.current;
      const prevFacing = facingRef.current;
      const nextPositions = pets.map(() => ({ x: Math.random() * width, y: Math.random() * height }));
      const nextFacing = pets.map((_, i) => prevFacing[i] ?? 0);
      const newEffects: FireEffect[] = [];
      pets.forEach((p, i) => {
        const kind = flightKindFor(p.petId);
        if (!kind) return;
        const from = prevPositions[i];
        const to = nextPositions[i];
        if (!from || !to) return;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        // Compass bearing (0=up, clockwise) of the travel direction — matches how `rotate()`
        // orients our flame slivers, which point "up" at rotate(0). Both species turn to face
        // this bearing; the phoenix's embers trail behind it (reverse, +180), while the
        // dragon's breath jets forward (the bearing itself).
        const travelHeading = (Math.atan2(dx, -dy) * 180) / Math.PI;
        nextFacing[i] = unwrapAngle(travelHeading, prevFacing[i] ?? 0);

        if (kind === "phoenix") {
          const heading = travelHeading + 180;
          for (let e = 0; e < EMBERS_PER_STEP; e++) {
            effectIdRef.current += 1;
            newEffects.push({
              id: effectIdRef.current,
              x: from.x + (Math.random() - 0.5) * 6,
              y: from.y + (Math.random() - 0.5) * 6,
              heading: heading + (Math.random() - 0.5) * 12,
              colors: PHOENIX_TRAIL_COLORS,
              spreadDeg: PHOENIX_TRAIL_SPREAD_DEG,
              baseLen: PHOENIX_TRAIL_LEN,
            });
          }
        } else {
          effectIdRef.current += 1;
          newEffects.push({
            id: effectIdRef.current,
            x: from.x,
            y: from.y,
            heading: travelHeading + (Math.random() - 0.5) * 8,
            colors: DRAGON_BREATH_COLORS,
            spreadDeg: DRAGON_BREATH_SPREAD_DEG,
            baseLen: DRAGON_BREATH_LEN,
          });
        }
      });
      if (newEffects.length > 0) {
        setFireEffects((cur) => [...cur, ...newEffects]);
        for (const fx of newEffects) {
          window.setTimeout(() => {
            setFireEffects((cur) => cur.filter((x) => x.id !== fx.id));
          }, EMBER_LIFETIME_MS);
        }
      }
      setPositions(nextPositions);
      setFacing(nextFacing);
      setMoving(pets.map(() => true));
      window.setTimeout(() => setMoving(pets.map(() => false)), MOVE_TRANSITION_MS);
    }, WANDER_INTERVAL_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petsKey, width, height]);

  return (
    <>
      {fireEffects.map((fx) => (
        <span key={fx.id} className="pet-fire-ember" style={{ transform: `translate(${fx.x}px, ${fx.y}px)` }}>
          <FireFlare heading={fx.heading} colors={fx.colors} spreadDeg={fx.spreadDeg} baseLen={fx.baseLen} />
        </span>
      ))}
      {fireballs.map((fb) => (
        <Fireball key={fb.id} spec={fb} onDone={() => setFireballs((cur) => cur.filter((x) => x.id !== fb.id))} />
      ))}
      {pets.map((p, i) => {
        const pos = positions[i] ?? { x: 0, y: 0 };
        const flight = flightKindFor(p.petId);
        const rotate = flight ? ` rotate(${facing[i] ?? 0}deg)` : "";
        return (
          <span
            key={`${p.petId}-${p.size}-${i}`}
            className="roaming-pet"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)${rotate}` }}
            title={p.pet.name}
          >
            <PetIcon pet={p.pet} size={roamingIconSize(p.petId, p.size)} variant="top" moving={moving[i] ?? false} />
          </span>
        );
      })}
    </>
  );
}
