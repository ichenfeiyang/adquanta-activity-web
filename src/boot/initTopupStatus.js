import { runTopupStatusPage } from "../lib/topup-status-page.js";

/**
 * @param {{
 *   route: import('vue-router').RouteLocationNormalizedLoaded,
 *   router?: import('vue-router').Router,
 * }} ctx
 * @returns {() => void} dispose
 */
export function initTopupStatus({ route, router }) {
  return runTopupStatusPage({ route, router });
}
