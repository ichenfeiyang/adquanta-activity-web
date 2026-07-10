import { BaseApiUrl, getChargeStatus } from "./activity-api.js";
import { readEntryToken, resolveAndStripEntryToken } from "./activity-auth.js";
import { bindPageElements } from "./bind-page-elements.js";
import { showToast } from "./activity-alert-ui.js";
import { authFailedMessage } from "./activity-messages.js";
import { t } from "./i18n/activity-locale.js";
import { formatPhoneDisplay } from "./redeem-country.js";
import {
  extractTopupStatusFromApi,
  mergeTopupStatusDetails,
  resolveTopupStatusDetails,
} from "./topup-status-preview.js";

function normalizeStatus(statusRaw = "pending") {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "1") return "success";
  if (s === "2" || s === "-1") return "failed";
  if (s === "0") return "pending";
  if (s === "success") return "success";
  if (s === "failed" || s === "fail" || s === "error" || s === "rejected" || s === "canceled" || s === "cancelled") {
    return "failed";
  }
  return "pending";
}

function statusView(status) {
  if (status === "success") {
    return {
      title: t("topup.successTitle"),
      desc: t("topup.successDesc"),
      icon: "✓",
    };
  }
  if (status === "failed") {
    return {
      title: t("topup.failedTitle"),
      desc: t("topup.failedDesc"),
      icon: "✕",
    };
  }
  return {
    title: t("topup.processingTitle"),
    desc: t("topup.processingDesc"),
    icon: "↻",
  };
}

function renderOperatorValue(el, operatorRaw) {
  if (!el) return;
  const op = String(operatorRaw || "").trim();
  if (!op || op === "-") {
    el.textContent = "-";
    return;
  }

  el.replaceChildren();
  const badge = document.createElement("span");
  badge.className = "ts-operator-badge";
  badge.textContent = op.charAt(0).toUpperCase();
  el.append(badge, document.createTextNode(` ${op}`));
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readQueryParam(routeQuery, key) {
  const fromRoute = routeQuery?.[key];
  if (fromRoute != null && fromRoute !== "") {
    return String(fromRoute);
  }
  return new URLSearchParams(window.location.search).get(key) || "";
}

/**
 * @param {{
 *   route: import('vue-router').RouteLocationNormalizedLoaded,
 *   router?: import('vue-router').Router,
 *   isCancelled?: () => boolean,
 * }} ctx
 */
async function bootstrapTopupStatusPage({ route, router, isCancelled = () => false }) {
  const routeQuery = route?.query || {};
  const businessId = readQueryParam(routeQuery, "business_id");
  const distributorRef = readQueryParam(routeQuery, "distributor_ref") || businessId;
  const transactionId = businessId || distributorRef;
  const readQueryValue = (key) => readQueryParam(routeQuery, key);
  const statusFromQuery = normalizeStatus(readQueryParam(routeQuery, "status") || "pending");
  const token = resolveAndStripEntryToken({ routeQuery, router, route }) || readEntryToken();

  const elements = bindPageElements({
    titleEl: "tsStatusTitle",
    descEl: "tsStatusDesc",
    iconEl: "tsStatusIcon",
    rootEl: { selector: ".ts-root" },
    txEl: "tsTransactionId",
    amountEl: "tsAmount",
    phoneEl: "tsPhone",
    operatorEl: "tsOperator",
    returnBtn: "tsReturnBtn",
    mainEl: { selector: ".ts-main" },
  });

  let details = resolveTopupStatusDetails(distributorRef, readQueryValue, businessId);

  const renderByStatus = (statusRaw) => {
    const normalized = normalizeStatus(statusRaw);
    const ui = statusView(normalized);
    if (elements.rootEl) elements.rootEl.setAttribute("data-status", normalized);
    if (elements.titleEl) elements.titleEl.textContent = ui.title;
    if (elements.descEl) elements.descEl.textContent = ui.desc;
    if (elements.iconEl) elements.iconEl.textContent = ui.icon;
    if (elements.returnBtn) elements.returnBtn.hidden = false;
    return normalized;
  };

  const renderDetails = () => {
    if (elements.txEl) elements.txEl.textContent = transactionId ? `#${transactionId}` : "-";
    if (elements.amountEl) elements.amountEl.textContent = details.amountLabel || "-";
    if (elements.phoneEl) elements.phoneEl.textContent = formatPhoneDisplay(details.phoneNumber);
    renderOperatorValue(elements.operatorEl, details.operator);
  };

  const finish = (statusRaw) => {
    renderByStatus(statusRaw);
  };

  renderByStatus(statusFromQuery);
  renderDetails();

  if (!token) {
    showToast(authFailedMessage(), "error");
    finish(statusFromQuery);
    return;
  }

  if (!distributorRef) {
    finish(statusFromQuery);
    return;
  }

  const apiOptions = { baseUrl: BaseApiUrl, token };

  async function fetchAndApplyStatus() {
    const res = await getChargeStatus(apiOptions, distributorRef);
    if (isCancelled()) return null;
    if (res?.code !== 200 || res?.data?.success !== true) return null;

    const apiDetails = extractTopupStatusFromApi(res.data);
    details = mergeTopupStatusDetails(details, apiDetails);
    renderDetails();
    return apiDetails;
  }

  let apiDetails;
  try {
    apiDetails = await fetchAndApplyStatus();
  } catch (_) {
    finish(statusFromQuery);
    return;
  }

  if (isCancelled()) return;

  let currentStatus = renderByStatus(apiDetails?.status || statusFromQuery);

  while (!isCancelled() && currentStatus === "pending") {
    await sleep(4000);
    if (isCancelled()) break;

    try {
      apiDetails = await fetchAndApplyStatus();
    } catch (_) {
      break;
    }

    if (!apiDetails) break;

    const nextStatus = normalizeStatus(apiDetails.status || "");
    if (nextStatus !== currentStatus) {
      currentStatus = renderByStatus(nextStatus);
    }
  }
}

/**
 * @param {{
 *   route: import('vue-router').RouteLocationNormalizedLoaded,
 *   router?: import('vue-router').Router,
 * }} ctx
 * @returns {() => void} dispose
 */
export function runTopupStatusPage({ route, router }) {
  let cancelled = false;
  const isCancelled = () => cancelled;

  void bootstrapTopupStatusPage({ route, router, isCancelled }).catch(() => {});

  return () => {
    cancelled = true;
  };
}
