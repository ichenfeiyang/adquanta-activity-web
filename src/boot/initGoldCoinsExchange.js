import { GoldCoinsExchange } from "../lib/gold-coins-exchange.js";
import { BaseApiUrl } from "../lib/activity-api.js";
import {
  readSameOriginReferrerSearchParams,
  resolveEntryToken,
  stripTokenFromUrl,
} from "../lib/activity-auth.js";
import * as logger from "../lib/activity-logger.js";

/**
 * @param {{ router: import('vue-router').Router, route: import('vue-router').RouteLocationNormalizedLoaded }} ctx
 */
export function initGoldCoinsExchange({ router, route }) {
  const qp = new URLSearchParams(window.location.search);
  const refQp = readSameOriginReferrerSearchParams();
  const rq = route?.query || {};
  const code = qp.get("code") || refQp.get("code") || String(rq.code || "");
  const activityId = String(rq.activity_id || qp.get("activity_id") || refQp.get("activity_id") || "");

  function showAuthFailedDialog() {
    const modal = document.getElementById("authFailedModal");
    if (modal) modal.style.display = "flex";
    const ok = document.getElementById("authFailedOk");
    if (ok) {
      ok.addEventListener(
        "click",
        () => {
          if (modal) modal.style.display = "none";
        },
        { once: true },
      );
    }
  }

  const token = resolveEntryToken({ routeQuery: rq });
  stripTokenFromUrl();

  if (!token) {
    showAuthFailedDialog();
    logger.error("GoldCoinsExchange: missing token");
    return;
  }

  const apiOptions = {
    baseUrl: BaseApiUrl,
    token,
    activityId,
    code,
  };

  function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;
    const containsCJK = /[\u4e00-\u9fff]/.test(String(message || ""));
    const fallbackByType = {
      success: "Done.",
      error: "Something went wrong. Please try again.",
      warning: "Please try again.",
      info: "Please wait...",
    };
    toast.textContent = containsCJK ? fallbackByType[type] || "Please try again." : String(message ?? "");
    toast.className = `toast ${type}`;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 2000);
  }

  const exchange = new GoldCoinsExchange({
    apiOptions,
    onExchangeSuccess: (product) => {
      showToast(`Redeemed ${product.name} successfully!`, "success");
    },
    onExchangeFailed: (message) => {
      showToast(message, "error");
    },
  });

  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      router.push({
        name: "activity-center",
        query: activityId ? { activity_id: activityId } : {},
      });
    });
  }

  exchange.init();
}
