/**
 * 活动中心后端 API
 * 用于前后端联调：请求基础数据接口
 * 日志带 [ActivityWeb] 前缀，便于在 Android WebView 的 Logcat 中查看
 */
import * as logger from "./activity-logger.js";
import { fetchWithRetry } from "./fetch-with-retry.js";
import { buildGaClientIdHeader } from "./ga-client-id.js";
import { syncGoldCoinsFromActivityInfo } from "./ga-user-properties.js";
import { rateLimitMessage } from "./activity-messages.js";

/** API host from VITE_ACTIVITY_API_BASE_URL (.env.local), no trailing slash */
export const BaseApiUrl = String(import.meta.env?.VITE_ACTIVITY_API_BASE_URL || "").replace(/\/$/, "");
// The submit API only writes a local order and must return promptly.  A short
// client deadline avoids trapping a user on the exchange page if a gateway or
// network request stalls.
export const CHARGE_REDEEM_TIMEOUT_MS = 5_000;
export const CHARGE_OPTIONS_TIMEOUT_MS = 5_000;

function buildAuthHeaders(options = {}) {
  const token = options.token ?? "";
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function maskAuthHeaders(headers = {}) {
  const out = { ...headers };
  for (const k of Object.keys(out)) {
    const lowerKey = k.toLowerCase();
    if (lowerKey === "authorization" || lowerKey === "x-ga-client-id") {
      out[k] = "[REDACTED]";
    }
  }
  return out;
}

async function readParsedBody(source) {
  const json = await source.json().catch(() => null);
  if (json !== null) return { kind: "json", value: json };
  const text = await source.text().catch(() => "");
  return { kind: "text", value: text };
}

async function readResponseBody(response, { preserveOriginal = false } = {}) {
  if (!preserveOriginal) {
    return readParsedBody(response);
  }
  const json = await response.clone().json().catch(() => null);
  if (json !== null) return { kind: "json", value: json };
  const text = await response.clone().text().catch(() => "");
  return { kind: "text", value: text };
}

function getHttpErrorMessage(body, status) {
  if (status === 429) return rateLimitMessage();
  if (body.kind === "json" && body.value?.message) {
    return body.value.message;
  }
  return `HTTP ${status}`;
}

function parseApiResponse(body, status) {
  if (body.kind === "json") return body.value;
  return { code: status, message: body.value };
}

function buildRetryLogger(apiName) {
  if (!logger.isDebugEnabled()) return undefined;
  return ({ nextAttempt, maxAttempts, error }) => {
    logger.warn(`[API] Retry ${apiName} ${nextAttempt}/${maxAttempts}`, {
      message: error instanceof Error ? error.message : String(error),
    });
  };
}

async function fetchApi(apiName, url, init = {}) {
  const debug = logger.isDebugEnabled();
  const startedAt = Date.now();
  const requestId = debug ? `${Date.now()}_${Math.random().toString(16).slice(2, 8)}` : "";
  const timeoutMs = Number(init.timeoutMs || 0);
  const fetchInit = { ...init };
  delete fetchInit.timeoutMs;
  let timeoutId = 0;
  let timeoutController = null;

  if (timeoutMs > 0 && typeof AbortController !== "undefined") {
    timeoutController = new AbortController();
    timeoutId = globalThis.setTimeout(() => timeoutController.abort(), timeoutMs);
    fetchInit.signal = timeoutController.signal;
  }

  if (debug) {
    const headers = init.headers ? { ...init.headers } : {};
    logger.log(
      `[API] Request ${apiName}\n` +
        JSON.stringify(
          {
            requestId,
            api: apiName,
            method: fetchInit.method || "GET",
            url,
            headers: maskAuthHeaders(headers),
            body: typeof fetchInit.body === "string" ? fetchInit.body : fetchInit.body ?? null,
          },
          null,
          2,
        ),
    );
  }

  let response;
  try {
    response = await fetchWithRetry(url, fetchInit, { onRetry: buildRetryLogger(apiName) });
  } catch (error) {
    if (debug) {
      logger.error(
        `[API] Network error ${apiName} (${Date.now() - startedAt}ms)\n` +
          JSON.stringify({ requestId, message: error?.message || String(error) }, null, 2),
      );
    }
    throw error;
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
  }

  const body = await readResponseBody(response, { preserveOriginal: debug });

  if (debug) {
    logger.log(
      `[API] Response ${apiName}\n` +
        JSON.stringify(
          {
            requestId,
            api: apiName,
            elapsedMs: Date.now() - startedAt,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            responseBody: body.value,
          },
          null,
          2,
        ),
    );
  }

  if (!response.ok) {
    throw new Error(getHttpErrorMessage(body, response.status));
  }

  return parseApiResponse(body, response.status);
}

/**
 * 获取活动基础数据（activity_id / user 从 Bearer token 解析）
 * @param {Object} options
 * @param {string} [options.token]
 * @returns {Promise<{ code: number, data?: Object }>}
 */
export async function getActivityInfo(options = {}) {
  const baseUrl = BaseApiUrl;
  const url = `${baseUrl}/api/v1/ops/activity/info`;
  const gaHeader = await buildGaClientIdHeader(options);
  const result = await fetchApi("getActivityInfo", url, {
    method: "GET",
    headers: { ...buildAuthHeaders(options), ...gaHeader },
  });
  if (result?.code === 200 && result?.data) {
    syncGoldCoinsFromActivityInfo(result.data);
  }
  return result;
}

/**
 * 签到（activity_id / user 从 Bearer token 解析）
 * POST /api/v1/ops/activity/checkin
 * @param {Object} options - { token? }
 * @param {{ type?: "base" | "triple" }} body
 * @returns {Promise<{ code: number, data?: Object, message?: string }>}
 */
export async function postCheckin(options = {}, body = {}) {
  const baseUrl = BaseApiUrl;
  const url = `${baseUrl}/api/v1/ops/activity/checkin`;
  return fetchApi("postCheckin", url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders(options) },
    body: JSON.stringify({
      type: body.type ?? "base",
    }),
  });
}

