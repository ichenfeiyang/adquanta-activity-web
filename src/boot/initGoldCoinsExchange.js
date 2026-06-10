import { GoldCoinsExchange } from "../lib/gold-coins-exchange.js";
import { requireActivitySession } from "../lib/activity-session.js";
import { showToast } from "../lib/activity-alert-ui.js";
import * as logger from "../lib/activity-logger.js";

/**
 * @param {{ router: import('vue-router').Router, route: import('vue-router').RouteLocationNormalizedLoaded }} ctx
 */
export function initGoldCoinsExchange({ router, route }) {
  const session = requireActivitySession(route, { router });
  if (!session) {
    logger.error("GoldCoinsExchange: missing token");
    return;
  }

  const { apiOptions } = session;

  const exchange = new GoldCoinsExchange({
    router,
    apiOptions,
    onExchangeFailed: (message) => {
      showToast(message, "error");
    },
  });

  void exchange.init();

  return () => {
    exchange.destroy();
  };
}
