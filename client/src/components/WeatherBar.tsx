import { getActiveWeather, msUntilWeatherChange, phaseInfo } from "../weather";

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WeatherBar({ roomCreatedAt, now }: { roomCreatedAt: number; now: number }) {
  const { isDay, msRemaining } = phaseInfo(roomCreatedAt, now);
  const { temperature, sky } = getActiveWeather(roomCreatedAt, now);
  const active = [temperature, sky].filter((c) => c.id !== "clear");
  const weatherMsRemaining = msUntilWeatherChange(roomCreatedAt, now);

  return (
    <div className={`weather-bar ${isDay ? "weather-bar-day" : "weather-bar-night"}`}>
      <span className="weather-phase">
        {isDay ? "☀️ Day" : "🌙 Night"} · {formatClock(msRemaining)}
      </span>
      {active.length > 0 ? (
        active.map((c) => (
          <span key={c.id} className="weather-condition">
            {c.emoji} {c.label}
          </span>
        ))
      ) : (
        <span className="weather-condition weather-condition-clear">🌤️ Clear skies</span>
      )}
      <span className="weather-condition weather-condition-timer" title="Time until temperature and sky reroll">
        🔄 {formatClock(weatherMsRemaining)}
      </span>
      {!isDay && <span className="weather-hint">Mutation odds x2 tonight</span>}
    </div>
  );
}
