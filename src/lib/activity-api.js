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
import { redactActivityLogBody, redactActivityLogValue } from "./activity-log-redaction.js";
import {
  adaptV2ConfigToActivityInfo,
  adaptV2PrizesToCharges,
  adaptV2PrizesToTremendous,
  adaptV2RedeemOrder,
  adaptV2RedeemOrders,
  v2TaskAdSession,
  v2TasksByType,
} from "./activity-v2-adapter.js";

/** API host from VITE_ACTIVITY_API_BASE_URL (.env.local), no trailing slash */
export const BaseApiUrl = String(import.meta.env?.VITE_ACTIVITY_API_BASE_URL || "").replace(/\/$/, "");
// The submit API only writes a local order and must return promptly.  A short
// client deadline avoids trapping a user on the exchange page if a gateway or
// network request stalls.
export const CHARGE_REDEEM_TIMEOUT_MS = 5_000;
export const CHARGE_OPTIONS_TIMEOUT_MS = 5_000;

const ACTIVITY_V2_API_PREFIX = "/api/v2/activity";
const activityV2Context = new Map();

function createIdempotentKey(prefix = "activity") {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function activityV2ContextKey(options = {}) {
  return String(options.token || "anonymous");
}

function rememberActivityV2Config(options, data) {
  const key = activityV2ContextKey(options);
  const previous = activityV2Context.get(key) || {};
  const next = {
    ...previous,
    config: data,
    tasksByType: v2TasksByType(data),
  };
  activityV2Context.set(key, next);
  // A WebView normally has one token. Bound this defensive cache for long-lived debug sessions.
  if (activityV2Context.size > 8) {
    activityV2Context.delete(activityV2Context.keys().next().value);
  }
  return next;
}

function rememberActivityV2TaskResult(options, taskType, data) {
  const context = activityV2Context.get(activityV2ContextKey(options));
  const task = context?.tasksByType?.get(taskType);
  if (!task) return;
  if (data?.state && typeof data.state === "object") {
    Object.assign(task, data.state);
  }
  const join = data?.join;
  if (join && typeof join === "object") {
    task.state_detail = {
      ...(task.state_detail || {}),
      last_join: {
        join_id: join.join_id,
        reward_coin: join.reward_coin ?? join.coin_earned ?? 0,
        boosted: false,
        ad_boost_available: task?.ad_boost?.enabled === true,
      },
    };
  }
}

function rememberActivityV2AdSession(options, taskType, session) {
  const context = activityV2Context.get(activityV2ContextKey(options));
  const task = context?.tasksByType?.get(taskType);
  if (!task || !session || typeof session !== "object") return;
  task.state_detail = {
    ...(task.state_detail || {}),
    ad_session: session,
  };
}

function reusableActivityV2AdSession(task, now = Date.now()) {
  if (String(task?.state || "") !== "pending_ad") return null;
  if (!Array.isArray(task?.available_actions) || !task.available_actions.includes("client_complete")) {
    return null;
  }
  const session = v2TaskAdSession(task);
  if (!String(session.session_id || "").trim() || String(session.status || "") !== "pending_ad") {
    return null;
  }
  const nextAction = String(session.next_client_action || "").trim();
  if (nextAction && nextAction !== "show_ad") return null;
  const expiresAt = Date.parse(String(session.expires_at || ""));
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return session;
}

async function fetchActivityV2Config(options = {}) {
  const result = await fetchApi("getActivityV2Config", `${BaseApiUrl}${ACTIVITY_V2_API_PREFIX}/config`, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
  });
  if (result?.code === 200 && result?.data) rememberActivityV2Config(options, result.data);
  return result;
}

async function getActivityV2Task(options, taskType) {
  let context = activityV2Context.get(activityV2ContextKey(options));
  let task = context?.tasksByType?.get(taskType);
  if (!task) {
    const result = await fetchActivityV2Config(options);
    if (result?.code !== 200) throw new Error(result?.message || "Activity config unavailable");
    context = activityV2Context.get(activityV2ContextKey(options));
    task = context?.tasksByType?.get(taskType);
  }
  if (!task?.task_id) throw new Error(`Activity task is not configured: ${taskType}`);
  return task;
}

