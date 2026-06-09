/**
 * 活动中心后端 API
 * 用于前后端联调：请求基础数据接口
 * 日志带 [ActivityWeb] 前缀，便于在 Android WebView 的 Logcat 中查看
 */
import * as logger from "./activity-logger.js";

/** API host from VITE_ACTIVITY_API_BASE_URL (.env.local), no trailing slash */
export const BaseApiUrl = String(import.meta.env.VITE_ACTIVITY_API_BASE_URL || "").replace(/\/$/, "");

function resolveApiBase() {
  return BaseApiUrl;
}

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

async function safeReadResponseBody(response) {
  // Clone so we can try json then fallback to text without consuming original
  const cloned = response.clone();
  const json = await cloned.json().catch(() => null);
  if (json !== null) return { kind: "json", value: json };
  const text = await response.clone().text().catch(() => "");
  return { kind: "text", value: text };
}

async function loggedFetch(apiName, url, init = {}) {
  const requestId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const startedAt = Date.now();

  const headers = init.headers ? { ...init.headers } : {};
  const reqLog = {
    requestId,
    api: apiName,
    method: init.method || "GET",
    url,
    headers: maskAuthHeaders(headers),
    body: typeof init.body === "string" ? init.body : init.body ?? null,
  };
  logger.log(`[API] Request ${apiName}\n` + JSON.stringify(reqLog, null, 2));

  let response;
  try {
    response = await fetch(url, init);
  } catch (e) {
    const elapsedMs = Date.now() - startedAt;
    logger.error(`[API] Network error ${apiName} (${elapsedMs}ms)\n` + JSON.stringify({ requestId, message: e?.message || String(e) }, null, 2));
    throw e;
  }

  const elapsedMs = Date.now() - startedAt;
  const body = await safeReadResponseBody(response);
  const resLog = {
    requestId,
    api: apiName,
    elapsedMs,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    responseBody: body.value,
  };
  logger.log(`[API] Response ${apiName}\n` + JSON.stringify(resLog, null, 2));

  if (!response.ok) {
    const message = (body.kind === "json" && body.value && body.value.message) ? body.value.message : `HTTP ${response.status}`;
    throw new Error(message);
  }

  // Return json if possible; otherwise return { code: response.status, message: text }
  if (body.kind === "json") return body.value;
  return { code: response.status, message: body.value };
}

/**
 * 通过 code 换取 access_token（Web 端鉴权）
 * POST /api/v1/public/activity/auth/token
 * @param {Object} options - { baseUrl? } 覆盖默认 BaseApiUrl
 * @param {{ code: string }} body
 * @returns {Promise<{ code: number, data?: { success?: boolean, message?: string, access_token?: string, token_type?: string, expires_at?: number, expires_in?: number } }>}
 */
export async function postAuthToken(options = {}, body = {}) {
  const baseUrl = resolveApiBase(options);
  const url = `${baseUrl}/api/v1/public/activity/auth/token`;
  return loggedFetch("postAuthToken", url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: body.code ?? "" }),
  });
}

/**
 * 获取活动基础数据（activity_id / user 从 Bearer token 解析）
 * @param {Object} options
 * @param {string} [options.token]
 * @returns {Promise<{ code: number, data?: Object }>}
 */
export async function getActivityInfo(options = {}) {
  const baseUrl = resolveApiBase(options);
  const url = `${baseUrl}/api/v1/ops/activity/info`;
  return loggedFetch("getActivityInfo", url, { method: "GET", headers: { ...buildAuthHeaders(options) } });
}

/**
 * 签到（activity_id / user 从 Bearer token 解析）
 * POST /api/v1/ops/activity/checkin
 * @param {Object} options - { token? }
 * @param {{ type?: "base" | "triple" }} body
 * @returns {Promise<{ code: number, data?: Object, message?: string }>}
 */
export async function postCheckin(options = {}, body = {}) {
  const baseUrl = resolveApiBase(options);
  const url = `${baseUrl}/api/v1/ops/activity/checkin`;
  return loggedFetch("postCheckin", url, {
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
  const baseUrl = resolveApiBase(options);
  const url = `${baseUrl}/api/v1/ops/activity/video`;
  return loggedFetch("postActivityVideo", url, {
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
  const baseUrl = resolveApiBase(options);
  const url = `${baseUrl}/api/v1/ops/activity/charges?${new URLSearchParams({
    country_code: params.country_code ?? "",
    phone_number: params.phone_number ?? "",
  }).toString()}`;
  return loggedFetch("getCharges", url, {
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
  const baseUrl = resolveApiBase(options);
  const url = `${baseUrl}/api/v1/ops/activity/charges`;
  return loggedFetch("postChargeRedeem", url, {
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
  const baseUrl = resolveApiBase(options);
  const ref = encodeURIComponent(String(distributorRef || ""));
  const url = `${baseUrl}/api/v1/ops/activity/charges/${ref}/status`;
  return loggedFetch("getChargeStatus", url, {
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
  const baseUrl = resolveApiBase(options);
  const url = `${baseUrl}/api/v1/ops/activity/charges/records?${new URLSearchParams({
    limit: String(params.limit ?? ""),
    offset: String(params.offset ?? ""),
  }).toString()}`;
  return loggedFetch("getChargeRecords", url, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
  });
}

/**
 * 获取兑换记录
 * GET /api/v1/ops/activity/records
 * @param {Object} options - { baseUrl?, token? }
 * @returns {Promise<{ code: number, data?: Array }>}
 */
export async function getActivityRecords(options = {}) {
  const baseUrl = resolveApiBase(options);
  const url = `${baseUrl}/api/v1/ops/activity/records`;
  return loggedFetch("getActivityRecords", url, { method: "GET", headers: { ...buildAuthHeaders(options) } });
}
