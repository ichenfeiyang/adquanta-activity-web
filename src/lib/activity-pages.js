export const ROUTE_NAMES = {
  ACTIVITY_CENTER: "activity-center",
  GOLD_COINS_EXCHANGE: "gold-coins-exchange",
  TOPUP_STATUS: "topup-status",
};

export const PAGE_TITLES = {
  [ROUTE_NAMES.ACTIVITY_CENTER]: "Rewards Center",
  [ROUTE_NAMES.GOLD_COINS_EXCHANGE]: "Redeem Coins",
  [ROUTE_NAMES.TOPUP_STATUS]: "Top-up Status",
};

export function pageTitle(routeName) {
  return PAGE_TITLES[routeName] || "Page";
}
