/**
 * Unified H5 logging. Console output is enabled only in local dev or when ?debug=1 is present.
 * Never logs tokens or other secrets in request payloads.
 */
const TAG = "[ADActivityWeb]";

export function isDebugEnabled() {
  if (typeof import.meta !== "undefined" && import.meta.env?.PROD) {
    return false;
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    return true;
  }
  if (typeof window === "undefined") return false;
  try {
    const host = window.location?.hostname || "";
    return host === "localhost" || host === "127.0.0.1";
  } catch (_) {
    return false;
  }
}

function formatMessage(args) {
  if (args.length === 0) return TAG;
  if (args.length === 1 && typeof args[0] === "string") return TAG + " " + args[0];
  return TAG + " " + args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
}

function forwardToNative(level, msg) {
  if (!isDebugEnabled() || typeof window === "undefined") return;

  const bridge = window.ActivityBridgeHelper;
  if (bridge && typeof bridge.log === "function") {
    try {
      bridge.log(level, msg);
    } catch (_) {}
  }
}

export function log(...args) {
  if (!isDebugEnabled()) return;
  const msg = formatMessage(args);
  console.log(msg);
  forwardToNative("log", msg);
}

export function warn(...args) {
  if (!isDebugEnabled()) return;
  const msg = formatMessage(args);
  console.warn(msg);
  forwardToNative("warn", msg);
}

export function error(...args) {
  if (!isDebugEnabled()) return;
  const msg = formatMessage(args);
  console.error(msg);
  forwardToNative("error", msg);
}
