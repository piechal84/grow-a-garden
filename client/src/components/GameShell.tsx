import { useEffect, useRef, useState } from "react";
import { isMuted, setMuted } from "../sound";
import type { TownState } from "../types";
import type { Position } from "../world";
import HarvestCursorFollower from "./HarvestCursorFollower";
import PlayerSidebar from "./PlayerSidebar";
import WorldView from "./WorldView";

export default function GameShell({
  town,
  meId,
  connected,
  initialPositions,
  onChangeTown,
}: {
  town: TownState;
  meId: string;
  connected: boolean;
  initialPositions: Record<string, Position>;
  onChangeTown: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement != null);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (shellRef.current) {
        await shellRef.current.requestFullscreen();
      }
    } catch {
      // fullscreen unsupported or denied, ignore
    }
  }

  const me = town.players.find((p) => p.id === meId)!;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(town.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable, ignore
    }
  }

  return (
    <div className="game-shell" ref={shellRef}>
      <HarvestCursorFollower />
      <header className="game-header">
        <div className="game-header-left">
          <span className="game-title">🌱 Grow a Garden</span>
          <button className="town-code-badge" onClick={copyCode} title="Copy town code">
            Town {town.code} {copied ? "✓" : "⧉"}
          </button>
          <button
            className="town-code-badge"
            onClick={() => {
              if (window.confirm("Leave this town and return to the lobby?")) onChangeTown();
            }}
            title="Leave this town and join or create a different one"
          >
            🔀 Change Town
          </button>
        </div>
        <div className="game-header-right">
          <button
            className="mute-toggle"
            title={isFullscreen ? "Exit full screen" : "Enter full screen"}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? "🗗" : "⛶"}
          </button>
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
          <span className="diamond-display">💎 {me.diamonds}</span>
          <span className="kelka-crystal-display" title="Kelka Crystals — earned from daily quests, spent on Grow All">
            💠 {me.kelkaCrystals}
          </span>
        </div>
      </header>

      <div className="game-body">
        <PlayerSidebar players={town.players} meId={me.id} />

        <main className="game-main">
          <WorldView town={town} meId={meId} now={now} initialPositions={initialPositions} />
        </main>
      </div>
    </div>
  );
}
