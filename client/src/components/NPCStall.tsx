import { NPC_POSITIONS } from "../world";

const NPC_INFO = {
  seed: { emoji: "🧑‍🌾", label: "Seed Shop", accent: "#3fae5a" },
  gear: { emoji: "🧑‍🔧", label: "Gear Shop", accent: "#2f7dc4" },
  quests: { emoji: "📜", label: "Quest Giver", accent: "#c4472f" },
  merchant: { emoji: "🧺", label: "Merchant", accent: "#e0982a" },
  moon: { emoji: "🌙", label: "Moon Shop", accent: "#8a6fd8" },
} as const;

export type NPCKind = keyof typeof NPC_INFO;

export default function NPCStall({ kind, onClick }: { kind: NPCKind; onClick: () => void }) {
  const pos = NPC_POSITIONS[kind];
  const info = NPC_INFO[kind];

  return (
    <button
      className={`npc-stall ${kind === "moon" ? "npc-stall-moon" : ""}`}
      style={{ left: pos.x, top: pos.y, borderColor: info.accent }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <span className="npc-emoji">{info.emoji}</span>
      <span className="npc-label" style={{ background: info.accent }}>
        {info.label}
      </span>
    </button>
  );
}
