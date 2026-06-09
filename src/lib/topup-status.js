import { BaseApiUrl, getChargeStatus } from "./activity-api.js";
import { readEntryToken, resolveEntryToken, stripTokenFromUrl } from "./activity-auth.js";
import { appUrl } from "./asset-url.js";
import { escapeHtml } from "./escape-html.js";

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  const containsCJK = /[\u4e00-\u9fff]/.test(String(message || ""));
  toast.textContent = containsCJK ? "Something went wrong. Please try again." : String(message ?? "");
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 2000);
}

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

async function main() {
  const qp = new URLSearchParams(window.location.search);
  const businessId = qp.get("business_id") || qp.get("distributor_ref") || "";
  const distributorRef = businessId;
  const status = qp.get("status") || "pending";
  const amountLabel = qp.get("amount_label") || qp.get("send_value") || "-";
  const phoneNumber = qp.get("phone_number") || "";
  const operator = qp.get("operator") || "-";
  const activityId = qp.get("activity_id") || "";

  const token = resolveEntryToken() || readEntryToken();
  stripTokenFromUrl();

  const titleEl = document.getElementById("tsStatusTitle");
  const descEl = document.getElementById("tsStatusDesc");
  const iconEl = document.getElementById("tsStatusIcon");
  const rootEl = document.querySelector(".ts-root");
  const txEl = document.getElementById("tsTransactionId");
  const amountEl = document.getElementById("tsAmount");
  const phoneEl = document.getElementById("tsPhone");
  const operatorEl = document.getElementById("tsOperator");
  const backBtn = document.getElementById("tsBackBtn");
  const returnBtn = document.getElementById("tsReturnBtn");

  const renderPendingState = () => {
    const ui = statusView("pending");
    if (rootEl) rootEl.setAttribute("data-status", "pending");
    if (titleEl) titleEl.textContent = ui.title;
    if (descEl) descEl.textContent = ui.desc;
    if (iconEl) iconEl.textContent = ui.icon;
    if (returnBtn) returnBtn.hidden = false;
  };

  const renderSuccessState = () => {
    const ui = statusView("success");
    if (rootEl) rootEl.setAttribute("data-status", "success");
    if (titleEl) titleEl.textContent = ui.title;
    if (descEl) descEl.textContent = ui.desc;
    if (iconEl) iconEl.textContent = ui.icon;
    if (returnBtn) returnBtn.hidden = false;
  };

  const renderFailedState = () => {
    const ui = statusView("failed");
    if (rootEl) rootEl.setAttribute("data-status", "failed");
    if (titleEl) titleEl.textContent = ui.title;
    if (descEl) descEl.textContent = ui.desc;
    if (iconEl) iconEl.textContent = ui.icon;
    if (returnBtn) returnBtn.hidden = false;
  };

  const renderByStatus = (s) => {
    const normalized = normalizeStatus(s);
    if (normalized === "success") {
      renderSuccessState();
      return;
    }
    if (normalized === "failed") {
      renderFailedState();
      return;
    }
    renderPendingState();
  };

  const mainEl = document.querySelector(".ts-main");
  const statusFromQuery = normalizeStatus(status);
  if (mainEl) {
    mainEl.style.transition = "opacity 200ms ease";
    mainEl.style.opacity = "0";
    mainEl.style.pointerEvents = "none";
  }
  if (txEl) txEl.textContent = distributorRef ? `#${distributorRef}` : "-";
  if (amountEl) amountEl.textContent = amountLabel;
  if (phoneEl) phoneEl.textContent = normalizePhone(phoneNumber);
  renderOperatorValue(operatorEl, operator);

  const goBack = () => {
    const p = new URLSearchParams();
    if (activityId) p.set("activity_id", activityId);
    window.location.href = appUrl("activity-center", p.toString());
  };

  const backToPrevPage = () => {
    try {
      if (window.history && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch (_) {}
    goBack();
  };

  if (backBtn) backBtn.addEventListener("click", backToPrevPage);
  if (returnBtn) returnBtn.addEventListener("click", goBack);

  const showMain = () => {
    if (!mainEl) return;
    mainEl.style.opacity = "1";
    mainEl.style.pointerEvents = "auto";
  };

  if (!token) {
    showToast("Authorization is missing. Please reopen from the app.");
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

  const apiOptions = { token };

  let res;
  try {
    res = await getChargeStatus(apiOptions, distributorRef);
  } catch (_) {
    renderByStatus(statusFromQuery);
    showMain();
    return;
  }

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
  while (currentStatus === "pending") {
    await sleep(4000);
    try {
      res = await getChargeStatus(apiOptions, distributorRef);
    } catch (_) {
      break;
    }

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

export async function bootstrapTopupStatus() {
  await main().catch(() => {});
}