async function executeActivityV2TaskAction(options, taskType, action, payload = {}) {
  const task = await getActivityV2Task(options, taskType);
  const taskID = encodeURIComponent(String(task.task_id));
  const request = {
    idempotent_key: payload.idempotent_key || createIdempotentKey(`${taskType}-${action}`),
  };
  for (const key of ["session_id", "join_id", "ad_event_id", "clicked_count"]) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") {
      request[key] = payload[key];
    }
  }
  if (payload.extra && typeof payload.extra === "object") request.extra = payload.extra;
  const result = await fetchApi(
    `executeActivityV2TaskAction:${taskType}:${action}`,
    `${BaseApiUrl}${ACTIVITY_V2_API_PREFIX}/tasks/${taskID}/actions/${encodeURIComponent(action)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildAuthHeaders(options) },
      body: JSON.stringify(request),
    },
  );
  if (result?.code === 200 && result?.data) {
    rememberActivityV2TaskResult(options, taskType, result.data);
  }
  return { result, task };
}

function activityV2TaskJoin(data = {}) {
  return data?.join && typeof data.join === "object" ? data.join : {};
}

function activityV2TaskBoost(data = {}) {
  return data?.boost && typeof data.boost === "object" ? data.boost : {};
}

function activityV2TaskPayload(data = {}) {
  return data?.payload && typeof data.payload === "object" ? data.payload : {};
}

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
  return redactActivityLogValue(out);
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
  if (body.kind === "json") {
    const message = body.value?.message || body.value?.error?.message;
    if (message) return message;
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
            body: redactActivityLogBody(fetchInit.body),
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
            responseBody: redactActivityLogBody(body.value),
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
  const gaHeader = await buildGaClientIdHeader(options);
  const result = await fetchApi("getActivityV2Config", `${BaseApiUrl}${ACTIVITY_V2_API_PREFIX}/config`, {
    method: "GET",
    headers: { ...buildAuthHeaders(options), ...gaHeader },
  });
  if (result?.code === 200 && result?.data) {
    rememberActivityV2Config(options, result.data);
    result.data = adaptV2ConfigToActivityInfo(result.data);
    syncGoldCoinsFromActivityInfo(result.data);
  }
  return result;
}

/**
 * 签到（activity_id / user 从 Bearer token 解析）
 * Activity V2 signin task action.
 * @param {Object} options - { token? }
 * @param {{ type?: "base" | "triple" }} body
 * @returns {Promise<{ code: number, data?: Object, message?: string }>}
 */
export async function postCheckin(options = {}, body = {}) {
  const type = body.type ?? "base";
  const task = await getActivityV2Task(options, "signin");
  const detail = task?.state_detail || {};
  const joinID = detail?.boost_candidate?.join_id || detail?.last_join?.join_id || "";
  const action = type === "triple" ? "boost" : "join";
  const { result } = await executeActivityV2TaskAction(options, "signin", action, {
    join_id: action === "boost" ? joinID : "",
    ad_event_id: body.ad_event_id || body.video_id || "",
  });
  if (result?.code !== 200) return result;
  const join = activityV2TaskJoin(result.data);
  const boost = activityV2TaskBoost(result.data);
  const payload = activityV2TaskPayload(result.data);
  result.data = {
    success: true,
    coin: Number((action === "boost" ? boost.bonus_coin : join.coin_earned ?? join.reward_coin) ?? payload.coin ?? 0),
    total_coin: Number(boost.coin_balance ?? join.coin_balance ?? payload.total_coin ?? 0),
    chest: payload.chest || null,
    message: payload.message || "",
  };
  return result;
}

/** Settle or dismiss a server-issued check-in chest. */
export async function postCheckinChest(options = {}, body = {}) {
  const { result } = await executeActivityV2TaskAction(options, "signin", "chest_claim", {
    idempotent_key: body.idempotent_key || "",
    ad_event_id: body.ad_event_id || "",
    extra: { chest_id: String(body.chest_id ?? ""), action: body.action || "claim" },
  });
  if (result?.code !== 200) return result;
  const payload = activityV2TaskPayload(result.data);
  const chest = payload.chest && typeof payload.chest === "object" ? payload.chest : {};
  result.data = {
    success: payload.success !== false && chest.status !== "failed",
    coin: Number(payload.coin ?? chest.reward_coin ?? 0),
    total_coin: Number(payload.total_coin ?? chest.coin_balance ?? 0),
    message: payload.message || "",
  };
  return result;
}

/** Prepare the server-side watch-ad session before invoking the unchanged Native bridge. */
export async function prepareActivityVideo(options = {}) {
  const task = await getActivityV2Task(options, "watch_ad");
  const pendingSession = reusableActivityV2AdSession(task);
  if (pendingSession) {
    return {
      code: 200,
      data: {
        success: true,
        reused: true,
        session_id: String(pendingSession.session_id),
        custom_data: String(pendingSession.custom_data || pendingSession.session_id),
        expires_at: pendingSession.expires_at,
      },
    };
  }
  const { result } = await executeActivityV2TaskAction(options, "watch_ad", "prepare");
  if (result?.code !== 200) return result;
  const join = activityV2TaskJoin(result.data);
  const session =
    (join.ad_session && typeof join.ad_session === "object" ? join.ad_session : null) ||
    (result.data?.state?.state_detail?.ad_session && typeof result.data.state.state_detail.ad_session === "object"
      ? result.data.state.state_detail.ad_session
      : null) ||
    {};
  rememberActivityV2AdSession(options, "watch_ad", session);
  result.data = {
    success: Boolean(session.session_id),
    session_id: String(session.session_id || ""),
    custom_data: String(session.custom_data || session.session_id || ""),
    expires_at: session.expires_at || null,
  };
  return result;
}

/**
 * 转动转盘获取金币（每日看视频完成后调用，消耗一次转盘机会并由服务端结算本次金币）
 * Activity V2 watch_ad client_complete compatibility action.
 * @param {Object} options - { baseUrl? }
 * @param {{ video_id?: string }} body - 当前后端可不传，默认空字符串
 * @returns {Promise<{ code: number, data?: { success: boolean, coin: number, total_coin: number, message: string, today_watched: number, remain_count: number, roulette?: { daily_max_coins?: number, total_coins?: number, earned_coins: number, remaining_coins: number, next_coin: number, roulette_coins?: number[] } }, message?: string }>}
 * @description data.coin 为本次看广告/转盘获得的金币数，前端转盘动画应对齐该值。
 */
export async function postActivityVideo(options = {}, body = {}) {
  const task = await getActivityV2Task(options, "watch_ad");
  const session = v2TaskAdSession(task);
  let { result } = await executeActivityV2TaskAction(options, "watch_ad", "client_complete", {
    // Tie retries to the prepared server session. The repository settles with
    // the prepare idempotency key, but a stable action key also keeps gateway or
    // lost-response retries semantically identical.
    idempotent_key: body.session_id ? `watch-ad-complete-${body.session_id}` : "",
    session_id: body.session_id || session.session_id || "",
    ad_event_id: body.ad_event_id || body.video_id || "",
  });
  if (result?.code !== 200) return result;
  const join = activityV2TaskJoin(result.data);
  const payload = activityV2TaskPayload(result.data);
  result.data = {
    success: true,
    coin: Number(join.coin_earned ?? join.reward_coin ?? payload.coin ?? 0),
    total_coin: Number(join.coin_balance ?? payload.total_coin ?? 0),
    message: payload.message || "",
    today_watched: payload.today_watched,
    remain_count: payload.remain_count,
    roulette: payload.roulette || null,
  };
  return result;
}

/**
 * 新用户一次性礼包
 * Activity V2 new_user_bonus task action.
 * @param {Object} options - { token? }
 * @param {{ action: "claim_base" | "claim_video" | "dismiss", ad_event_id?: string }} body
 */
export async function postNewUserBonus(options = {}, body = {}) {
  const { result } = await executeActivityV2TaskAction(options, "new_user_bonus", body.action || "claim_base", {
    ad_event_id: body.ad_event_id || "",
  });
  if (result?.code !== 200) return result;
  const join = activityV2TaskJoin(result.data);
  const payload = activityV2TaskPayload(result.data);
  result.data = {
    success: payload.success !== false,
    coin: Number(join.coin_earned ?? join.reward_coin ?? payload.coin ?? 0),
    reward_coin: Number(join.reward_coin ?? join.coin_earned ?? payload.coin ?? 0),
    total_coin: Number(join.coin_balance ?? payload.total_coin ?? 0),
    message: payload.message || "",
  };
  return result;
}

/** Start, settle, abandon, or boost the daily coin rain session. */
export async function postCoinRain(options = {}, body = {}) {
  const { result } = await executeActivityV2TaskAction(options, "coin_rain", body.action || "start", {
    session_id: body.session_id || "",
    clicked_count: Number.isFinite(body.clicked_count) ? body.clicked_count : undefined,
    ad_event_id: body.ad_event_id || "",
  });
  if (result?.code === 200) {
    const join = activityV2TaskJoin(result.data);
    const payload = activityV2TaskPayload(result.data);
    result.data = {
      success: payload.success !== false,
      ...payload,
      coin: Number(payload.coin ?? join.coin_earned ?? join.reward_coin ?? 0),
      total_coin: Number(payload.total_coin ?? join.coin_balance ?? 0),
    };
  }
  return result;
}

/** Submit text-only user feedback as JSON. */
export async function postActivityFeedback(options = {}, body = {}) {
  return fetchApi("postActivityFeedback", `${BaseApiUrl}${ACTIVITY_V2_API_PREFIX}/feedback`, {
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

/**
 * 获取话费充值选项
 * GET Activity V2 redeemable Ding prizes.
 * 参数：
 * - country_code: "IN"（国家枚举）
 * - phone_number: 完整手机号（国家码数字 + 本地号码），如 918801384326
 *
 * @param {Object} options - { baseUrl?, token? }
 * @param {{ country_code?: string, phone_number?: string }} params
 * @returns {Promise<{ code: number, data?: any }>}
 */
export async function getCharges(options = {}, params = {}) {
  const url = `${BaseApiUrl}${ACTIVITY_V2_API_PREFIX}/redeemable-prizes?${new URLSearchParams({
    provider_type: "dingconnect",
    country_iso: params.country_code ?? "",
  }).toString()}`;
  const result = await fetchApi("getRedeemableDingPrizes", url, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
    timeoutMs: CHARGE_OPTIONS_TIMEOUT_MS,
  });
  if (result?.code === 200) result.data = adaptV2PrizesToCharges(result.data, params);
  return result;
}

/**
 * 充值下单（兑换话费）
 * POST Activity V2 Ding redemption.
 * @param {Object} options - { baseUrl?, token? }
 * @param {{ sku_code: string, send_value: number|string, phone_number: string, client_request_id?: string }} body
 * @returns {Promise<{ code: number, data?: any, message?: string }>}
 */
export async function postChargeRedeem(options = {}, body = {}) {
  const result = await fetchApi("postActivityV2DingRedeem", `${BaseApiUrl}${ACTIVITY_V2_API_PREFIX}/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders(options) },
    body: JSON.stringify({
      idempotent_key: body.client_request_id || createIdempotentKey("redeem-ding"),
      prize_id: body.prize_id || body.sku_code || "",
      recipient_info: {
        phone_number: body.phone_number ?? "",
        account_number: body.phone_number ?? "",
      },
    }),
    timeoutMs: CHARGE_REDEEM_TIMEOUT_MS,
  });
  if (result?.code === 200 && result?.data) {
    const order = adaptV2RedeemOrder(result.data);
    result.data = {
      ...order,
      success: Boolean(order.order_id),
      coin_spent: Number(order.coin_cost ?? 0),
      coin_balance: Number(result.data.coin_balance ?? 0),
      message: result.data.message || "",
    };
  }
  return result;
}

