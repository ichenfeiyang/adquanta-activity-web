import { t } from "./i18n/activity-locale.js";

export const LUCKY_SPIN_PROMO_MAX_COIN = 200;

export function maxRouletteCoin(coinList) {
  const values = (Array.isArray(coinList) ? coinList : []).map(Number).filter(Number.isFinite);
  return values.length ? Math.max(...values) : 0;
}

export function formatLuckySpinDesc(maxCoin) {
  if (maxCoin > 0) {
    return t("center.luckySpinDesc", { maxCoin });
  }
  return t("center.luckySpinDescShort");
}

export function resolveCompletedVideoCount(completed, dailyLimit, remainCount) {
  const limit = Math.max(0, Number(dailyLimit) || 0);
  const remain = Number(remainCount);
  if (limit > 0 && remainCount != null && Number.isFinite(remain)) {
    return Math.max(0, Math.min(limit, limit - remain));
  }
  const watched = Math.max(0, Number(completed) || 0);
  return limit > 0 ? Math.min(limit, watched) : watched;
}

export function resolveSigninRewardCoins(reward) {
  const baseCoin = Number(reward?.coinFromCheckin ?? reward?.coin ?? 0) || 0;
  const doubledCoin = Number(reward?.video_coin ?? 0);
  const totalCoin = doubledCoin > 0 ? doubledCoin : baseCoin * 2;
  return { baseCoin, totalCoin };
}

/**
 * Defers a modal illustration request until the modal is actually opened.
 * Public image URLs are stored in data-src by the Vue shell to keep them out
 * of the activity centre's cold-start resource queue.
 */
export function loadDeferredImage(image) {
  const source = String(image?.dataset?.src || "");
  if (!source || image?.getAttribute?.("src") === source) return;
  image.src = source;
}
