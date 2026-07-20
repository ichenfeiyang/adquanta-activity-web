const ALLOWED_REWARD_TYPES = new Set(["topup", "data", "gift_card", "mobile"]);

export function normalizeRecentRedemptions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const maskedUserId = String(item.masked_user_id || "").trim();
    const rewardName = String(item.reward_name || "").trim();
    if (!maskedUserId || !rewardName) return [];
    const rawType = String(item.reward_type || "mobile").trim().toLowerCase();
    return [{
      maskedUserId,
      rewardType: ALLOWED_REWARD_TYPES.has(rawType) ? rawType : "mobile",
      rewardName,
      rewardIconUrl: String(item.reward_icon_url || "").trim(),
      redeemedDate: String(item.redeemed_date || "").trim(),
    }];
  });
}

export function chunkRecentRedemptions(items, batchSize = 3) {
  const size = Math.max(1, Number(batchSize) || 3);
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

export function nextRecentRedemptionBatchIndex(currentIndex, batchCount) {
  const count = Math.max(0, Number(batchCount) || 0);
  if (count <= 1) return 0;
  return (Math.max(0, Number(currentIndex) || 0) + 1) % count;
}
