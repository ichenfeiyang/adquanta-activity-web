/**
 * Serializes native ad requests until the SDK sends their terminal callback.
 * The current SDK callback has no request identifier, so allowing concurrent
 * requests would make it impossible to route callbacks safely.
 */
export function normalizeActivityAdEventType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["reward_ad", "reward", "rewarded_ad", "rewardedad"].includes(normalized)) {
    return "reward_ad";
  }
  if (["interstitial_ad", "interstitial", "interstitialad"].includes(normalized)) {
    return "interstitial_ad";
  }
  return normalized;
}

export class ActivityAdRequestCoordinator {
  constructor({ timeoutMs = 60_000, onTimeout = () => {} } = {}) {
    this.activeRequest = null;
    this.timeoutMs = timeoutMs;
    this.onTimeout = onTimeout;
    this.timeoutId = 0;
  }

  begin(eventType, taskId, metadata = {}) {
    if (this.activeRequest) return null;
    const request = { eventType: normalizeActivityAdEventType(eventType), taskId, ...metadata };
    this.activeRequest = request;
    if (this.timeoutMs > 0) {
      this.timeoutId = globalThis.setTimeout(() => {
        if (this.activeRequest !== request) return;
        this.activeRequest = null;
        this.timeoutId = 0;
        this.onTimeout(request);
      }, this.timeoutMs);
    }
    return request;
  }

  getTaskId(eventType) {
    return this.activeRequest?.eventType === eventType
      ? this.activeRequest.taskId
      : "";
  }

  /** Atomically consume one terminal SDK callback and reject duplicates/stale callbacks. */
  take(eventType) {
    if (this.activeRequest?.eventType !== normalizeActivityAdEventType(eventType)) return null;
    const request = this.activeRequest;
    this.activeRequest = null;
    this.clearTimeout();
    return request;
  }

  cancel(request) {
    if (this.activeRequest !== request) return;
    this.activeRequest = null;
    this.clearTimeout();
  }

  clearTimeout() {
    if (!this.timeoutId) return;
    globalThis.clearTimeout(this.timeoutId);
    this.timeoutId = 0;
  }

  dispose() {
    this.activeRequest = null;
    this.clearTimeout();
  }
}
