import { ROUTE_NAMES } from "./activity-pages.js";
import { saveTopupStatusPreview } from "./topup-status-preview.js";

function compactQuery(query) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value != null && value !== ""),
  );
}

function resolveTopupRefs(payload = {}) {
  const businessId =
    payload.business_id ||
    payload.businessId ||
    payload.distributor_ref ||
    payload.distributorRef ||
    "";
  return {
    businessId,
    distributorRef: payload.distributor_ref || payload.distributorRef || businessId,
  };
}

export function activityCenterQuery(activityId) {
  return compactQuery(activityId ? { activity_id: activityId } : {});
}

export function goToActivityCenter(router, activityId) {
  return router.push({
    name: ROUTE_NAMES.ACTIVITY_CENTER,
    query: activityCenterQuery(activityId),
  });
}

export function goToGoldCoinsExchange(router, activityId) {
  return router.push({
    name: ROUTE_NAMES.GOLD_COINS_EXCHANGE,
    query: activityCenterQuery(activityId),
  });
}

export function goToTopupStatus(router, payload = {}) {
  const { businessId, distributorRef } = resolveTopupRefs(payload);

  saveTopupStatusPreview(distributorRef, payload);

  return router.push({
    name: ROUTE_NAMES.TOPUP_STATUS,
    query: compactQuery({
      business_id: businessId,
      distributor_ref: distributorRef,
      status: payload.status || "pending",
      activity_id: payload.activity_id || payload.activityId || "",
    }),
  });
}
