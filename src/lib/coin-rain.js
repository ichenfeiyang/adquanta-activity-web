export function normalizeCoinRain(value) {
  if (!value || typeof value !== "object" || value.enabled !== true) return null;
  const displayMaxCoin = Number(value.display_max_coin);
  const baseMaxCoin = Number(value.base_max_coin);
  if (!Number.isSafeInteger(displayMaxCoin) || displayMaxCoin <= 0) return null;
  if (!Number.isSafeInteger(baseMaxCoin) || baseMaxCoin <= 0 || baseMaxCoin > displayMaxCoin) return null;
  return {
    enabled: true,
    state: String(value.state || "available"),
    duration_seconds: Number(value.duration_seconds ?? 30) || 30,
    display_max_coin: displayMaxCoin,
    base_max_coin: baseMaxCoin,
    session_id: String(value.session_id || ""),
    deadline_at: value.deadline_at || null,
    base_coin: Number(value.base_coin ?? 0) || 0,
    boost_coin: Number(value.boost_coin ?? 0) || 0,
    boost_available: value.boost_available === true,
  };
}
