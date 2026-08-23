import { WORLD_HEIGHT, WORLD_WIDTH } from "../world";

const DECOR = ["🌳", "🌲", "🌳", "🌿", "🪨", "🌸", "🍄", "🌼", "🌾", "🌳"];

interface DecorItem {
  x: number;
  y: number;
  emoji: string;
  size: number;
}

function buildDecor(): DecorItem[] {
  const items: DecorItem[] = [];
  let i = 0;

  for (let y = 60; y < WORLD_HEIGHT - 40; y += 110) {
    items.push({ x: 28, y, emoji: DECOR[i % DECOR.length], size: 24 + (i % 3) * 7 });
    i++;
    items.push({ x: WORLD_WIDTH - 28, y: y + 45, emoji: DECOR[(i + 3) % DECOR.length], size: 24 + (i % 3) * 7 });
    i++;
  }

  for (let x = 40; x < WORLD_WIDTH - 40; x += 95) {
    items.push({ x, y: WORLD_HEIGHT - 22, emoji: DECOR[(i + 1) % DECOR.length], size: 22 + (i % 3) * 6 });
    i++;
  }

  return items;
}

const DECOR_ITEMS = buildDecor();

/** Purely cosmetic border scenery — pointer-events:none so it never intercepts clicks. */
export default function GardenDecor() {
  return (
    <>
      {DECOR_ITEMS.map((it, i) => (
        <span key={i} className="garden-decor" style={{ left: it.x, top: it.y, fontSize: it.size }}>
          {it.emoji}
        </span>
      ))}
    </>
  );
}
