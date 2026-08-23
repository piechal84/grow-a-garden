import { useEffect, useState } from "react";
import { isMuted, setMuted } from "../sound";
import type { RoomState } from "../types";
import type { Position } from "../world";
import PlayerSidebar from "./PlayerSidebar";
import WorldView from "./WorldView";

export default function GameShell({
  room,
  meId,
  connected,
  initialPositions,
}: {
  room: RoomState;
  meId: string;
  connected: boolean;
  initialPositions: Record<string, Position>;
}) {
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const me = room.players.find((p) => p.id === meId)!;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable, ignore
    }
  }

  return (
    <div className="game-shell">
      <header className="game-header">
        <div className="game-header-left">
          <span className="game-title">🌱 Grow a Garden</span>
          <button className="room-code-badge" onClick={copyCode} title="Copy room code">
            Room {room.code} {copied ? "✓" : "⧉"}
          </button>
        </div>
        <div className="game-header-right">
          <button
            className="mute-toggle"
            title={muted ? "Unmute sound" : "Mute sound"}
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          {me.accountUsername && (
            <span className="account-pill" title="Your progress saves automatically">
              👤 {me.accountUsername}
            </span>
          )}
          <span className={`connection-pill ${connected ? "connection-on" : "connection-off"}`}>
            {connected ? "Online" : "Reconnecting…"}
          </span>
          <span className="coin-display">🪙 {me.coins}</span>
        </div>
      </header>

      <div className="game-body">
        <PlayerSidebar players={room.players} meId={me.id} />

        <main className="game-main">
          <WorldView room={room} meId={meId} now={now} initialPositions={initialPositions} />
        </main>
      </div>
    </div>
  );
}
