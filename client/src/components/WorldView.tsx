import { useEffect, useRef, useState } from "react";
import { MAX_PLAYERS_PER_ROOM } from "../gameData";
import { socket } from "../socket";
import type { RoomState } from "../types";
import { getActiveWeather, getFeaturedShop, phaseInfo } from "../weather";
import {
  BASE_GRID_HEIGHT,
  CELL_SIZE,
  distance,
  MOVE_SPEED,
  NPC_INTERACT_RADIUS,
  NPC_POSITIONS,
  PLOT_GRID_WIDTH,
  plotOrigin,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Position,
} from "../world";
import { playDragonFruitEmber, playMoonBlossomChime, playThunderClap, startRainAmbience, stopRainAmbience } from "../sound";
import GardenDecor from "./GardenDecor";
import GearShopView from "./GearShopView";
import MerchantView from "./MerchantView";
import MoonShopView from "./MoonShopView";
import NPCStall, { type NPCKind } from "./NPCStall";
import PlotView from "./PlotView";
import PremiumShopView from "./PremiumShopView";
import QuestGiverView from "./QuestGiverView";
import SeedShopView from "./SeedShopView";
import ShopModal from "./ShopModal";
import SolarShopView from "./SolarShopView";
import WeatherBar from "./WeatherBar";
import { LightningBolts, RainParticles, SnowParticles } from "./WeatherParticles";

const AVATAR_OFFSET_X = 13;
const AVATAR_OFFSET_Y = 26;
const MOVE_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);

interface MoveState {
  from: Position;
  to: Position;
  startedAt: number;
  duration: number;
}