/**
 * 查询充值订单状态
 * GET Activity V2 redemption status.
 * @param {Object} options - { baseUrl?, token? }
 * @param {string} distributorRef
 * @returns {Promise<{ code: number, data?: any, message?: string }>}
 */
export async function getChargeStatus(options = {}, distributorRef = "") {
  const ref = encodeURIComponent(String(distributorRef || ""));
  const result = await fetchApi("getActivityV2RedeemStatus", `${BaseApiUrl}${ACTIVITY_V2_API_PREFIX}/redeem/${ref}/status`, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
  });
  if (result?.code === 200 && result?.data) {
    result.data = { ...adaptV2RedeemOrder(result.data), success: true };
  }
  return result;
}

/**
 * 获取兑换/充值记录列表
 * GET Activity V2 Ding redemption records.
 * @param {Object} options - { baseUrl?, token? }
 * @param {{ limit?: number, offset?: number }} params
 * @returns {Promise<{ code: number, data?: { records?: Array, limit?: number, offset?: number }, message?: string }>}
 */
export async function getChargeRecords(options = {}, params = {}) {
  const page = Math.floor(Math.max(0, Number(params.offset) || 0) / Math.max(1, Number(params.limit) || 20)) + 1;
  const url = `${BaseApiUrl}${ACTIVITY_V2_API_PREFIX}/redeem?${new URLSearchParams({
    provider_type: "dingconnect",
    page: String(page),
    per_page: String(params.limit || 20),
  }).toString()}`;
  const result = await fetchApi("getActivityV2DingRedeemOrders", url, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
  });
  if (result?.code === 200) {
    result.data = {
      records: adaptV2RedeemOrders(result.data),
      pagination: result.pagination || null,
    };
  }
  return result;
}

