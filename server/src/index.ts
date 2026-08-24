import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import {
  allPositions,
  buyDiamonds,
  buyGear,
  buyMoonPack,
  buyMoonPackBulk,
  buyPet,
  buySeed,
  buySolarPack,
  buySolarPackBulk,
  createRoom,
  ensurePosition,
  ensureQuestsFresh,
  ensureStockFresh,
  extractProgress,
  findRoomByPlayer,
  harvest,
  joinRoom,
  markDisconnected,
  movePlanting,
  movePlayer,
  plant,
  reclaim,
  rerollQuest,
  sell,
  sellAll,
  sellDiamonds,
} from "./rooms.js";
import type { ClientToServerEvents, RoomState, ServerToClientEvents } from "./types.js";
import { initUserStore, login, register, saveProgress } from "./userStore.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true }));

// In a single-deploy setup the built client sits at client/dist alongside this server;
// serve it (with an SPA fallback) so the whole game is reachable from one URL.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
});

function broadcast(room: RoomState) {
  io.to(room.code).emit("state_update", room);
  for (const player of room.players) {
    if (player.accountUsername) saveProgress(player.id, extractProgress(player));
  }
}

io.on("connection", (socket) => {
  socket.on("register", ({ username, password }, ack) => {
    const result = register(username, password);
    if (!result.ok || !result.user) return ack({ ok: false, error: result.error });
    ack({ ok: true, userId: result.user.id, username: result.user.username });
  });

  socket.on("login", ({ username, password }, ack) => {
    const result = login(username, password);
    if (!result.ok || !result.user) return ack({ ok: false, error: result.error });
    ack({ ok: true, userId: result.user.id, username: result.user.username });
  });

  socket.on("join_room", ({ roomCode, playerName, clientId }, ack) => {
    const name = playerName.trim().slice(0, 20);
    if (!name) return ack({ ok: false, error: "Enter a name." });
    if (!clientId) return ack({ ok: false, error: "Missing client id." });

    let room: RoomState;
    if (roomCode) {
      const result = joinRoom(roomCode, clientId, name);
      if (result.error || !result.room) return ack({ ok: false, error: result.error ?? "Could not join room." });
      room = result.room;
    } else {
      room = createRoom(clientId, name);
    }

    socket.data.clientId = clientId;
    socket.join(room.code);
    const player = room.players.find((p) => p.id === clientId)!;
    const spawn = ensurePosition(room, player);
    ack({ ok: true, roomCode: room.code, playerId: clientId, positions: allPositions(room) });
    broadcast(room);
    io.to(room.code).emit("player_spawned", { playerId: clientId, x: spawn.x, y: spawn.y });
  });

  function currentPlayer() {
    const clientId = socket.data.clientId as string | undefined;
    if (!clientId) return { room: undefined, player: undefined };
    const room = findRoomByPlayer(clientId);
    const player = room?.players.find((p) => p.id === clientId);
    if (player) {
      ensureQuestsFresh(player, Date.now());
      ensureStockFresh(player, Date.now());
    }
    return { room, player };
  }

  socket.on("buy_seed", ({ cropId, quantity }, ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const result = buySeed(player, cropId, quantity);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(room);
  });

  socket.on("plant", ({ x, y, cropId }, ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const result = plant(room, player, x, y, cropId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(room);
  });

  socket.on("harvest", ({ plantingId }, ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const result = harvest(room, player, plantingId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(room);
  });

  socket.on("reclaim_planting", ({ plantingId }, ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const result = reclaim(player, plantingId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(room);
  });

  socket.on("move_planting", ({ plantingId, x, y }, ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const result = movePlanting(player, plantingId, x, y);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(room);
  });

  socket.on("sell", ({ cropId, sizeLabel, mutations, quantity }, ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const result = sell(player, cropId, sizeLabel, mutations, quantity);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(room);
  });

  socket.on("sell_all", (ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const result = sellAll(player);
    ack?.({ ok: !result.error, error: result.error, earned: result.earned, diamonds: result.diamonds, count: result.count });
    if (!result.error) broadcast(room);
  });

  socket.on("buy_gear", ({ gearId }, ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const result = buyGear(player, gearId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(room);
  });

  socket.on("buy_pet", ({ petId }, ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const result = buyPet(player, petId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(room);
  });

  socket.on("buy_moon_pack", (ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const outcome = buyMoonPack(room, player);
    ack?.({ ok: !outcome.error, error: outcome.error, result: outcome.result });
    if (!outcome.error) broadcast(room);
  });

  socket.on("buy_moon_pack_bulk", (ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const outcome = buyMoonPackBulk(room, player);
    ack?.({ ok: !outcome.error, error: outcome.error, results: outcome.results, cost: outcome.cost });
    if (!outcome.error) broadcast(room);
  });

  socket.on("buy_solar_pack", (ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const outcome = buySolarPack(room, player);
    ack?.({ ok: !outcome.error, error: outcome.error, result: outcome.result });
    if (!outcome.error) broadcast(room);
  });

  socket.on("buy_solar_pack_bulk", (ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const outcome = buySolarPackBulk(room, player);
    ack?.({ ok: !outcome.error, error: outcome.error, results: outcome.results, cost: outcome.cost });
    if (!outcome.error) broadcast(room);
  });

  socket.on("buy_diamonds", ({ quantity }, ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const outcome = buyDiamonds(player, quantity);
    ack?.({ ok: !outcome.error, error: outcome.error });
    if (!outcome.error) broadcast(room);
  });

  socket.on("sell_diamonds", ({ quantity }, ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const outcome = sellDiamonds(player, quantity);
    ack?.({ ok: !outcome.error, error: outcome.error });
    if (!outcome.error) broadcast(room);
  });

  socket.on("reroll_quest", ({ questSet, questId }, ack) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return ack?.({ ok: false, error: "Not in a room." });
    const result = rerollQuest(player, questSet, questId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(room);
  });

  socket.on("move", ({ x, y }) => {
    const { room, player } = currentPlayer();
    if (!room || !player) return;
    const { from, to, duration } = movePlayer(room, player.id, x, y);
    io.to(room.code).emit("player_moved", { playerId: player.id, from, to, startedAt: Date.now(), duration });
  });

  socket.on("disconnect", () => {
    const clientId = socket.data.clientId as string | undefined;
    if (!clientId) return;
    const room = markDisconnected(clientId);
    if (room) broadcast(room);
  });
});

await initUserStore();
httpServer.listen(PORT, () => {
  console.log(`Grow Garden server listening on http://localhost:${PORT}`);
});
