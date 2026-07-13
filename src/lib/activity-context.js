import { readSameOriginReferrerSearchParams } from "./activity-auth.js";

/**
 * @param {import('vue-router').RouteLocationNormalizedLoaded} route
 * @param {{ defaultActivityId?: string }} [options]
 */
export function resolveActivityRouteContext(route, options = {}) {
  const qp = new URLSearchParams(window.location.search);
  const refQp = readSameOriginReferrerSearchParams();
  const routeQuery = route?.query || {};
  const code = qp.get("code") || refQp.get("code") || String(routeQuery.code || "");
  const defaultActivityId = options.defaultActivityId ?? "";
  const activityId = String(
    routeQuery.activity_id || qp.get("activity_id") || refQp.get("activity_id") || defaultActivityId,
  );
  return { code, activityId, routeQuery };
}
