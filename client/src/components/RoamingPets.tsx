import { useEffect, useState } from "react";
import { equippedPetsInfo } from "../petData";
import type { PlayerState } from "../types";
import { CELL_SIZE } from "../world";

const WANDER_INTERVAL_MS = 4500;

/** Purely cosmetic — every equipped pet wanders to a new random spot within its owner's plot
 *  every few seconds. Each client picks its own random walk locally (no server sync needed,
 *  same as any other ambient animation), so exact paths can differ between viewers. */
export default function RoamingPets({ player }: { player: PlayerState }) {
  const pets = equippedPetsInfo(player.petsEquipped);
  const width = player.gridWidth * CELL_SIZE;
  const height = player.gridHeight * CELL_SIZE;
  const petsKey = pets.map((p) => `${p.petId}#${p.size}`).join(",");

  const [positions, setPositions] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    setPositions(pets.map(() => ({ x: Math.random() * width, y: Math.random() * height })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petsKey, width, height]);

  useEffect(() => {
    if (pets.length === 0) return;
    const interval = window.setInterval(() => {
      setPositions((prev) => prev.map(() => ({ x: Math.random() * width, y: Math.random() * height })));
    }, WANDER_INTERVAL_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petsKey, width, height]);

  return (
    <>
      {pets.map((p, i) => {
        const pos = positions[i] ?? { x: 0, y: 0 };
        return (
          <span
            key={`${p.petId}-${p.size}-${i}`}
            className="roaming-pet"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            title={p.pet.name}
          >
            {p.pet.emoji}
          </span>
        );
      })}
    </>
  );
}
