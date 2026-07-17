export function normalizeCheckinChests(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      id: Number(item?.id ?? 0),
      continuous_day: Number(item?.continuous_day ?? 0),
      status: String(item?.status || ""),
      trigger: String(item?.trigger || ""),
      guaranteed: item?.guaranteed === true,
    }))
    .filter((item) => item.id > 0 && item.status === "pending");
}
