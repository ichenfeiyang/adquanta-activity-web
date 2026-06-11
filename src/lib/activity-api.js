/**
 * 活动中心后端 API
 * 用于前后端联调：请求基础数据接口
 * 日志带 [ActivityWeb] 前缀，便于在 Android WebView 的 Logcat 中查看
 */
import * as logger from "./activity-logger.js";
import { fetchWithRetry } from "./fetch-with-retry.js";

/** API host from VITE_ACTIVITY_API_BASE_URL (.env.local), no trailing slash */
export const BaseApiUrl = String(import.meta.env.VITE_ACTIVITY_API_BASE_URL || "").replace(/\/$/, "");

function buildAuthHeaders(options = {}) {
  const token = options.token ?? "";
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function maskAuthHeaders(headers = {}) {
  const out = { ...headers };
  for (const k of Object.keys(out)) {
    if (k.toLowerCase() === "authorization") {
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

  if (debug) {
    const headers = init.headers ? { ...init.headers } : {};
    logger.log(
      `[API] Request ${apiName}\n` +
        JSON.stringify(
          {
            requestId,
            api: apiName,
            method: init.method || "GET",
            url,
            headers: maskAuthHeaders(headers),
            body: typeof init.body === "string" ? init.body : init.body ?? null,
          },
          null,
          2,
        ),
    );
  }

  let response;
  try {
    response = await fetchWithRetry(url, init, { onRetry: buildRetryLogger(apiName) });
  } catch (error) {
    if (debug) {
      logger.error(
        `[API] Network error ${apiName} (${Date.now() - startedAt}ms)\n` +
          JSON.stringify({ requestId, message: error?.message || String(error) }, null, 2),
      );
    }
    throw error;
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
  return fetchApi("getActivityInfo", url, { method: "GET", headers: { ...buildAuthHeaders(options) } });
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

/**
 * 转动转盘获取金币（每日看视频完成后调用，消耗一次转盘机会并由服务端结算本次金币）
 * POST /api/v1/ops/activity/video
 * @param {Object} options - { baseUrl? }
 * @param {{ video_id?: string }} body - 当前后端可不传，默认空字符串
 * @returns {Promise<{ code: number, data?: { success: boolean, coin: number, total_coin: number, message: string, today_watched: number, remain_count: number, roulette?: { total_coins: number, earned_coins: number, remaining_coins: number, next_coin: number, roulette_coins?: number[] } }, message?: string }>}
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
  });
}

/**
 * 充值下单（兑换话费）
 * POST /api/v1/ops/activity/charges
 * @param {Object} options - { baseUrl?, token? }
 * @param {{ sku_code: string, send_value: number|string, phone_number: string }} body
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
    }),
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
