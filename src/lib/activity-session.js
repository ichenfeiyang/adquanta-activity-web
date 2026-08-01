import { BaseApiUrl } from "./activity-api.js";
import { resolveAndStripEntryToken } from "./activity-auth.js";
import { resolveActivityRouteContext } from "./activity-context.js";
import { showToast } from "./activity-alert-ui.js";
import { authFailedMessage } from "./activity-messages.js";
import { DEFAULT_REDEEM_COUNTRY, resolveRedeemCountry } from "./redeem-country.js";

function resolveCountryCode(routeQuery = {}) {
  const raw =
    routeQuery.country_code ||
    routeQuery.countryCode ||
    routeQuery.country ||
    routeQuery.region ||
    DEFAULT_REDEEM_COUNTRY.iso;
  return resolveRedeemCountry(raw).iso;
}

/**
 * Resolve route context and bearer token for an activity page.
 * Shows auth toast and returns null when token is missing.
 *
 * @param {import('vue-router').RouteLocationNormalizedLoaded} route
 * @param {{ defaultActivityId?: string, router?: import('vue-router').Router }} [options]
 */
export function requireActivitySession(route, options = {}) {
  const { code, activityId, routeQuery } = resolveActivityRouteContext(route, options);
  const token = resolveAndStripEntryToken({ routeQuery, router: options.router, route });

  if (!token) {
    showToast(authFailedMessage(), "error");
    return null;
  }

  return {
    code,
    activityId,
    routeQuery,
    token,
    apiOptions: {
      baseUrl: BaseApiUrl,
      token,
      activityId,
      code,
      countryCode: resolveCountryCode(routeQuery),
    },
  };
}
