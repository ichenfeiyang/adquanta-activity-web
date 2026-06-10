import { BaseApiUrl } from "./activity-api.js";
import { resolveAndStripEntryToken } from "./activity-auth.js";
import { resolveActivityRouteContext } from "./activity-context.js";
import { showToast } from "./activity-alert-ui.js";
import { AUTH_FAILED_MESSAGE } from "./activity-messages.js";

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
    showToast(AUTH_FAILED_MESSAGE, "error");
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
    },
  };
}
