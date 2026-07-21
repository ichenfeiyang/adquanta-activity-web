export function normalizeCoinRain(value) {
  if (!value || typeof value !== "object" || value.enabled !== true) return null;
  return {
    enabled: true,
    state: String(value.state || "available"),
    duration_seconds: Number(value.duration_seconds ?? 30) || 30,
    display_max_coin: Number(value.display_max_coin ?? 400) || 400,
    session_id: String(value.session_id || ""),
    deadline_at: value.deadline_at || null,
    base_coin: Number(value.base_coin ?? 0) || 0,
    boost_coin: Number(value.boost_coin ?? 0) || 0,
    boost_available: value.boost_available === true,
  };
}
