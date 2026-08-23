import type { PlayerState } from "../types";

export default function PlayerSidebar({ players, meId }: { players: PlayerState[]; meId: string }) {
  const sorted = [...players].sort((a, b) => b.coins - a.coins);

  return (
    <aside className="player-sidebar">
      <h3>Garden Party</h3>
      <ul className="player-list">
        {sorted.map((p) => (
          <li key={p.id}>
            <div className={`player-row ${p.id === meId ? "player-row-active" : ""}`}>
              <span className={`presence-dot ${p.connected ? "presence-on" : "presence-off"}`} />
              <span className="player-row-name">
                {p.name}
                {p.id === meId && " (you)"}
              </span>
              <span className="player-row-coins">🪙 {p.coins}</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
