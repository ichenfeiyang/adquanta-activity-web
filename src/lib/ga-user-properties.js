let lastReportedGoldCoins = null;

function getGtag() {
  return typeof globalThis.gtag === "function" ? globalThis.gtag : null;
}

export function syncGoldCoinsUserProperty(coin) {
  if (typeof coin !== "number" || !Number.isFinite(coin)) return;
  if (coin === lastReportedGoldCoins) return;
  lastReportedGoldCoins = coin;

  const gtag = getGtag();
  if (!gtag) return;

  gtag("set", "user_properties", { gold_coins: coin });
}

export function syncGoldCoinsFromActivityInfo(data) {
  syncGoldCoinsUserProperty(data?.wallet_info?.coin);
}

export function __resetGoldCoinsUserPropertyForTests() {
  lastReportedGoldCoins = null;
}
