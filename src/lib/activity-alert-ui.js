import { resolveAlertTitleByMessage } from "./activity-messages.js";
import { t } from "./i18n/activity-locale.js";

export const DEFAULT_ALERT_DURATION_MS = 3000;

const DEFAULT_TITLES = {
  success: () => t("alert.success"),
  error: () => t("alert.error"),
  warning: () => t("alert.warning"),
  info: () => t("alert.info"),
};

const FALLBACK_BY_TYPE = {
  success: () => t("alert.fallbackSuccess"),
  error: () => t("alert.fallbackError"),
  warning: () => t("alert.fallbackWarning"),
  info: () => t("alert.fallbackInfo"),
};

const CJK_PATTERN = /[\u4e00-\u9fff]/;
const DEDUPE_MS = 300;

let hideTimer = null;
let controlsBound = false;
let lastToastKey = "";
let lastToastAt = 0;

function getAlertElements() {
  return {
    modal: document.getElementById("activityAlertModal"),
    title: document.getElementById("activityAlertTitle"),
    message: document.getElementById("activityAlertMessage"),
    closeBtn: document.getElementById("activityAlertCloseBtn"),
  };
}

export function hideActivityAlert() {
  const { modal } = getAlertElements();
  if (modal) modal.style.display = "none";
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function scheduleHide(duration) {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(hideActivityAlert, duration);
}

function bindAlertControls() {
  if (controlsBound) return;

  const { modal, closeBtn } = getAlertElements();
  if (!modal) return;

  closeBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideActivityAlert();
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) hideActivityAlert();
  });
  controlsBound = true;
}

function showActivityAlert({ title = t("alert.notice"), message = "", duration = DEFAULT_ALERT_DURATION_MS } = {}) {
  const { modal, title: titleEl, message: messageEl } = getAlertElements();
  if (!modal) {
    window.alert(message || title);
    return false;
  }

  bindAlertControls();

  const isOpening = modal.style.display !== "flex";
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  modal.style.display = "flex";

  if (isOpening || !hideTimer) {
    scheduleHide(duration);
  }

  return true;
}

function resolveAlertText(message, type) {
  const text = String(message ?? "");
  if (CJK_PATTERN.test(text)) {
    return FALLBACK_BY_TYPE[type]?.() || t("alert.fallbackWarning");
  }
  return text;
}

function resolveAlertTitle(message, type, explicitTitle) {
  if (explicitTitle) return explicitTitle;
  return resolveAlertTitleByMessage(message, type) || DEFAULT_TITLES[type]?.() || DEFAULT_TITLES.error();
}

function isDuplicateToast(key) {
  const now = Date.now();
  if (key === lastToastKey && now - lastToastAt < DEDUPE_MS) {
    return true;
  }
  lastToastKey = key;
  lastToastAt = now;
  return false;
}

/**
 * @param {string} message
 * @param {"info"|"success"|"error"|"warning"} [type]
 * @param {{ duration?: number, title?: string }} [options]
 * @returns {boolean}
 */
export function showToast(message, type = "info", options = {}) {
  const safeText = resolveAlertText(message, type);
  const title = resolveAlertTitle(safeText, type, options.title);
  const duration = options.duration ?? DEFAULT_ALERT_DURATION_MS;
  const toastKey = `${type}:${title}:${safeText}`;

  if (isDuplicateToast(toastKey)) {
    return true;
  }

  return showActivityAlert({ title, message: safeText, duration });
}
