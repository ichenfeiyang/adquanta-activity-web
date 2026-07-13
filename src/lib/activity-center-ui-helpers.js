import { t } from "./i18n/activity-locale.js";

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

export function resolveSigninRewardCoins(reward) {
  const baseCoin = Number(reward?.coinFromCheckin ?? reward?.coin ?? 0) || 0;
  const doubledCoin = Number(reward?.video_coin ?? 0);
  const totalCoin = doubledCoin > 0 ? doubledCoin : baseCoin * 2;
  return { baseCoin, totalCoin };
}
