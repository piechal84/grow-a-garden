import { useEffect, useRef, useState } from "react";
import { equippedPetsInfo, evolutionInfo } from "../petData";
import type { PlayerState } from "../types";
import { CELL_SIZE } from "../world";
import PetIcon from "./PetIcon";

const WANDER_INTERVAL_MS = 4500;
const EMBER_LIFETIME_MS = 1100;
const EMBERS_PER_STEP = 3;

interface Ember {
  id: number;
  x: number;
  y: number;
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
  const [embers, setEmbers] = useState<Ember[]>([]);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const emberIdRef = useRef(0);

  useEffect(() => {
    setPositions(pets.map(() => ({ x: Math.random() * width, y: Math.random() * height })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petsKey, width, height]);

  useEffect(() => {
    if (pets.length === 0) return;
    const interval = window.setInterval(() => {
      const prevPositions = positionsRef.current;
      const newEmbers: Ember[] = [];
      pets.forEach((p, i) => {
        if (evolutionInfo(p.petId).baseId !== "phoenix_chick") return;
        const pos = prevPositions[i];
        if (!pos) return;
        for (let e = 0; e < EMBERS_PER_STEP; e++) {
          emberIdRef.current += 1;
          newEmbers.push({
            id: emberIdRef.current,
            x: pos.x + (Math.random() - 0.5) * 10,
            y: pos.y + (Math.random() - 0.5) * 10,
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
      setPositions((prev) => prev.map(() => ({ x: Math.random() * width, y: Math.random() * height })));
    }, WANDER_INTERVAL_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petsKey, width, height]);

  return (
    <>
      {embers.map((em) => (
        <span key={em.id} className="pet-fire-ember" style={{ transform: `translate(${em.x}px, ${em.y}px)` }} />
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
            <PetIcon pet={p.pet} size={20} />
          </span>
        );
      })}
    </>
  );
}
