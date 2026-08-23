# Grow a Garden

A browser-based, real-time multiplayer gardening game for up to 6 players. Plant seeds, grow crops, and sell your
harvest — starting with cheap cucumbers and working your way up to dragon fruit.

## How it works

- One player creates a room and gets a 4-letter room code; up to 5 friends join with that code from their own
  browser/device.
- Everyone plays on the same server in real time — coins, plots, and shop purchases sync instantly to everyone in
  the room.
- Each player has their own garden of plots. Buy seeds in the **Seed Shop**, plant them, wait for them to grow,
  **Harvest**, then sell the produce at the **Merchant** for coins.
- The **Gear Shop** sells permanent upgrades: a Watering Can (faster growth), Fertilizer (better sell prices), and
  Extra Garden Plots.
- Crops unlock in order as your coin balance grows: Cucumber → Tomato → Carrot → Corn → Strawberry → Watermelon →
  Pumpkin → Dragon Fruit. Each tier costs more, grows slower, but sells for much more.
- You can click any other player in the sidebar to peek at their garden (read-only).

Progress lives in the server's memory for the lifetime of the process — there's no login/password, just a name and
a room code. Refreshing the page keeps your seat in the room (your browser remembers who you are).

## Project layout

- `server/` — Node.js + TypeScript + Socket.IO backend that owns all game state and rules.
- `client/` — React + TypeScript + Vite frontend.

## Running locally

Install dependencies once:

```bash
npm run install:all
```

Then start both the server (port 4000) and client (port 5173) together:

```bash
npm run dev
```

Open the printed client URL (usually `http://localhost:5173`) in a browser tab per player. On a LAN, other players
can join by visiting `http://<your-computer's-ip>:5173` — set `VITE_SERVER_URL` in `client/.env.local` to
`http://<your-computer's-ip>:4000` so their browsers can reach your server.

## Possible next steps

- Persistent accounts / saved progress across server restarts (currently in-memory only)
- Mutations/weather events, rarer crop variants, trading between players
- Visiting another player's garden to help them water/harvest
- Deploying the server somewhere always-on (Fly.io, Render, etc.) with the client on GitHub Pages/Vercel