/** Settle or dismiss a server-issued check-in chest. */
export async function postCheckinChest(options = {}, body = {}) {
  const url = `${BaseApiUrl}/api/v1/ops/activity/checkin/chest`;
  const payload = { chest_id: body.chest_id ?? 0, action: body.action ?? "" };
  if (body.ad_event_id) payload.ad_event_id = body.ad_event_id;
  return fetchApi("postCheckinChest", url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders(options) },
    body: JSON.stringify(payload),
  });
}

/**
 * 转动转盘获取金币（每日看视频完成后调用，消耗一次转盘机会并由服务端结算本次金币）
 * POST /api/v1/ops/activity/video
 * @param {Object} options - { baseUrl? }
 * @param {{ video_id?: string }} body - 当前后端可不传，默认空字符串
 * @returns {Promise<{ code: number, data?: { success: boolean, coin: number, total_coin: number, message: string, today_watched: number, remain_count: number, roulette?: { daily_max_coins?: number, total_coins?: number, earned_coins: number, remaining_coins: number, next_coin: number, roulette_coins?: number[] } }, message?: string }>}
 * @description data.coin 为本次看广告/转盘获得的金币数，前端转盘动画应对齐该值。
 */
export async function postActivityVideo(options = {}, body = {}) {
  const baseUrl = BaseApiUrl;
  const url = `${baseUrl}/api/v1/ops/activity/video`;
  return fetchApi("postActivityVideo", url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders(options) },
    body: JSON.stringify({ video_id: body.video_id ?? "" }),
  });
}

/**
 * 新用户一次性礼包
 * POST /api/v1/ops/activity/new-user-bonus
 * @param {Object} options - { token? }
 * @param {{ action: "claim_base" | "claim_video" | "dismiss", ad_event_id?: string }} body
 */
export async function postNewUserBonus(options = {}, body = {}) {
  const baseUrl = BaseApiUrl;
  const url = `${baseUrl}/api/v1/ops/activity/new-user-bonus`;
  const payload = { action: body.action ?? "" };
  if (body.ad_event_id) payload.ad_event_id = body.ad_event_id;
  return fetchApi("postNewUserBonus", url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders(options) },
    body: JSON.stringify(payload),
  });
}

/** Start, settle, abandon, or boost the daily coin rain session. */
export async function postCoinRain(options = {}, body = {}) {
  const payload = { action: body.action ?? "" };
  if (body.session_id) payload.session_id = body.session_id;
  if (Number.isFinite(body.clicked_count)) payload.clicked_count = body.clicked_count;
  if (body.ad_event_id) payload.ad_event_id = body.ad_event_id;
  return fetchApi("postCoinRain", `${BaseApiUrl}/api/v1/ops/activity/coin-rain`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders(options) },
    body: JSON.stringify(payload),
  });
}

/** Submit text-only user feedback as JSON. */
export async function postActivityFeedback(options = {}, body = {}) {
  return fetchApi("postActivityFeedback", `${BaseApiUrl}/api/v1/ops/activity/feedback`, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(options),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: String(body.content || ""),
      client_request_id: String(body.clientRequestId || ""),
      contact_email: String(body.contactEmail || ""),
      locale: String(body.locale || ""),
      country_code: String(body.countryCode || ""),
    }),
    timeoutMs: 15_000,
  });
}

/** Permanently remove the Rewards Center entry for the Activity Token UUID. */
export async function postHideRewardsCenter(options = {}) {
  return fetchApi("postHideRewardsCenter", `${BaseApiUrl}/api/v1/ops/activity/rewards-center/hide`, {
    method: "POST",
    headers: { ...buildAuthHeaders(options) },
    timeoutMs: 15_000,
  });
}

