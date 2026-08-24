import { NPC_POSITIONS } from "../world";

export const NPC_INFO = {
  seed: { emoji: "🧑‍🌾", label: "Seed Shop", accent: "#3fae5a" },
  gear: { emoji: "🧑‍🔧", label: "Gear Shop", accent: "#2f7dc4" },
  quests: { emoji: "📜", label: "Quest Giver", accent: "#c4472f" },
  merchant: { emoji: "🧺", label: "Sell Crops", accent: "#e0982a" },
  moon: { emoji: "🌙", label: "Moon Shop", accent: "#8a6fd8" },
  premium: { emoji: "💎", label: "Premium Shop", accent: "#2fb8d6" },
} as const;

export const SOLAR_INFO = { emoji: "☀️", label: "Solar Shop", accent: "#f2b23a" };

export type NPCKind = keyof typeof NPC_INFO;

export default function NPCStall({
  kind,
  onClick,
  featuredShop,
}: {
  kind: NPCKind;
  onClick: () => void;
  /** Only relevant for kind === "moon" — Moon Shop and Solar Shop share one stall. */
  featuredShop?: "moon" | "solar";
}) {
  const pos = NPC_POSITIONS[kind];
  const isSolar = kind === "moon" && featuredShop === "solar";
  const info = isSolar ? SOLAR_INFO : NPC_INFO[kind];

  return (
    <button
      className={`npc-stall ${kind === "moon" ? (isSolar ? "npc-stall-solar" : "npc-stall-moon") : ""}`}
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
