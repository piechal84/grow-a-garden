import { useState } from "react";
import {
  DAILY_FULL_REFRESH_COSTS,
  DAILY_REROLL_BASE_COST,
  DAILY_REROLL_STEP,
  questEmoji,
  rerollCost,
  WEEKLY_REROLL_BASE_COST,
  WEEKLY_REROLL_STEP,
  type Quest,
} from "../quests";
import type { PlayerState } from "../types";
import { socket } from "../socket";

function formatFullRefreshCost(cost: { coins: number; diamonds: number }): string {
  return cost.diamonds > 0 ? `💎${cost.diamonds}` : `🪙${cost.coins.toLocaleString()}`;
}

function QuestRow({
  quest,
  rerollTargetCost,
  affordable,
  onReroll,
  isDaily,
}: {
  quest: Quest;
  rerollTargetCost: number;
  affordable: boolean;
  onReroll: () => void;
  /** Only daily quests grant a Gear on completion — see grantQuestReward in server/src/rooms.ts. */
  isDaily: boolean;
}) {
  const pct = Math.min(100, (quest.progress / quest.target) * 100);
  return (
    <div className={`quest-row ${quest.completed ? "quest-row-done" : ""}`}>
      <div className="quest-row-top">
        <span className="quest-label">
          {questEmoji(quest.type)} {quest.label}
        </span>
        {!quest.completed && (
          <button className="btn btn-secondary quest-reroll-btn" disabled={!affordable} onClick={onReroll}>
            🔄 {rerollTargetCost}
          </button>
        )}
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="quest-row-bottom">
        <span>
          {quest.progress}/{quest.target}
        </span>
        <span className="quest-reward">
          {quest.completed
            ? "✓ Claimed"
            : `🪙 ${quest.coinReward}${quest.moonPacks > 0 ? ` + 🎁x${quest.moonPacks}` : ""}${isDaily ? " + 💠1" : ""}`}
        </span>
      </div>
    </div>
  );
}

export default function QuestGiverView({ player }: { player: PlayerState }) {
  const [error, setError] = useState<string | null>(null);

  function handleReroll(questSet: "daily" | "weekly", questId: string) {
    setError(null);
    socket.emit("reroll_quest", { questSet, questId }, (res) => {
      if (!res.ok) setError(res.error ?? "Could not reroll quest.");
    });
  }

  function handleRefreshAll() {
    setError(null);
    socket.emit("refresh_daily_quests", (res) => {
      if (!res.ok) setError(res.error ?? "Could not refresh quests.");
    });
  }

  const refreshesUsed = player.dailyFullRefreshCount;
  const refreshMaxed = refreshesUsed >= DAILY_FULL_REFRESH_COSTS.length;
  const nextRefreshCost = refreshMaxed ? undefined : DAILY_FULL_REFRESH_COSTS[refreshesUsed];
  const canAffordRefresh = !!nextRefreshCost && player.coins >= nextRefreshCost.coins && player.diamonds >= nextRefreshCost.diamonds;

  return (
    <div className="shop-view">
      <h2>📜 Quest Giver</h2>
      <p className="shop-sub">
        Complete quests for automatic rewards. Don't like one? Reroll it with coins.
      </p>
      {error && <p className="lobby-error">{error}</p>}

      <h3 className="moon-section-title">Daily Quests</h3>
      <div className="restock-banner">
        <span>
          🔄 Refresh all 3 at once: <strong>{refreshesUsed}/{DAILY_FULL_REFRESH_COSTS.length}</strong> used today
        </span>
        <button
          className="btn btn-secondary"
          disabled={refreshMaxed || !canAffordRefresh}
          onClick={handleRefreshAll}
          title={refreshMaxed ? "You've used all 3 refreshes today" : "Replace all 3 daily quests with a fresh set"}
        >
          🔄 Refresh All {refreshMaxed ? "(maxed today)" : `(${formatFullRefreshCost(nextRefreshCost!)})`}
        </button>
      </div>
      <div className="shop-list">
        {player.dailyQuests.map((q) => (
          <QuestRow
            key={q.id}
            quest={q}
            rerollTargetCost={rerollCost(DAILY_REROLL_BASE_COST, DAILY_REROLL_STEP, player.dailyRerollCount)}
            affordable={player.coins >= rerollCost(DAILY_REROLL_BASE_COST, DAILY_REROLL_STEP, player.dailyRerollCount)}
            onReroll={() => handleReroll("daily", q.id)}
            isDaily
          />
        ))}
      </div>

      <h3 className="moon-section-title">Weekly Quests</h3>
      <div className="shop-list">
        {player.weeklyQuests.map((q) => (
          <QuestRow
            key={q.id}
            quest={q}
            rerollTargetCost={rerollCost(WEEKLY_REROLL_BASE_COST, WEEKLY_REROLL_STEP, player.weeklyRerollCount)}
            affordable={
              player.coins >= rerollCost(WEEKLY_REROLL_BASE_COST, WEEKLY_REROLL_STEP, player.weeklyRerollCount)
            }
            onReroll={() => handleReroll("weekly", q.id)}
            isDaily={false}
          />
        ))}
      </div>
    </div>
  );
}
