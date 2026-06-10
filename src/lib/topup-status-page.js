import { BaseApiUrl, getChargeStatus } from "./activity-api.js";
import { readEntryToken, resolveAndStripEntryToken } from "./activity-auth.js";
import { bindPageElements } from "./bind-page-elements.js";
import { escapeHtml } from "./escape-html.js";
import { showToast } from "./activity-alert-ui.js";
import { AUTH_FAILED_MESSAGE } from "./activity-messages.js";

function normalizePhone(phoneRaw = "") {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  if (!digits) return "-";
  if (digits.startsWith("91") && digits.length > 10) {
    return `+91 ${digits.slice(2)}`;
  }
  return `+${digits}`;
}

function normalizeStatus(statusRaw = "pending") {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "1") return "success";
  if (s === "2" || s === "-1") return "failed";
  if (s === "0") return "pending";
  if (s === "success") return "success";
  if (s === "failed" || s === "fail" || s === "error" || s === "rejected" || s === "canceled" || s === "cancelled") {
    return "failed";
  }
  if (s === "pending") return "pending";
  return "pending";
}

function statusView(status) {
  if (status === "success") {
    return {
      title: "Recharge Successful!",
      desc: "Your request has been processed.",
      icon: "✓",
    };
  }
  if (status === "failed") {
    return {
      title: "Recharge Failed",
      desc: "The recharge did not complete. Please try again later.",
      icon: "✕",
    };
  }
  return {
    title: "Processing Recharge",
    desc: "We are processing your top-up. This may take a few minutes.",
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
  const initial = escapeHtml(op.charAt(0).toUpperCase());
  el.innerHTML = `<span class="ts-operator-badge">${initial}</span> ${escapeHtml(op)}`;
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
  const businessId = readQueryParam(routeQuery, "business_id") || readQueryParam(routeQuery, "distributor_ref");
  const distributorRef = businessId;
  const status = readQueryParam(routeQuery, "status") || "pending";
  const amountLabel = readQueryParam(routeQuery, "amount_label") || readQueryParam(routeQuery, "send_value") || "-";
  const phoneNumber = readQueryParam(routeQuery, "phone_number");
  const operator = readQueryParam(routeQuery, "operator") || "-";

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

  const renderByStatus = (statusRaw) => {
    const normalized = normalizeStatus(statusRaw);
    const ui = statusView(normalized);
    if (elements.rootEl) elements.rootEl.setAttribute("data-status", normalized);
    if (elements.titleEl) elements.titleEl.textContent = ui.title;
    if (elements.descEl) elements.descEl.textContent = ui.desc;
    if (elements.iconEl) elements.iconEl.textContent = ui.icon;
    if (elements.returnBtn) elements.returnBtn.hidden = false;
  };

  const statusFromQuery = normalizeStatus(status);
  if (elements.mainEl) {
    elements.mainEl.style.transition = "opacity 200ms ease";
    elements.mainEl.style.opacity = "0";
    elements.mainEl.style.pointerEvents = "none";
  }
  if (elements.txEl) elements.txEl.textContent = distributorRef ? `#${distributorRef}` : "-";
  if (elements.amountEl) elements.amountEl.textContent = amountLabel;
  if (elements.phoneEl) elements.phoneEl.textContent = normalizePhone(phoneNumber);
  renderOperatorValue(elements.operatorEl, operator);

  const showMain = () => {
    if (!elements.mainEl) return;
    elements.mainEl.style.opacity = "1";
    elements.mainEl.style.pointerEvents = "auto";
  };

  if (!token) {
    showToast(AUTH_FAILED_MESSAGE, "error");
    renderByStatus(statusFromQuery);
    showMain();
    return;
  }

  if (statusFromQuery === "success" || statusFromQuery === "failed") {
    renderByStatus(statusFromQuery);
    showMain();
    return;
  }

  if (!distributorRef) {
    renderByStatus(statusFromQuery);
    showMain();
    return;
  }

  const apiOptions = { baseUrl: BaseApiUrl, token };

  let res;
  try {
    res = await getChargeStatus(apiOptions, distributorRef);
  } catch (_) {
    renderByStatus(statusFromQuery);
    showMain();
    return;
  }

  if (isCancelled()) return;

  if (res?.code !== 200 || res?.data?.success !== true) {
    renderByStatus(statusFromQuery);
    showMain();
    return;
  }

  let currentStatus = normalizeStatus(res?.data?.status || "");
  renderByStatus(currentStatus);
  showMain();

  if (currentStatus === "success" || currentStatus === "failed") {
    return;
  }

  let lastRenderedStatus = currentStatus;
  while (!isCancelled() && currentStatus === "pending") {
    await sleep(4000);
    if (isCancelled()) break;

    try {
      res = await getChargeStatus(apiOptions, distributorRef);
    } catch (_) {
      break;
    }

    if (isCancelled()) break;

    if (res?.code !== 200 || res?.data?.success !== true) {
      break;
    }

    const nextStatus = normalizeStatus(res?.data?.status || "");
    if (nextStatus !== lastRenderedStatus) {
      renderByStatus(nextStatus);
      lastRenderedStatus = nextStatus;
    }

    currentStatus = nextStatus;
    if (currentStatus === "success" || currentStatus === "failed") {
      break;
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
