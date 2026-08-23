import { useEffect, useState } from "react";
import { socket } from "./socket";
import type { RoomState } from "./types";
import type { Position } from "./world";
import Lobby from "./components/Lobby";
import GameShell from "./components/GameShell";

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [initialPositions, setInitialPositions] = useState<Record<string, Position>>({});

  useEffect(() => {
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onState(state: RoomState) {
      setRoom(state);
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
    setPlayerId(id);
    setInitialPositions(positions);
  }

  const me = room?.players.find((p) => p.id === playerId);

  if (!room || !playerId || !me) {
    return <Lobby connected={connected} onJoined={handleJoined} />;
  }

  return <GameShell room={room} meId={playerId} connected={connected} initialPositions={initialPositions} />;
}
