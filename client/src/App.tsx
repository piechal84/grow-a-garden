import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import type { JoinAck, RoomState } from "./types";
import type { Position } from "./world";
import Lobby, { ROOM_KEY } from "./components/Lobby";
import GameShell from "./components/GameShell";

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [initialPositions, setInitialPositions] = useState<Record<string, Position>>({});
  const [sessionError, setSessionError] = useState<string | null>(null);

  // A stable closure (the effect below never resubscribes) needs a way to read the *current*
  // room/playerId when a reconnect fires later, not whatever they were when the effect first ran.
  const roomRef = useRef(room);
  roomRef.current = room;
  const playerIdRef = useRef(playerId);
  playerIdRef.current = playerId;

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      const curRoom = roomRef.current;
      const curPlayerId = playerIdRef.current;
      if (!curRoom || !curPlayerId) return; // still on the lobby screen — nothing to restore
      const me = curRoom.players.find((p) => p.id === curPlayerId);
      if (!me) return;
      // Every reconnect is a brand-new socket server-side, which has never run join_room, so it
      // has no idea which room/player it belongs to — without this, every action after any
      // dropped connection (wifi blip, laptop sleep, a server redeploy) would silently fail with
      // "Not in a room" while the UI just sits there showing stale state, looking exactly like
      // harvesting/selling "does nothing".
      socket.emit("join_room", { roomCode: curRoom.code, playerName: me.name, clientId: curPlayerId }, (res: JoinAck) => {
        if (res.ok && res.positions) {
          setInitialPositions(res.positions);
        } else {
          // The room is gone for good (e.g. the server itself restarted) — bounce back to the
          // lobby with an explanation instead of leaving a dead, unresponsive screen up.
          setRoom(null);
          setPlayerId(null);
          setSessionError(res.error ?? "Your session ended — please rejoin.");
        }
      });
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
    setSessionError(null);
    setPlayerId(id);
    setInitialPositions(positions);
  }

  /** Returns to the lobby to join/create a different room over the same live connection —
   *  detaches from the current room server-side first (leave_room) and clears the remembered
   *  room code, or Lobby's auto-rejoin would silently take them straight back to it. */
  function handleChangeRoom() {
    socket.emit("leave_room");
    localStorage.removeItem(ROOM_KEY);
    setRoom(null);
    setPlayerId(null);
    setSessionError(null);
  }

  const me = room?.players.find((p) => p.id === playerId);

  if (!room || !playerId || !me) {
    return <Lobby connected={connected} onJoined={handleJoined} initialError={sessionError} />;
  }

  return (
    <GameShell
      room={room}
      meId={playerId}
      connected={connected}
      initialPositions={initialPositions}
      onChangeRoom={handleChangeRoom}
    />
  );
}
