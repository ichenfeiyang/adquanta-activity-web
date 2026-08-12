export function normalizeCheckinChestId(value) {
  const id = String(value ?? "").trim();
  return id && id !== "0" ? id : "";
}

export function normalizeCheckinChests(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      id: normalizeCheckinChestId(item?.id),
      continuous_day: Number(item?.continuous_day ?? 0),
      status: String(item?.status || ""),
      trigger: String(item?.trigger || ""),
      guaranteed: item?.guaranteed === true,
    }))
    .filter((item) => item.id && item.status === "pending");
}

export function normalizeCheckinChestEligibleDays(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number))]
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    .sort((a, b) => a - b);
}

const SOFT_CLOSED_CHEST_KEY = "activity_checkin_chest_soft_closed_v1";

function todayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Soft-closed chest ids for today (sessionStorage so refresh keeps the popup closed). */
export function readSoftClosedCheckinChestIds(now = new Date()) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SOFT_CLOSED_CHEST_KEY) || "null");
    if (!parsed || parsed.date !== todayKey(now) || !Array.isArray(parsed.ids)) return new Set();
    return new Set(parsed.ids.map(normalizeCheckinChestId).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function writeSoftClosedCheckinChestIds(ids, now = new Date()) {
  try {
    const unique = [...new Set([...ids].map(normalizeCheckinChestId).filter(Boolean))];
    sessionStorage.setItem(SOFT_CLOSED_CHEST_KEY, JSON.stringify({ date: todayKey(now), ids: unique }));
  } catch {
    /* unavailable storage */
  }
}

export function markCheckinChestSoftClosed(chestId, now = new Date()) {
  const id = normalizeCheckinChestId(chestId);
  if (!id) return;
  const ids = readSoftClosedCheckinChestIds(now);
  ids.add(id);
  writeSoftClosedCheckinChestIds(ids, now);
}

export function clearCheckinChestSoftClosed(chestId, now = new Date()) {
  const id = normalizeCheckinChestId(chestId);
  if (!id) return;
  const ids = readSoftClosedCheckinChestIds(now);
  if (!ids.delete(id)) return;
  writeSoftClosedCheckinChestIds(ids, now);
}
