import { t } from "./i18n/activity-locale.js";

export const ROUTE_NAMES = {
  ACTIVITY_CENTER: "activity-center",
  GOLD_COINS_EXCHANGE: "gold-coins-exchange",
  TOPUP_STATUS: "topup-status",
  FEEDBACK: "feedback",
  FEEDBACK_SUCCESS: "feedback-success",
};

export const PAGE_TITLE_KEYS = {
  [ROUTE_NAMES.ACTIVITY_CENTER]: "pages.activityCenter",
  [ROUTE_NAMES.GOLD_COINS_EXCHANGE]: "pages.goldCoinsExchange",
  [ROUTE_NAMES.TOPUP_STATUS]: "pages.topupStatus",
  [ROUTE_NAMES.FEEDBACK]: "pages.feedback",
  [ROUTE_NAMES.FEEDBACK_SUCCESS]: "pages.feedbackSubmitted",
};

export function pageTitle(routeName) {
  return t(PAGE_TITLE_KEYS[routeName] || "pages.default");
}
