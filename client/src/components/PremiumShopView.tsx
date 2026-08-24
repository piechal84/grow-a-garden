import { useState } from "react";
import type { PlayerState } from "../types";
import { socket } from "../socket";

const BUY_RATE = 1_000_000; // coins per diamond
const SELL_RATE = 800_000; // coins per diamond — a deliberate loss vs. buying, to discourage arbitrage

export default function PremiumShopView({ player }: { player: PlayerState }) {
  const [buyQty, setBuyQty] = useState(1);
  const [sellQty, setSellQty] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const buyCost = buyQty * BUY_RATE;
  const sellReturn = sellQty * SELL_RATE;
  const canBuy = buyQty >= 1 && player.coins >= buyCost;
  const canSell = sellQty >= 1 && player.diamonds >= sellQty;

  function handleBuy() {
    setError(null);
    socket.emit("buy_diamonds", { quantity: buyQty }, (res) => {
      if (!res.ok) setError(res.error ?? "Could not buy diamonds.");
    });
  }

  function handleSell() {
    setError(null);
    socket.emit("sell_diamonds", { quantity: sellQty }, (res) => {
      if (!res.ok) setError(res.error ?? "Could not exchange diamonds.");
    });
  }

  return (
    <div className="shop-view">
      <h2>💎 Premium Shop</h2>
      <p className="shop-sub">
        Diamonds fund future events — starting with the Solar Seed Pack. You can always exchange back to coins,
        at a worse rate than buying.
      </p>
      <div className="diamond-balance">
        💎 You have <strong>{player.diamonds}</strong> Diamond{player.diamonds === 1 ? "" : "s"}
      </div>
      {error && <p className="lobby-error">{error}</p>}

      <div className="premium-panel">
        <h3 className="moon-section-title">Buy Diamonds</h3>
        <p className="premium-rate">🪙 {BUY_RATE.toLocaleString()} coins = 💎 1 Diamond</p>
        <div className="premium-row">
          <input
            type="number"
            className="qty-input"
            min={1}
            max={999}
            value={buyQty}
            onChange={(e) => setBuyQty(Math.min(999, Math.max(1, Number(e.target.value))))}
          />
          <button className="btn btn-primary" disabled={!canBuy} onClick={handleBuy}>
            Buy {buyQty} 💎 for {buyCost.toLocaleString()}
          </button>
        </div>
      </div>

      <div className="premium-panel">
        <h3 className="moon-section-title">Exchange Diamonds for Coins</h3>
        <p className="premium-rate">💎 1 Diamond = 🪙 {SELL_RATE.toLocaleString()} coins</p>
        <div className="premium-row">
          <input
            type="number"
            className="qty-input"
            min={1}
            max={Math.max(1, player.diamonds)}
            value={sellQty}
            onChange={(e) => setSellQty(Math.min(999, Math.max(1, Number(e.target.value))))}
          />
          <button className="btn btn-secondary" disabled={!canSell} onClick={handleSell}>
            Exchange {sellQty} 💎 for {sellReturn.toLocaleString()}
          </button>
        </div>
      </div>
    </div>
  );
}
