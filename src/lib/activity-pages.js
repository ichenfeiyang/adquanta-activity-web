import { t } from "./i18n/activity-locale.js";

export const ROUTE_NAMES = {
  ACTIVITY_CENTER: "activity-center",
  GOLD_COINS_EXCHANGE: "gold-coins-exchange",
  TOPUP_STATUS: "topup-status",
};

export const PAGE_TITLE_KEYS = {
  [ROUTE_NAMES.ACTIVITY_CENTER]: "pages.activityCenter",
  [ROUTE_NAMES.GOLD_COINS_EXCHANGE]: "pages.goldCoinsExchange",
  [ROUTE_NAMES.TOPUP_STATUS]: "pages.topupStatus",
};

export function pageTitle(routeName) {
  return t(PAGE_TITLE_KEYS[routeName] || "pages.default");
}
