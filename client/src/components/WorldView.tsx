import { useEffect, useRef, useState } from "react";
import { MAX_PLAYERS_PER_ROOM } from "../gameData";
import { equippedPetsInfo, type Pet, type PetSize } from "../petData";
import { socket } from "../socket";
import type { RoomState } from "../types";
import { getActiveWeather, getFeaturedShop, phaseInfo } from "../weather";
import {
  BASE_GRID_HEIGHT,
  CELL_SIZE,
  MOVE_SPEED,
  PLOT_GRID_WIDTH,
  plotOrigin,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Position,
} from "../world";
import {
  playDragonFruitEmber,
  playMoonBlossomChime,
  playThunderClap,
  startCicadaAmbience,
  startHeatwaveAmbience,
  startRainAmbience,
  startThunderstormAmbience,
  stopCicadaAmbience,
  stopHeatwaveAmbience,
  stopRainAmbience,
  stopThunderstormAmbience,
} from "../sound";
import GardenDecor from "./GardenDecor";
import GearShopView from "./GearShopView";
import InventoryView from "./InventoryView";
import MerchantView from "./MerchantView";
import MoonShopView from "./MoonShopView";
import MutationToasts from "./MutationToasts";
import NPCStall, { NPC_INFO, SOLAR_INFO, type NPCKind } from "./NPCStall";
import PetIcon from "./PetIcon";
import PetShopView from "./PetShopView";
import PlotView from "./PlotView";
import PremiumShopView from "./PremiumShopView";
import QuestGiverView from "./QuestGiverView";
import SeedShopView from "./SeedShopView";
import ShopModal from "./ShopModal";
import SolarShopView from "./SolarShopView";
import WeatherBar from "./WeatherBar";
import { LightningBolts, NightStars, RainParticles, SnowParticles } from "./WeatherParticles";

const AVATAR_OFFSET_X = 13;
const AVATAR_OFFSET_Y = 26;
const MOVE_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);

const PET_BADGE_SCALE: Record<PetSize, number> = { normal: 1, big: 1.2, giant: 1.45 };

/** Shows the player's best equipped pet as a small companion badge next to their avatar, scaled
 *  up a bit for Big/Giant hatches — visible to every player in the room, not just its owner. */
function topPetCompanion(petsEquipped: string[]): { pet: Pet; scale: number } | undefined {
  const [best] = equippedPetsInfo(petsEquipped);
  if (!best) return undefined;
  return { pet: best.pet, scale: PET_BADGE_SCALE[best.size] };
}

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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const avatarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const moveStates = useRef<Map<string, MoveState>>(new Map());
  const [openShop, setOpenShop] = useState<NPCKind | null>(null);
  const [showInventory, setShowInventory] = useState(false);
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
    }
    socket.on("player_spawned", onSpawned);
    socket.on("player_moved", onMoved);
    return () => {
      socket.off("player_spawned", onSpawned);
      socket.off("player_moved", onMoved);
    };
  }, []);

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
      // Arrow keys (and, in some browsers, held letter keys during autoscroll gestures)
      // natively scroll the page, which drifts the pixel↔world-coordinate mapping click-to-move
      // relies on — every click afterward would land somewhere other than where it looked like.
      e.preventDefault();
      pressedKeysRef.current.add(key);
    }
    function onKeyUp(e: KeyboardEvent) {
      pressedKeysRef.current.delete(e.key.toLowerCase());
    }
    function onBlur() {
      pressedKeysRef.current.clear();
    }
    function onVisibilityChange() {
      // A physical keyup can be missed entirely if focus leaves the tab/window mid-press (very
      // common when switching apps) — clearing on both blur and hidden covers more of those cases,
      // so a "held" key never gets stuck fighting every click afterward.
      if (document.hidden) pressedKeysRef.current.clear();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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

  /** Opens a shop instantly — the avatar no longer needs to be near an NPC stall (or exist at
   *  all in a given spot) to interact with shops; clicking a stall or a shop-dock button both
   *  just open the modal directly. */
  function handleNpcClick(kind: NPCKind) {
    setOpenShop(kind);
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
    if (sky.id === "rain") {
      startRainAmbience();
    } else {
      stopRainAmbience();
    }
    if (sky.id === "thunderstorm") {
      startThunderstormAmbience();
    } else {
      stopThunderstormAmbience();
    }
    return () => {
      stopRainAmbience();
      stopThunderstormAmbience();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sky.id]);

  // Discrete thunderclaps layered on top of the storm ambience loop, at randomized intervals
  // so they don't read as a metronome.
  useEffect(() => {
    if (sky.id !== "thunderstorm") return;
    let timeout: number;
    function scheduleNext(delay: number) {
      timeout = window.setTimeout(() => {
        playThunderClap();
        scheduleNext(8000 + Math.random() * 12000);
      }, delay);
    }
    scheduleNext(5000 + Math.random() * 4000);
    return () => window.clearTimeout(timeout);
  }, [sky.id]);

  useEffect(() => {
    if (temperature.id === "heatwave") {
      startHeatwaveAmbience();
    } else {
      stopHeatwaveAmbience();
    }
    return () => stopHeatwaveAmbience();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temperature.id]);

  useEffect(() => {
    if (isDay) {
      stopCicadaAmbience();
    } else {
      startCicadaAmbience();
    }
    return () => stopCicadaAmbience();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDay]);

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
      <MutationToasts player={me} />
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
        <button className="zoom-btn" onClick={() => setShowInventory(true)} title="See your seeds and harvested crops">
          🎒 Inventory
        </button>
      </div>
      <div className="shop-dock">
        {(Object.keys(NPC_INFO) as NPCKind[]).map((kind) => {
          const info = kind === "moon" && featuredShop === "solar" ? SOLAR_INFO : NPC_INFO[kind];
          return (
            <button
              key={kind}
              className="shop-dock-btn"
              style={{ borderColor: info.accent }}
              title={`Open ${info.label}`}
              onClick={() => handleNpcClick(kind)}
            >
              <span>{info.emoji}</span>
              {info.label}
            </button>
          );
        })}
      </div>
      <div className="world-viewport" ref={viewportRef}>
      <div
        className="world-scaler"
        style={{ width: WORLD_WIDTH * zoom, height: WORLD_HEIGHT * zoom }}
      >
      <div
        className="world"
        style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `scale(${zoom})`, transformOrigin: "top left" }}
      >
        <GardenDecor />
        {!isDay && <div className="weather-overlay night-overlay" />}
        {!isDay && <NightStars />}
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
        <NPCStall kind="pets" onClick={() => handleNpcClick("pets")} />

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
                zoom={zoom}
              />
            </div>
          );
        })}

        {room.players.map((p) => {
          const petCompanion = topPetCompanion(p.petsEquipped);
          return (
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
              {petCompanion && (
                <span className="avatar-pet" style={{ scale: String(petCompanion.scale) }} title="Companion pet">
                  <PetIcon pet={petCompanion.pet} size={14} />
                </span>
              )}
              <span className="avatar-name">{p.name}</span>
            </div>
          );
        })}
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
          {openShop === "pets" && <PetShopView player={me} />}
        </ShopModal>
      )}

      {showInventory && me && (
        <ShopModal onClose={() => setShowInventory(false)}>
          <InventoryView player={me} />
        </ShopModal>
      )}
    </div>
  );
}
