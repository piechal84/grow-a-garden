import { useEffect, useRef, useState, type FormEvent } from "react";
import { socket } from "../socket";
import { getClientId } from "../clientId";
import type { AuthAck, JoinAck } from "../types";
import type { Position } from "../world";

const NAME_KEY = "grow-garden-name";
const USERNAME_KEY = "grow-garden-username";
const REMEMBER_KEY = "grow-garden-remembered-user";
/** The town code of whatever town this browser last successfully joined. A plain page reload
 *  has no in-memory town/socket state left to reconnect with (unlike a dropped-then-restored
 *  connection, which App.tsx handles separately) — without this, the town code field comes up
 *  empty and reaching for "Start a New Town" out of habit silently abandons the old town and
 *  rebuilds an account's player from whatever was last persisted to disk, discarding any more
 *  recent progress that was still only live in the abandoned town. */
export const TOWN_KEY = "grow-garden-town";

type Mode = "guest" | "account";

function loadRememberedUser(): { userId: string; username: string } | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.userId === "string" && typeof parsed.username === "string") return parsed;
  } catch {
    // corrupt/old data — ignore and fall back to a normal login
  }
  return null;
}

export default function Lobby({
  connected,
  onJoined,
  initialError,
}: {
  connected: boolean;
  onJoined: (playerId: string, positions: Record<string, Position>) => void;
  /** Seeds the error banner when App bounces back here after a reconnect couldn't restore the
   *  old session (e.g. the server itself restarted) — explains why they landed back at the
   *  lobby instead of leaving them guessing. */
  initialError?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(() => (loadRememberedUser() ? "account" : "guest"));
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [authedUser, setAuthedUser] = useState<{ userId: string; username: string } | null>(loadRememberedUser);
  const [townCode, setTownCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const autoRejoinTried = useRef(false);

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
    socket.emit("join_town", { townCode: codeToJoin, playerName, clientId }, (res: JoinAck) => {
      setBusy(false);
      if (res.ok && res.playerId) {
        if (res.townCode) localStorage.setItem(TOWN_KEY, res.townCode);
        onJoined(res.playerId, res.positions ?? {});
      } else {
        // Whether this was the auto-rejoin below or a manual attempt, the remembered town is
        // either gone or wrong — clear it so the lobby doesn't keep quietly retrying a dead town.
        localStorage.removeItem(TOWN_KEY);
        setError(res.error ?? "Could not join.");
      }
    });
  }

  // Silently rejoin the last town this browser was in, the moment we know who's asking (guest
  // name or logged-in account) and the socket is connected — so a plain refresh lands back in
  // the same game instead of an empty "type in a code or start fresh" screen.
  useEffect(() => {
    if (autoRejoinTried.current || !connected) return;
    const rememberedTown = localStorage.getItem(TOWN_KEY);
    if (!rememberedTown) return;
    const identityReady = mode === "account" ? !!authedUser : !!name.trim();
    if (!identityReady) return;
    autoRejoinTried.current = true;
    attemptJoin(rememberedTown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, mode, authedUser, name]);

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
        const user = { userId: res.userId, username: res.username };
        setAuthedUser(user);
        if (rememberMe) localStorage.setItem(REMEMBER_KEY, JSON.stringify(user));
        else localStorage.removeItem(REMEMBER_KEY);
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
    if (!townCode.trim()) {
      setError("Enter a town code.");
      return;
    }
    attemptJoin(townCode.trim());
  }

  const readyToPickTown = mode === "guest" || authedUser !== null;

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1>🌱 Grow a Garden</h1>
        <p className="lobby-sub">Plant, grow, and sell your way from cucumbers to dragon fruit — with up to 3 friends.</p>

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
            <label className="checkbox-field">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              <span>Remember me on this device</span>
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
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setAuthedUser(null);
                localStorage.removeItem(REMEMBER_KEY);
              }}
            >
              switch account
            </button>
          </p>
        )}

        {readyToPickTown && (
          <>
            <form onSubmit={handleJoin} className="join-form">
              <label className="field">
                <span>Town code</span>
                <input
                  value={townCode}
                  onChange={(e) => setTownCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  placeholder="ABCD"
                  className="town-code-input"
                />
              </label>
              <button type="submit" disabled={busy || !connected} className="btn btn-secondary">
                Join Town
              </button>
            </form>

            <div className="lobby-divider">or</div>

            <form onSubmit={handleCreate}>
              <button type="submit" disabled={busy || !connected} className="btn btn-primary">
                Start a New Town
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
