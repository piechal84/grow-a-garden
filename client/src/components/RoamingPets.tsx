import { useEffect, useRef, useState } from "react";
import { equippedPetsInfo, evolutionInfo } from "../petData";
import type { PlayerState } from "../types";
import { CELL_SIZE } from "../world";
import PetIcon from "./PetIcon";

const WANDER_INTERVAL_MS = 4500;
const EMBER_LIFETIME_MS = 1100;
const EMBERS_PER_STEP = 3;
/** Must match .roaming-pet's `transition: transform` duration in index.css — how long a wander
 *  step visually takes to glide to its new spot, after which the pet reads as "landed" again. */
const MOVE_TRANSITION_MS = 3600;

interface Ember {
  id: number;
  x: number;
  y: number;
  heading: number;
}

const FLARE_COLORS = ["#ffb23d", "#ff6a1e", "#ff9ad1", "#c77dff", "#6fa0f0"];
const FLARE_SPREAD_DEG = 65;

function flareSliverPath(len: number): string {
  return `M0,0 L-1.1,${-len * 0.55} Q0,${-len} 1.1,${-len * 0.55} Z`;
}

/** A small directional flame streak trailing behind a roaming Phoenix Chick — fanned out around
 *  `heading` (the compass angle, 0=up/clockwise, the pet is opposite the flame should point:
 *  {@link RoamingPets} passes the reverse of its travel direction), orange/red at the core
 *  fading to pink/purple/blue at the fan's edges. */
function FireFlare({ heading }: { heading: number }) {
  const n = FLARE_COLORS.length;
  return (
    <svg width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true">
      {FLARE_COLORS.map((color, i) => {
        const angle = heading - FLARE_SPREAD_DEG / 2 + (FLARE_SPREAD_DEG / (n - 1)) * i;
        const len = 7 + (i % 3);
        return <path key={i} d={flareSliverPath(len)} fill={color} transform={`rotate(${angle})`} />;
      })}
      <circle cx="0" cy="0" r="1.4" fill="#ffe27a" />
    </svg>
  );
}

/** Purely cosmetic — every equipped pet wanders to a new random spot within its owner's plot
 *  every few seconds. Each client picks its own random walk locally (no server sync needed,
 *  same as any other ambient animation), so exact paths can differ between viewers. Phoenix
 *  Chicks additionally drop a few fading embers at their old spot on every move, reading as a
 *  faint fire trail left behind as they wander. */
export default function RoamingPets({ player }: { player: PlayerState }) {
  const pets = equippedPetsInfo(player.petsEquipped);
  const width = player.gridWidth * CELL_SIZE;
  const height = player.gridHeight * CELL_SIZE;
  const petsKey = pets.map((p) => `${p.petId}#${p.size}`).join(",");

  const [positions, setPositions] = useState<{ x: number; y: number }[]>([]);
  const [moving, setMoving] = useState<boolean[]>([]);
  const [embers, setEmbers] = useState<Ember[]>([]);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const emberIdRef = useRef(0);

  useEffect(() => {
    setPositions(pets.map(() => ({ x: Math.random() * width, y: Math.random() * height })));
    setMoving(pets.map(() => false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petsKey, width, height]);

  useEffect(() => {
    if (pets.length === 0) return;
    const interval = window.setInterval(() => {
      const prevPositions = positionsRef.current;
      const nextPositions = pets.map(() => ({ x: Math.random() * width, y: Math.random() * height }));
      const newEmbers: Ember[] = [];
      pets.forEach((p, i) => {
        if (evolutionInfo(p.petId).baseId !== "phoenix_chick") return;
        const from = prevPositions[i];
        const to = nextPositions[i];
        if (!from || !to) return;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        // Compass bearing (0=up, clockwise) of the travel direction — matches how `rotate()`
        // orients our flame slivers, which point "up" at rotate(0). The flame trails behind, so
        // it points the reverse of that bearing (+180).
        const travelHeading = (Math.atan2(dx, -dy) * 180) / Math.PI;
        const heading = travelHeading + 180;
        for (let e = 0; e < EMBERS_PER_STEP; e++) {
          emberIdRef.current += 1;
          newEmbers.push({
            id: emberIdRef.current,
            x: from.x + (Math.random() - 0.5) * 6,
            y: from.y + (Math.random() - 0.5) * 6,
            heading: heading + (Math.random() - 0.5) * 12,
          });
        }
      });
      if (newEmbers.length > 0) {
        setEmbers((cur) => [...cur, ...newEmbers]);
        for (const em of newEmbers) {
          window.setTimeout(() => {
            setEmbers((cur) => cur.filter((x) => x.id !== em.id));
          }, EMBER_LIFETIME_MS);
        }
      }
      setPositions(nextPositions);
      setMoving(pets.map(() => true));
      window.setTimeout(() => setMoving(pets.map(() => false)), MOVE_TRANSITION_MS);
    }, WANDER_INTERVAL_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petsKey, width, height]);

  return (
    <>
      {embers.map((em) => (
        <span key={em.id} className="pet-fire-ember" style={{ transform: `translate(${em.x}px, ${em.y}px)` }}>
          <FireFlare heading={em.heading} />
        </span>
      ))}
      {pets.map((p, i) => {
        const pos = positions[i] ?? { x: 0, y: 0 };
        return (
          <span
            key={`${p.petId}-${p.size}-${i}`}
            className="roaming-pet"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            title={p.pet.name}
          >
            <PetIcon pet={p.pet} size={20} variant="top" moving={moving[i] ?? false} />
          </span>
        );
      })}
    </>
  );
}