/**
 * Tremendous 礼品卡可兑换列表
 * GET Activity V2 Tremendous prizes.
 */
export async function getTremendousProducts(options = {}, params = {}) {
  const url = `${BaseApiUrl}${ACTIVITY_V2_API_PREFIX}/redeemable-prizes?${new URLSearchParams({
    provider_type: "tremendous",
    country_iso: params.country_code ?? "",
  }).toString()}`;
  const result = await fetchApi("getRedeemableTremendousPrizes", url, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
    timeoutMs: params.timeoutMs ?? 4_000,
  });
  if (result?.code === 200) result.data = adaptV2PrizesToTremendous(result.data, params);
  return result;
}

/**
 * Tremendous 礼品卡兑换
 * POST Activity V2 Tremendous redemption.
 */
export async function postTremendousRedeem(options = {}, body = {}) {
  const result = await fetchApi("postActivityV2TremendousRedeem", `${BaseApiUrl}${ACTIVITY_V2_API_PREFIX}/redeem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(options),
    },
    body: JSON.stringify({
      idempotent_key: body.client_request_id || createIdempotentKey("redeem-tremendous"),
      prize_id: body.prize_id || "",
      recipient_info: {
        recipient_name: body.recipient_name ?? "",
        recipient_email: body.recipient_email ?? "",
        recipient_phone: body.recipient_phone ?? "",
        delivery_method: body.delivery_method ?? "",
      },
    }),
  });
  if (result?.code === 200 && result?.data) {
    const order = adaptV2RedeemOrder(result.data);
    result.data = {
      ...order,
      success: Boolean(order.order_id),
      coin_spent: Number(order.coin_cost ?? 0),
      message: result.data.message || "",
    };
  }
  return result;
}

/**
 * Tremendous 礼品卡兑换记录
 * GET Activity V2 Tremendous redemption records.
 */
export async function getTremendousRecords(options = {}, params = {}) {
  const page = Math.floor(Math.max(0, Number(params.offset) || 0) / Math.max(1, Number(params.limit) || 20)) + 1;
  const url = `${BaseApiUrl}${ACTIVITY_V2_API_PREFIX}/redeem?${new URLSearchParams({
    provider_type: "tremendous",
    page: String(page),
    per_page: String(params.limit || 20),
  }).toString()}`;
  const result = await fetchApi("getActivityV2TremendousRedeemOrders", url, {
    method: "GET",
    headers: { ...buildAuthHeaders(options) },
  });
  if (result?.code === 200) {
    result.data = {
      records: adaptV2RedeemOrders(result.data),
      pagination: result.pagination || null,
    };
  }
  return result;
}
