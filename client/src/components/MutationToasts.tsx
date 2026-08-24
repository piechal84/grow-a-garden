import { useEffect, useRef, useState } from "react";
import { getAnyCropDef } from "../solarData";
import type { PlayerState } from "../types";
import { MUTATIONS, mutationKey } from "../weather";

interface Toast {
  id: string;
  text: string;
  color: string;
}

const TOAST_DURATION_MS = 5000;

/** Announces newly-rolled mutations on the player's own plantings as a banner above the garden —
 *  diffs each planting's mutation set against the previous snapshot so it only fires on an actual
 *  change (a fresh plant, or a persistent crop regrowing with a new roll), never retroactively for
 *  crops that were already mutated before this component mounted. */
export default function MutationToasts({ player }: { player: PlayerState | undefined }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!player) return;
    const prev = prevRef.current;
    const next = new Map<string, string>();
    const newToasts: Toast[] = [];

    for (const planting of player.plantings) {
      const key = mutationKey(planting.mutations);
      next.set(planting.id, key);
      if (planting.mutations.length === 0 || !prev) continue;
      const prevMutations = prev.get(planting.id)?.split(",") ?? [];
      const cropName = getAnyCropDef(planting.cropId)?.name ?? planting.cropId;
      for (const m of planting.mutations) {
        if (prevMutations.includes(m)) continue;
        const mutation = MUTATIONS[m];
        newToasts.push({
          id: `${planting.id}-${m}-${Date.now()}`,
          text: `${cropName} is now ${mutation.label}!`,
          color: mutation.color,
        });
      }
    }

    prevRef.current = next;
    if (newToasts.length === 0) return;
    setToasts((cur) => [...cur, ...newToasts]);
    for (const t of newToasts) {
      window.setTimeout(() => {
        setToasts((cur) => cur.filter((x) => x.id !== t.id));
      }, TOAST_DURATION_MS);
    }
  }, [player]);

  if (toasts.length === 0) return null;

  return (
    <div className="mutation-toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="mutation-toast" style={{ borderColor: t.color }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