export default function WorldView({
  room,
  meId,
  now,
  initialPositions,
}: {
  room: RoomState;
  meId: string;
  now: number;
  initialPositions: Record<string, Position>;
}) {
  const worldRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const avatarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const moveStates = useRef<Map<string, MoveState>>(new Map());
  const pendingInteraction = useRef<NPCKind | null>(null);
  const [openShop, setOpenShop] = useState<NPCKind | null>(null);
  const [zoom, setZoom] = useState(1);
  const initialPositionsRef = useRef(initialPositions);

  const me = room.players.find((p) => p.id === meId);

  function fitZoomToViewport(): number {
    if (!viewportRef.current) return 1;
    const fitW = viewportRef.current.clientWidth / WORLD_WIDTH;
    const fitH = viewportRef.current.clientHeight / WORLD_HEIGHT;
    return Math.max(0.3, Math.min(1, Math.min(fitW, fitH)) - 0.02);
  }

  function scrollToOwnPlot(targetZoom: number) {
    if (!me || !viewportRef.current) return;
    const origin = plotOrigin(me.slotIndex);
    const plotCenterX = (origin.x + (PLOT_GRID_WIDTH * CELL_SIZE) / 2) * targetZoom;
    const targetLeft = plotCenterX - viewportRef.current.clientWidth / 2;
    viewportRef.current.scrollTo({ left: Math.max(0, targetLeft), top: 0, behavior: "auto" });
  }

  useEffect(() => {
    for (const [playerId, pos] of Object.entries(initialPositionsRef.current)) {
      moveStates.current.set(playerId, { from: pos, to: pos, startedAt: 0, duration: 0 });
    }
    // On small viewports, start zoomed out enough to see more of the map at once.
    const initialZoom = viewportRef.current && viewportRef.current.clientWidth < WORLD_WIDTH ? fitZoomToViewport() : 1;
    setZoom(initialZoom);
    // Center horizontally on the player's own plot, but anchor to the top so the market
    // row (NPC shops) is always visible on arrival instead of being scrolled past.
    requestAnimationFrame(() => scrollToOwnPlot(initialZoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFitAll() {
    const next = fitZoomToViewport();
    setZoom(next);
    viewportRef.current?.scrollTo({ left: 0, top: 0, behavior: "auto" });
  }

  function handleMyGarden() {
    const next = 1;
    setZoom(next);
    requestAnimationFrame(() => scrollToOwnPlot(next));
  }

  function handleZoomStep(delta: number) {
    setZoom((z) => Math.round(Math.min(1.4, Math.max(0.3, z + delta)) * 100) / 100);
  }

  // Auto-shrink to fit when the window/device viewport gets smaller (e.g. rotating a
  // tablet or leaving full screen); never auto-grows, so a manual zoom-in is respected.
  useEffect(() => {
    function onResize() {
      const fit = fitZoomToViewport();
      setZoom((z) => (fit < z ? fit : z));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function onSpawned({ playerId, x, y }: { playerId: string; x: number; y: number }) {
      moveStates.current.set(playerId, { from: { x, y }, to: { x, y }, startedAt: 0, duration: 0 });
    }
    function onMoved(payload: MoveState & { playerId: string }) {
      moveStates.current.set(payload.playerId, payload);
      if (payload.playerId === meId && pendingInteraction.current) {
        const kind = pendingInteraction.current;
        pendingInteraction.current = null;
        window.setTimeout(() => setOpenShop(kind), payload.duration);
      }
    }
    socket.on("player_spawned", onSpawned);
    socket.on("player_moved", onMoved);
    return () => {
      socket.off("player_spawned", onSpawned);
      socket.off("player_moved", onMoved);
    };
  }, [meId]);

  useEffect(() => {
    let raf: number;
    function tick() {
      const t = Date.now();
      for (const [playerId, node] of avatarRefs.current) {
        const state = moveStates.current.get(playerId);
        if (!state) continue;
        const pct = state.duration <= 0 ? 1 : Math.min(1, (t - state.startedAt) / state.duration);
        const x = state.from.x + (state.to.x - state.from.x) * pct;
        const y = state.from.y + (state.to.y - state.from.y) * pct;
        node.style.transform = `translate(${x - AVATAR_OFFSET_X}px, ${y - AVATAR_OFFSET_Y}px)`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function currentRestPosition(playerId: string): Position {
    return moveStates.current.get(playerId)?.to ?? { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
  }

  function moveTo(target: Position) {
    socket.emit("move", target);
  }

  // WASD / arrow-key movement — an alternative to click-to-move for players whose clicks
  // aren't registering (e.g. a flaky connection swallowing the occasional click) or who just
  // prefer a keyboard. Steps the avatar's current position forward at MOVE_SPEED while a
  // movement key is held, reusing the same "move" emit click-to-move already uses.
  const pressedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (!MOVE_KEYS.has(key) || isTypingTarget(e.target)) return;
      pressedKeysRef.current.add(key);
    }
    function onKeyUp(e: KeyboardEvent) {
      pressedKeysRef.current.delete(e.key.toLowerCase());
    }
    function onBlur() {
      pressedKeysRef.current.clear();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const STEP_MS = 150;
    const interval = window.setInterval(() => {
      if (openShop) return; // don't wander while a shop modal is open
      const keys = pressedKeysRef.current;
      let dx = 0;
      let dy = 0;
      if (keys.has("w") || keys.has("arrowup")) dy -= 1;
      if (keys.has("s") || keys.has("arrowdown")) dy += 1;
      if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
      if (keys.has("d") || keys.has("arrowright")) dx += 1;
      if (dx === 0 && dy === 0) return;
      const len = Math.hypot(dx, dy);
      const stepDist = (MOVE_SPEED * STEP_MS) / 1000;
      const cur = currentRestPosition(meId);
      moveTo({ x: cur.x + (dx / len) * stepDist, y: cur.y + (dy / len) * stepDist });
    }, STEP_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, openShop]);

  function handleWorldClick(e: React.MouseEvent) {
    if (e.target !== worldRef.current) return;
    if (!worldRef.current) return;
    const rect = worldRef.current.getBoundingClientRect();
    moveTo({ x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom });
  }

  function handleNpcClick(kind: NPCKind) {
    const npcPos = NPC_POSITIONS[kind];
    const myPos = currentRestPosition(meId);
    if (distance(myPos, npcPos) <= NPC_INTERACT_RADIUS) {
      setOpenShop(kind);
      return;
    }
    pendingInteraction.current = kind;
    moveTo({ x: npcPos.x, y: npcPos.y + 46 });
  }

  const { isDay } = phaseInfo(room.createdAt, now);
  const { temperature, sky } = getActiveWeather(room.createdAt, now);
  const featuredShop = getFeaturedShop(room.createdAt, now);

  const plantWorldPositions: Position[] = room.players.flatMap((p) => {
    const origin = plotOrigin(p.slotIndex);
    return p.plantings.map((planting) => ({
      x: origin.x + (planting.x + planting.w / 2) * CELL_SIZE,
      y: origin.y + (planting.y + planting.h / 2) * CELL_SIZE,
    }));
  });

  useEffect(() => {
    if (sky.id === "rain" || sky.id === "thunderstorm") {
      startRainAmbience();
    } else {
      stopRainAmbience();
    }
    return () => stopRainAmbience();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sky.id]);

  useEffect(() => {
    if (sky.id !== "thunderstorm") return;
    const initial = window.setTimeout(() => playThunderClap(), 6500);
    const interval = window.setInterval(() => playThunderClap(), 7000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [sky.id]);

  const hasMoonBlossom = me?.plantings.some((p) => p.cropId === "moon_blossom") ?? false;
  const hasDragonFruit = me?.plantings.some((p) => p.cropId === "dragonfruit") ?? false;

  useEffect(() => {
    if (!hasMoonBlossom) return;
    const initial = window.setTimeout(() => playMoonBlossomChime(), 4000);
    const interval = window.setInterval(() => playMoonBlossomChime(), 32_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [hasMoonBlossom]);

  useEffect(() => {
    if (!hasDragonFruit) return;
    const initial = window.setTimeout(() => playDragonFruitEmber(), 9000);
    const interval = window.setInterval(() => playDragonFruitEmber(), 28_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [hasDragonFruit]);

  return (
    <div className="world-scroll">
      <WeatherBar roomCreatedAt={room.createdAt} now={now} />
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={handleFitAll} title="See all gardens">
          🗺️ Overview
        </button>
        <button className="zoom-btn" onClick={handleMyGarden} title="Zoom to your garden">
          🌾 My Garden
        </button>
        <button className="zoom-btn zoom-step" onClick={() => handleZoomStep(-0.1)} title="Zoom out">
          −
        </button>
        <span className="zoom-pct">{Math.round(zoom * 100)}%</span>
        <button className="zoom-btn zoom-step" onClick={() => handleZoomStep(0.1)} title="Zoom in">
          +
        </button>
      </div>
      <div className="world-viewport" ref={viewportRef}>
      <div
        className="world-scaler"
        style={{ width: WORLD_WIDTH * zoom, height: WORLD_HEIGHT * zoom }}
      >
      <div
        ref={worldRef}
        className="world"
        style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `scale(${zoom})`, transformOrigin: "top left" }}
        onClick={handleWorldClick}
      >
        <GardenDecor />
        {!isDay && <div className="weather-overlay night-overlay" />}
        {temperature.id !== "clear" && <div className={`weather-overlay temp-overlay-${temperature.id}`} />}
        {sky.id !== "clear" && <div className={`weather-overlay sky-overlay-${sky.id}`} />}
        {temperature.id === "freeze" && <SnowParticles />}
        {(sky.id === "rain" || sky.id === "thunderstorm") && <RainParticles />}
        {sky.id === "thunderstorm" && (
          <>
            <div className="lightning-flash" />
            <LightningBolts targets={plantWorldPositions} />
          </>
        )}

        <NPCStall kind="seed" onClick={() => handleNpcClick("seed")} />
        <NPCStall kind="gear" onClick={() => handleNpcClick("gear")} />
        <NPCStall kind="quests" onClick={() => handleNpcClick("quests")} />
        <NPCStall kind="merchant" onClick={() => handleNpcClick("merchant")} />
        <NPCStall kind="moon" featuredShop={featuredShop} onClick={() => handleNpcClick("moon")} />
        <NPCStall kind="premium" onClick={() => handleNpcClick("premium")} />

        {Array.from({ length: MAX_PLAYERS_PER_ROOM }, (_, slot) => {
          const player = room.players.find((p) => p.slotIndex === slot);
          const origin = plotOrigin(slot);
          if (!player) {
            return (
              <div
                key={`vacant-${slot}`}
                className="world-plot world-plot-vacant"
                style={{
                  left: origin.x,
                  top: origin.y,
                  width: PLOT_GRID_WIDTH * CELL_SIZE,
                  height: BASE_GRID_HEIGHT * CELL_SIZE,
                }}
              >
                <span className="world-plot-vacant-label">Open seat</span>
              </div>
            );
          }
          return (
            <div key={player.id} data-slot={slot}>
              <PlotView
                player={player}
                isOwner={player.id === meId}
                now={now}
                roomCreatedAt={room.createdAt}
                onWalkTo={moveTo}
              />
            </div>
          );
        })}

        {room.players.map((p) => (
          <div
            key={p.id}
            className={`avatar ${p.connected ? "" : "avatar-offline"} ${p.id === meId ? "avatar-me" : ""}`}
            ref={(node) => {
              if (node) avatarRefs.current.set(p.id, node);
              else avatarRefs.current.delete(p.id);
            }}
            style={{
              transform: `translate(${currentRestPosition(p.id).x - AVATAR_OFFSET_X}px, ${
                currentRestPosition(p.id).y - AVATAR_OFFSET_Y
              }px)`,
            }}
          >
            <span className="avatar-shadow" />
            <span className="avatar-emoji">🧑‍🌾</span>
            <span className="avatar-name">{p.name}</span>
          </div>
        ))}
      </div>
      </div>
      </div>

      {openShop && me && (
        <ShopModal onClose={() => setOpenShop(null)}>
          {openShop === "seed" && <SeedShopView player={me} now={now} />}
          {openShop === "gear" && <GearShopView player={me} />}
          {openShop === "quests" && <QuestGiverView player={me} />}
          {openShop === "merchant" && <MerchantView player={me} />}
          {openShop === "moon" && featuredShop === "moon" && <MoonShopView player={me} />}
          {openShop === "moon" && featuredShop === "solar" && <SolarShopView player={me} />}
          {openShop === "premium" && <PremiumShopView player={me} />}
        </ShopModal>
      )}
    </div>
  );
}
