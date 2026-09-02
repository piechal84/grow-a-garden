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
  buyFoxEgg,
  buyGear,
  buyMoonPack,
  buyMoonPackBulk,
  buyPetEgg,
  buyPetEggBulk,
  buyPetSlot,
  buySeed,
  buySolarPack,
  buySolarPackBulk,
  collectAllVikingResearch,
  collectKitsuneCraft,
  collectPetMerge,
  collectVikingResearch,
  createTown,
  ensurePosition,
  ensureQuestsFresh,
  ensureStockFresh,
  equipPet,
  extractProgress,
  findTownByPlayer,
  getTown,
  growAll,
  harvest,
  harvestAll,
  joinTown,
  markDisconnected,
  moveIncubator,
  moveKitsuneShrine,
  movePlanting,
  movePlayer,
  moveYggdrasil,
  placeIncubator,
  placeKitsuneShrine,
  placeYggdrasil,
  plant,
  reclaim,
  reclaimIncubator,
  reclaimKitsuneShrine,
  reclaimYggdrasil,
  refreshDailyQuests,
  rerollQuest,
  sell,
  sellAll,
  sellDiamonds,
  startKitsuneCraft,
  startPetMerge,
  startVikingResearch,
  tickDragonInstaGrow,
  tickFoxAutoHarvest,
  unequipPet,
  upgradeYggdrasilSlots,
} from "./towns.js";
import type { ClientToServerEvents, TownState, ServerToClientEvents } from "./types.js";
import { flushProgress, initUserStore, login, register, saveProgress } from "./userStore.js";

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

