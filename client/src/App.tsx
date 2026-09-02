import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import type { JoinAck, TownState } from "./types";
import type { Position } from "./world";
import Lobby, { TOWN_KEY } from "./components/Lobby";
import GameShell from "./components/GameShell";

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [town, setTown] = useState<TownState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [initialPositions, setInitialPositions] = useState<Record<string, Position>>({});
  const [sessionError, setSessionError] = useState<string | null>(null);

  // A stable closure (the effect below never resubscribes) needs a way to read the *current*
  // town/playerId when a reconnect fires later, not whatever they were when the effect first ran.
  const townRef = useRef(town);
  townRef.current = town;
  const playerIdRef = useRef(playerId);
  playerIdRef.current = playerId;

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      const curTown = townRef.current;
      const curPlayerId = playerIdRef.current;
      if (!curTown || !curPlayerId) return; // still on the lobby screen — nothing to restore
      const me = curTown.players.find((p) => p.id === curPlayerId);
      if (!me) return;
      // Every reconnect is a brand-new socket server-side, which has never run join_town, so it
      // has no idea which town/player it belongs to — without this, every action after any
      // dropped connection (wifi blip, laptop sleep, a server redeploy) would silently fail with
      // "Not in a town" while the UI just sits there showing stale state, looking exactly like
      // harvesting/selling "does nothing".
      socket.emit("join_town", { townCode: curTown.code, playerName: me.name, clientId: curPlayerId }, (res: JoinAck) => {
        if (res.ok && res.positions) {
          setInitialPositions(res.positions);
        } else {
          // The town is gone for good (e.g. the server itself restarted) — bounce back to the
          // lobby with an explanation instead of leaving a dead, unresponsive screen up.
          setTown(null);
          setPlayerId(null);
          setSessionError(res.error ?? "Your session ended — please rejoin.");
        }
      });
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onState(state: TownState) {
      setTown(state);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state_update", onState);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state_update", onState);
    };
  }, []);

  function handleJoined(id: string, positions: Record<string, Position>) {
    setSessionError(null);
    setPlayerId(id);
    setInitialPositions(positions);
  }

  /** Returns to the lobby to join/create a different town over the same live connection —
   *  detaches from the current town server-side first (leave_town) and clears the remembered
   *  town code, or Lobby's auto-rejoin would silently take them straight back to it. */
  function handleChangeTown() {
    socket.emit("leave_town");
    localStorage.removeItem(TOWN_KEY);
    setTown(null);
    setPlayerId(null);
    setSessionError(null);
  }

  const me = town?.players.find((p) => p.id === playerId);

  if (!town || !playerId || !me) {
    return <Lobby connected={connected} onJoined={handleJoined} initialError={sessionError} />;
  }

  return (
    <GameShell
      town={town}
      meId={playerId}
      connected={connected}
      initialPositions={initialPositions}
      onChangeTown={handleChangeTown}
    />
  );
}
