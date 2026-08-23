import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

// Explicit VITE_SERVER_URL always wins (split deployments). Otherwise dev talks to the
// local server on :4000, and a production build defaults to same-origin (single deploy).
const envUrl = import.meta.env.VITE_SERVER_URL as string | undefined;
const SERVER_URL = envUrl ?? (import.meta.env.DEV ? "http://localhost:4000" : undefined);

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, { autoConnect: true });