function broadcast(town: TownState) {
  io.to(town.code).emit("state_update", town);
  for (const player of town.players) {
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

  socket.on("join_town", ({ townCode, playerName, clientId }, ack) => {
    const name = playerName.trim().slice(0, 20);
    if (!name) return ack({ ok: false, error: "Enter a name." });
    if (!clientId) return ack({ ok: false, error: "Missing client id." });

    let town: TownState;
    if (townCode) {
      const result = joinTown(townCode, clientId, name);
      if (result.error || !result.town) return ack({ ok: false, error: result.error ?? "Could not join town." });
      town = result.town;
    } else {
      town = createTown(clientId, name);
    }

    socket.data.clientId = clientId;
    socket.join(town.code);
    const player = town.players.find((p) => p.id === clientId)!;
    const spawn = ensurePosition(town, player);
    ack({ ok: true, townCode: town.code, playerId: clientId, positions: allPositions(town) });
    broadcast(town);
    io.to(town.code).emit("player_spawned", { playerId: clientId, x: spawn.x, y: spawn.y });
  });

  function currentPlayer() {
    const clientId = socket.data.clientId as string | undefined;
    if (!clientId) return { town: undefined, player: undefined };
    const town = findTownByPlayer(clientId);
    const player = town?.players.find((p) => p.id === clientId);
    if (player) {
      ensureQuestsFresh(player, Date.now());
      ensureStockFresh(player, Date.now());
    }
    return { town, player };
  }

  socket.on("leave_town", (ack) => {
    const { town } = currentPlayer();
    if (!town) return ack?.({ ok: false, error: "Not in a town." });
    const clientId = socket.data.clientId as string;
    const changedTown = markDisconnected(clientId);
    socket.leave(town.code);
    socket.data.clientId = undefined;
    ack?.({ ok: true });
    if (changedTown) broadcast(changedTown);
  });

  socket.on("buy_seed", ({ cropId, quantity }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = buySeed(player, cropId, quantity);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("plant", ({ x, y, cropId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = plant(town, player, x, y, cropId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("harvest", ({ plantingId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = harvest(town, player, plantingId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("harvest_all", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = harvestAll(town, player);
    ack?.({ ok: !result.error, error: result.error, count: result.count });
    if (!result.error) broadcast(town);
  });

  socket.on("grow_all", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = growAll(player);
    ack?.({ ok: !result.error, error: result.error, count: result.count });
    if (!result.error) broadcast(town);
  });

  socket.on("reclaim_planting", ({ plantingId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = reclaim(player, plantingId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("reclaim_incubator", ({ incubatorId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = reclaimIncubator(player, incubatorId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("move_planting", ({ plantingId, x, y }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = movePlanting(player, plantingId, x, y);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("move_incubator", ({ incubatorId, x, y }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = moveIncubator(player, incubatorId, x, y);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("sell", ({ cropId, sizeLabel, mutations, quantity }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = sell(player, cropId, sizeLabel, mutations, quantity);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("sell_all", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = sellAll(player);
    ack?.({ ok: !result.error, error: result.error, earned: result.earned, diamonds: result.diamonds, count: result.count });
    if (!result.error) broadcast(town);
  });

  socket.on("buy_gear", ({ gearId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = buyGear(town, player, gearId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("buy_pet_egg", ({ eggId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = buyPetEgg(town, player, eggId);
    ack?.({
      ok: !result.error,
      error: result.error,
      petId: result.petId,
      size: result.size,
      count: result.count,
    });
    if (!result.error) broadcast(town);
  });

  socket.on("buy_pet_egg_bulk", ({ eggId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = buyPetEggBulk(town, player, eggId);
    ack?.({ ok: !result.error, error: result.error, results: result.results, cost: result.cost });
    if (!result.error) broadcast(town);
  });

  socket.on("equip_pet", ({ petId, size }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = equipPet(town, player, petId, size);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("unequip_pet", ({ petId, size }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = unequipPet(town, player, petId, size);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("place_incubator", ({ x, y }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = placeIncubator(player, x, y);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("start_pet_merge", ({ incubatorId, petId, size }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = startPetMerge(player, incubatorId, petId, size);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("collect_pet_merge", ({ incubatorId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = collectPetMerge(player, incubatorId);
    ack?.({ ok: !result.error, error: result.error, petId: result.petId, size: result.size });
    if (!result.error) broadcast(town);
  });

  socket.on("buy_fox_egg", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = buyFoxEgg(player);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("place_kitsune_shrine", ({ x, y }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = placeKitsuneShrine(player, x, y);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("move_kitsune_shrine", ({ shrineId, x, y }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = moveKitsuneShrine(player, shrineId, x, y);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("reclaim_kitsune_shrine", ({ shrineId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = reclaimKitsuneShrine(player, shrineId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("start_kitsune_craft", ({ shrineId, recipe }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = startKitsuneCraft(player, shrineId, recipe);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("collect_kitsune_craft", ({ shrineId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = collectKitsuneCraft(player, shrineId);
    ack?.({ ok: !result.error, error: result.error, petId: result.petId, size: result.size });
    if (!result.error) broadcast(town);
  });

  socket.on("buy_pet_slot", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = buyPetSlot(player);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("buy_moon_pack", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const outcome = buyMoonPack(town, player);
    ack?.({ ok: !outcome.error, error: outcome.error, result: outcome.result });
    if (!outcome.error) broadcast(town);
  });

  socket.on("buy_moon_pack_bulk", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const outcome = buyMoonPackBulk(town, player);
    ack?.({ ok: !outcome.error, error: outcome.error, results: outcome.results, cost: outcome.cost });
    if (!outcome.error) broadcast(town);
  });

  socket.on("buy_solar_pack", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const outcome = buySolarPack(town, player);
    ack?.({ ok: !outcome.error, error: outcome.error, result: outcome.result });
    if (!outcome.error) broadcast(town);
  });

  socket.on("buy_solar_pack_bulk", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const outcome = buySolarPackBulk(town, player);
    ack?.({ ok: !outcome.error, error: outcome.error, results: outcome.results, cost: outcome.cost });
    if (!outcome.error) broadcast(town);
  });

  socket.on("place_yggdrasil", ({ x, y }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = placeYggdrasil(player, x, y);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("move_yggdrasil", ({ x, y }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = moveYggdrasil(player, x, y);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("reclaim_yggdrasil", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = reclaimYggdrasil(player);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("upgrade_yggdrasil", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = upgradeYggdrasilSlots(player);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("start_viking_research", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = startVikingResearch(player);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("collect_viking_research", ({ researchId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = collectVikingResearch(player, researchId);
    ack?.({ ok: !result.error, error: result.error, result: result.result });
    if (!result.error) broadcast(town);
  });

  socket.on("collect_all_viking_research", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = collectAllVikingResearch(player);
    ack?.({ ok: !result.error, error: result.error, results: result.results });
    if (!result.error) broadcast(town);
  });

  socket.on("buy_diamonds", ({ quantity }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const outcome = buyDiamonds(player, quantity);
    ack?.({ ok: !outcome.error, error: outcome.error });
    if (!outcome.error) broadcast(town);
  });

  socket.on("sell_diamonds", ({ quantity }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const outcome = sellDiamonds(player, quantity);
    ack?.({ ok: !outcome.error, error: outcome.error });
    if (!outcome.error) broadcast(town);
  });

  socket.on("reroll_quest", ({ questSet, questId }, ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = rerollQuest(player, questSet, questId);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("refresh_daily_quests", (ack) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return ack?.({ ok: false, error: "Not in a town." });
    const result = refreshDailyQuests(player);
    ack?.({ ok: !result.error, error: result.error });
    if (!result.error) broadcast(town);
  });

  socket.on("move", ({ x, y }) => {
    const { town, player } = currentPlayer();
    if (!town || !player) return;
    const { from, to, duration } = movePlayer(town, player.id, x, y);
    io.to(town.code).emit("player_moved", { playerId: player.id, from, to, startedAt: Date.now(), duration });
  });

  socket.on("disconnect", () => {
    const clientId = socket.data.clientId as string | undefined;
    if (!clientId) return;
    const town = markDisconnected(clientId);
    if (town) broadcast(town);
  });
});

// Baby Dragon's insta-grow and Fox's auto-harvest both need to fire on their own 60s cooldowns
// even when a player isn't taking any action, unlike everything else in this game (which is all
// lazily computed from stored timestamps on read/broadcast) — so they're the one thing driven by
// a real tick.
const PET_ABILITY_TICK_MS = 2000;
setInterval(() => {
  const dragonProcs = tickDragonInstaGrow();
  const foxChangedTowns = tickFoxAutoHarvest();
  const townsToBroadcast = new Map<string, TownState>();
  for (const proc of dragonProcs) {
    const town = getTown(proc.townCode);
    if (town) townsToBroadcast.set(town.code, town);
  }
  for (const town of foxChangedTowns) townsToBroadcast.set(town.code, town);
  for (const town of townsToBroadcast.values()) broadcast(town);
  for (const proc of dragonProcs) {
    io.to(proc.townCode).emit("dragon_insta_grow", proc);
  }
}, PET_ABILITY_TICK_MS);

await initUserStore();
httpServer.listen(PORT, () => {
  console.log(`Grow Garden server listening on http://localhost:${PORT}`);
});

// Render sends SIGTERM before killing the old instance on every redeploy — flush any
// debounced-but-not-yet-written save so a deploy can never eat someone's last few actions.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    flushProgress().finally(() => process.exit(0));
  });
}
