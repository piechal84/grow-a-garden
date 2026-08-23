import { useState, type FormEvent } from "react";
import { socket } from "../socket";
import { getClientId } from "../clientId";
import type { AuthAck, JoinAck } from "../types";
import type { Position } from "../world";

const NAME_KEY = "grow-garden-name";
const USERNAME_KEY = "grow-garden-username";

type Mode = "guest" | "account";

export default function Lobby({
  connected,
  onJoined,
}: {
  connected: boolean;
  onJoined: (playerId: string, positions: Record<string, Position>) => void;
}) {
  const [mode, setMode] = useState<Mode>("guest");
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [authedUser, setAuthedUser] = useState<{ userId: string; username: string } | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function attemptJoin(codeToJoin?: string) {
    let clientId: string;
    let playerName: string;

    if (mode === "account" && authedUser) {
      clientId = authedUser.userId;
      playerName = authedUser.username;
    } else {
      const trimmed = name.trim();
      if (!trimmed) {
        setError("Enter a name first.");
        return;
      }
      localStorage.setItem(NAME_KEY, trimmed);
      clientId = getClientId();
      playerName = trimmed;
    }

    setBusy(true);
    setError(null);
    socket.emit("join_room", { roomCode: codeToJoin, playerName, clientId }, (res: JoinAck) => {
      setBusy(false);
      if (res.ok && res.playerId) {
        onJoined(res.playerId, res.positions ?? {});
      } else {
        setError(res.error ?? "Could not join.");
      }
    });
  }

  function handleAuth(kind: "login" | "register", e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter a username and password.");
      return;
    }
    setBusy(true);
    setError(null);
    socket.emit(kind, { username: username.trim(), password }, (res: AuthAck) => {
      setBusy(false);
      if (res.ok && res.userId && res.username) {
        localStorage.setItem(USERNAME_KEY, res.username);
        setPassword("");
        setAuthedUser({ userId: res.userId, username: res.username });
      } else {
        setError(res.error ?? "Could not authenticate.");
      }
    });
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    attemptJoin(undefined);
  }

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError("Enter a room code.");
      return;
    }
    attemptJoin(roomCode.trim());
  }

  const readyToPickRoom = mode === "guest" || authedUser !== null;

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1>🌱 Grow a Garden</h1>
        <p className="lobby-sub">Plant, grow, and sell your way from cucumbers to dragon fruit — with up to 6 friends.</p>

        <div className="mode-toggle">
          <button
            type="button"
            className={mode === "guest" ? "mode-btn mode-btn-active" : "mode-btn"}
            onClick={() => {
              setMode("guest");
              setError(null);
            }}
          >
            Play as Guest
          </button>
          <button
            type="button"
            className={mode === "account" ? "mode-btn mode-btn-active" : "mode-btn"}
            onClick={() => {
              setMode("account");
              setError(null);
            }}
          >
            Log In / Sign Up
          </button>
        </div>

        {mode === "guest" && (
          <label className="field">
            <span>Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="Sprout"
              autoFocus
            />
          </label>
        )}

        {mode === "account" && !authedUser && (
          <>
            <label className="field">
              <span>Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                placeholder="GreenThumb"
                autoFocus
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
            <div className="auth-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || !connected}
                onClick={(e) => handleAuth("login", e)}
              >
                Log In
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !connected}
                onClick={(e) => handleAuth("register", e)}
              >
                Create Account
              </button>
            </div>
            <p className="lobby-hint">Progress saves automatically once you're logged in — no email needed.</p>
          </>
        )}

        {mode === "account" && authedUser && (
          <p className="lobby-status">
            Logged in as <strong>{authedUser.username}</strong> ·{" "}
            <button type="button" className="link-btn" onClick={() => setAuthedUser(null)}>
              switch account
            </button>
          </p>
        )}

        {readyToPickRoom && (
          <>
            <form onSubmit={handleJoin} className="join-form">
              <label className="field">
                <span>Room code</span>
                <input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  placeholder="ABCD"
                  className="room-code-input"
                />
              </label>
              <button type="submit" disabled={busy || !connected} className="btn btn-secondary">
                Join Room
              </button>
            </form>

            <div className="lobby-divider">or</div>

            <form onSubmit={handleCreate}>
              <button type="submit" disabled={busy || !connected} className="btn btn-primary">
                Start a New Room
              </button>
            </form>
          </>
        )}

        {!connected && <p className="lobby-status">Connecting to server…</p>}
        {error && <p className="lobby-error">{error}</p>}
      </div>
    </div>
  );
}