/**
 * 获取话费充值选项
 * GET /api/v1/ops/activity/charges
 * 参数：
 * - country_code: "IN"（国家枚举）
 * - phone_number: 完整手机号（国家码数字 + 本地号码），如 918801384326
 *
 * @param {Object} options - { baseUrl?, token? }
 * @param {{ country_code?: string, phone_number?: string }} params
 * @returns {Promise<{ code: number, data?: any }>}
 */
export async function getCharges(options = {}, params = {}) {
  const baseUrl = BaseApiUrl;
  const url = `${baseUrl}/api/v1/ops/activity/charges?${new URLSearchParams({
    country_code: params.country_code ?? "",
    phone_number: params.phone_number ?? "",
  }).toString()}`;
  return fetchApi("getCharges", url, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
    timeoutMs: CHARGE_OPTIONS_TIMEOUT_MS,
  });
}

/**
 * 充值下单（兑换话费）
 * POST /api/v1/ops/activity/charges
 * @param {Object} options - { baseUrl?, token? }
 * @param {{ sku_code: string, send_value: number|string, phone_number: string, client_request_id?: string }} body
 * @returns {Promise<{ code: number, data?: any, message?: string }>}
 */
export async function postChargeRedeem(options = {}, body = {}) {
  const baseUrl = BaseApiUrl;
  const url = `${baseUrl}/api/v1/ops/activity/charges`;
  return fetchApi("postChargeRedeem", url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders(options) },
    body: JSON.stringify({
      sku_code: body.sku_code ?? "",
      send_value: body.send_value ?? "",
      phone_number: body.phone_number ?? "",
      client_request_id: body.client_request_id ?? "",
    }),
    timeoutMs: CHARGE_REDEEM_TIMEOUT_MS,
  });
}

/**
 * 查询充值订单状态
 * GET /api/v1/ops/activity/charges/{distributor_ref}/status
 * @param {Object} options - { baseUrl?, token? }
 * @param {string} distributorRef
 * @returns {Promise<{ code: number, data?: any, message?: string }>}
 */
export async function getChargeStatus(options = {}, distributorRef = "") {
  const baseUrl = BaseApiUrl;
  const ref = encodeURIComponent(String(distributorRef || ""));
  const url = `${baseUrl}/api/v1/ops/activity/charges/${ref}/status`;
  return fetchApi("getChargeStatus", url, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
  });
}

/**
 * 获取兑换/充值记录列表
 * GET /api/v1/ops/activity/charges/records
 * @param {Object} options - { baseUrl?, token? }
 * @param {{ limit?: number, offset?: number }} params
 * @returns {Promise<{ code: number, data?: { records?: Array, limit?: number, offset?: number }, message?: string }>}
 */
export async function getChargeRecords(options = {}, params = {}) {
  const baseUrl = BaseApiUrl;
  const url = `${baseUrl}/api/v1/ops/activity/charges/records?${new URLSearchParams({
    limit: String(params.limit ?? ""),
    offset: String(params.offset ?? ""),
  }).toString()}`;
  return fetchApi("getChargeRecords", url, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
  });
}

/**
 * Tremendous 礼品卡可兑换列表
 * GET /api/v1/ops/activity/tremendous
 */
export async function getTremendousProducts(options = {}, params = {}) {
  const baseUrl = BaseApiUrl;
  const url = `${baseUrl}/api/v1/ops/activity/tremendous?${new URLSearchParams({
    country_code: params.country_code ?? "",
    currency_code: params.currency_code ?? "",
  }).toString()}`;
  return fetchApi("getTremendousProducts", url, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
    timeoutMs: params.timeoutMs ?? 4_000,
  });
}

/**
 * Tremendous 礼品卡兑换
 * POST /api/v1/ops/activity/tremendous
 */
export async function postTremendousRedeem(options = {}, body = {}) {
  const baseUrl = BaseApiUrl;
  const url = `${baseUrl}/api/v1/ops/activity/tremendous`;
  return fetchApi("postTremendousRedeem", url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(options),
    },
    body: JSON.stringify({
      product_id: body.product_id ?? "",
      country_code: body.country_code ?? "",
      denomination: body.denomination ?? 0,
      currency_code: body.currency_code ?? "",
      recipient_name: body.recipient_name ?? "",
      recipient_email: body.recipient_email ?? "",
      recipient_phone: body.recipient_phone ?? "",
      delivery_method: body.delivery_method ?? "",
    }),
  });
}

/**
 * Tremendous 礼品卡兑换记录
 * GET /api/v1/ops/activity/tremendous/records
 */
export async function getTremendousRecords(options = {}, params = {}) {
  const baseUrl = BaseApiUrl;
  const url = `${baseUrl}/api/v1/ops/activity/tremendous/records?${new URLSearchParams({
    limit: String(params.limit ?? ""),
    offset: String(params.offset ?? ""),
  }).toString()}`;
  return fetchApi("getTremendousRecords", url, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
  });
}
