/**
 * Serializes native ad requests until the SDK sends their terminal callback.
 * The current SDK callback has no request identifier, so allowing concurrent
 * requests would make it impossible to route callbacks safely.
 */
export class ActivityAdRequestCoordinator {
  constructor() {
    this.activeRequest = null;
  }

  begin(eventType, taskId) {
    if (this.activeRequest) return null;
    const request = { eventType, taskId };
    this.activeRequest = request;
    return request;
  }

  getTaskId(eventType) {
    return this.activeRequest?.eventType === eventType
      ? this.activeRequest.taskId
      : "";
  }

  /** Atomically consume one terminal SDK callback and reject duplicates/stale callbacks. */
  take(eventType) {
    if (this.activeRequest?.eventType !== eventType) return null;
    const request = this.activeRequest;
    this.activeRequest = null;
    return request;
  }

  cancel(request) {
    if (this.activeRequest === request) this.activeRequest = null;
  }
}
