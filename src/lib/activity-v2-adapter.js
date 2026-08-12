const FAILED_REDEEM_STATUSES = new Set([
  "failed",
  "fail",
  "error",
  "closed",
  "canceled",
  "cancelled",
  "failed_refunded",
  "refund_pending",
  "delivery_failed",
]);

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function firstString(...values) {
  const value = firstValue(...values);
  return value == null ? "" : String(value).trim();
}

function normalizeProviderType(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (provider === "ding" || provider === "ding_connect") return "dingconnect";
  return provider;
}

function normalizePrizeType(value) {
  const type = String(value || "").trim().toLowerCase();
  return type.includes("data") ? "data" : "topup";
}

function taskStateDetail(task) {
  return asObject(task?.state_detail);
}

function taskProgress(task) {
  return asObject(taskStateDetail(task).progress);
}

function taskLimits(task) {
  return asObject(taskStateDetail(task).limits);
}

function taskRewardPreview(task) {
  return asObject(firstValue(task?.reward_preview, taskStateDetail(task).reward_preview));
}

export function v2TasksByType(configData = {}) {
  const result = new Map();
  for (const task of asArray(configData.tasks)) {
    const type = String(task?.task_type || "").trim();
    if (type && !result.has(type)) result.set(type, task);
  }
  return result;
}

export function v2TaskAdSession(task) {
  const detail = taskStateDetail(task);
  return asObject(firstValue(detail.ad_session, task?.ad_session));
}

function isUsableV2TaskState(task) {
  const state = String(task?.state || "").trim();
  return state !== "unavailable" && state !== "unsupported";
}

function adaptSigninDays(task) {
  const detail = taskStateDetail(task);
  const progress = taskProgress(task);
  const preview = taskRewardPreview(task);
  const sourceDays = asArray(firstValue(detail.days, preview.days));
  const maxStreak = Math.max(
    1,
    asNumber(firstValue(progress.max_streak, sourceDays.length, 7), 7),
  );
  const signedToday = progress.signed_today === true;
  const currentCycleDay = asNumber(progress.current_cycle_day, 0);
  const nextCycleDay = asNumber(progress.next_cycle_day, currentCycleDay > 0 ? currentCycleDay : 1);
  const completedDays = asNumber(progress.completed_days, currentCycleDay);
  const currentDay = signedToday ? currentCycleDay : nextCycleDay;
  const boost = asObject(task?.ad_boost);
  const multiplier = Math.max(1, asNumber(boost.multiplier, 1));
  const lastJoin = asObject(detail.last_join);

  const byDay = new Map(sourceDays.map((item) => [asNumber(item?.day, 0), item]));
  return Array.from({ length: maxStreak }, (_, index) => {
    const day = index + 1;
    const source = asObject(byDay.get(day));
    const baseCoin = asNumber(firstValue(source.coin, source.base_coin), 0);
    const coin = baseCoin + asNumber(source.extra_coin, 0);
    const received = source.received === true || day <= completedDays;
    // Prefer progress-derived current day so a stale backend `current` flag
    // (e.g. last completed day while unsigned today) cannot double-highlight.
    const isCurrent = day === currentDay;
    const videoReceived =
      source.video_received === true ||
      (received && !isCurrent) ||
      (isCurrent && lastJoin.boosted === true);
    return {
      ...source,
      day,
      coin,
      video_coin: asNumber(source.video_coin, coin * multiplier),
      current: isCurrent,
      received,
      video_received: videoReceived,
    };
  });
}

function adaptSigninTask(task, pageState) {
  const detail = taskStateDetail(task);
  const chests = asArray(
    firstValue(detail.chests, pageState.checkin_chests, pageState.checkin?.chests),
  );
  return {
    type: "checkin",
    task_id: task.task_id,
    detail: {
      days: adaptSigninDays(task),
      chests,
      state: task.state,
      available_actions: asArray(task.available_actions),
      ...asObject(detail.compat_detail),
    },
  };
}

function adaptWatchAdTask(task) {
  const detail = taskStateDetail(task);
  const progress = taskProgress(task);
  const limits = taskLimits(task);
  const preview = taskRewardPreview(task);
  const todayWatched = asNumber(
    firstValue(progress.join_count_today, detail.today_watched),
    0,
  );
  const dailyLimit = asNumber(
    firstValue(limits.daily_join_limit, detail.daily_limit),
    0,
  );
  const remaining = firstValue(limits.remaining_today, detail.remain_count);
  const rewardCoin = asNumber(firstValue(preview.coin, preview.reward_coin, preview.base_coin), 0);
  const roulette = asObject(firstValue(preview.roulette, detail.roulette));
  // watch_ad is a fixed-reward V2 task. When the backend only publishes the
  // fixed coin preview, repeat that value on the legacy eight-sector wheel so
  // the old H5 never advertises arbitrary placeholder prizes.
  const displayRoulette = Object.keys(roulette).length
    ? roulette
    : rewardCoin > 0
      ? { roulette_coins: Array(8).fill(rewardCoin) }
      : null;
  return {
    type: "video",
    task_id: task.task_id,
    detail: {
      daily_limit: dailyLimit,
      today_watched: todayWatched,
      remain_count: remaining == null ? Math.max(0, dailyLimit - todayWatched) : asNumber(remaining, 0),
      coin: rewardCoin,
      roulette: displayRoulette,
      state: task.state,
      available_actions: asArray(task.available_actions),
      ad_session: v2TaskAdSession(task),
    },
  };
}

function copyOptionalPageField(target, pageState, configData, key) {
  if (Object.prototype.hasOwnProperty.call(pageState, key)) {
    target[key] = pageState[key];
    return;
  }
  if (Object.prototype.hasOwnProperty.call(configData, key)) {
    target[key] = configData[key];
  }
}

/** Convert Activity V2 /config data into the shape consumed by the existing page business layer. */
export function adaptV2ConfigToActivityInfo(configData = {}) {
  const data = asObject(configData);
  const user = asObject(data.user);
  const pageState = asObject(firstValue(data.page_state, data.page_runtime));
  const tasks = [];
  const runtimeTasks = data.task_state_available === false
    ? []
    : asArray(data.tasks).filter(isUsableV2TaskState);
  const taskByType = v2TasksByType({ tasks: runtimeTasks });

  for (const task of runtimeTasks) {
    switch (String(task?.task_type || "").trim()) {
      case "signin":
        tasks.push(adaptSigninTask(task, pageState));
        break;
      case "watch_ad":
        tasks.push(adaptWatchAdTask(task));
        break;
      default:
        break;
    }
  }

  const result = {
    user_info: {
      user_id: firstString(user.user_id, data.user_id),
    },
    wallet_info: {
      coin: asNumber(firstValue(user.coin_balance, user.balance, data.coin_balance), 0),
    },
    tasks,
  };

  for (const key of ["redeem_gap", "redeem_rewards", "recent_redemptions"]) {
    copyOptionalPageField(result, pageState, data, key);
  }

  if (taskByType.has("signin")) {
    copyOptionalPageField(result, pageState, data, "checkin_prompt");
  }
  if (taskByType.has("new_user_bonus")) {
    copyOptionalPageField(result, pageState, data, "new_user_bonus");
  }
  if (taskByType.has("coin_rain")) {
    copyOptionalPageField(result, pageState, data, "coin_rain");
  }

  // These two legacy page blocks are authoritative V2 task states now. Keep an
  // explicitly supplied page_state value when present, but otherwise derive
  // the old page shape from /config.tasks so the existing UI does not need a
  // second /tasks/state request.
  if (!Object.prototype.hasOwnProperty.call(result, "new_user_bonus")) {
    const bonus = taskStateDetail(taskByType.get("new_user_bonus")).new_user_bonus;
    if (bonus && typeof bonus === "object") result.new_user_bonus = bonus;
  }
  if (!Object.prototype.hasOwnProperty.call(result, "coin_rain")) {
    const coinRain = taskStateDetail(taskByType.get("coin_rain")).coin_rain;
    if (coinRain && typeof coinRain === "object") result.coin_rain = coinRain;
  }
  return result;
}

export function normalizeV2PrizeList(data) {
  if (Array.isArray(data)) return data;
  return asArray(data?.prizes);
}

function prizeProviderCode(prize) {
  return firstString(prize.provider_code, prize.operator_code, prize.provider_name, "unknown");
}

function prizeProviderName(prize) {
  return firstString(prize.provider_name, prize.operator_name, prizeProviderCode(prize));
}

export function adaptV2PrizesToCharges(data, params = {}) {
  const groups = new Map();
  for (const prize of normalizeV2PrizeList(data)) {
    if (normalizeProviderType(prize?.provider_type) !== "dingconnect") continue;
    const code = prizeProviderCode(prize);
    if (!groups.has(code)) {
      groups.set(code, {
        provider_code: code,
        provider_name: prizeProviderName(prize),
        logo_url: firstString(prize.provider_logo, prize.cover_image),
        products: [],
      });
    }
    const faceValue = asNumber(firstValue(prize.receive_value, prize.face_value), 0);
    const currency = firstString(prize.receive_currency, prize.currency);
    groups.get(code).products.push({
      available: true,
      prize_id: firstString(prize.prize_id),
      sku_code: firstString(prize.prize_id),
      provider_product_id: firstString(prize.provider_product_id),
      provider_code: code,
      provider_name: prizeProviderName(prize),
      product_type: normalizePrizeType(firstValue(prize.product_type, prize.prize_type)),
      display_text: firstString(prize.display_text, prize.prize_name),
      validity_period: firstString(prize.validity_period),
      send_value: firstValue(prize.send_value, faceValue),
      receive_value: faceValue,
      receive_currency: currency,
      spend_coin: asNumber(prize.coin_cost, 0),
      country_code: firstString(prize.country_iso, params.country_code),
    });
  }
  return { providers: [...groups.values()] };
}

export function adaptV2PrizesToTremendous(data, params = {}) {
  const groups = new Map();
  const requestedCurrency = firstString(params.currency_code).toUpperCase();
  for (const prize of normalizeV2PrizeList(data)) {
    if (normalizeProviderType(prize?.provider_type) !== "tremendous") continue;
    const prizeCurrency = firstString(prize.currency).toUpperCase();
    if (requestedCurrency && prizeCurrency && prizeCurrency !== requestedCurrency) continue;
    const productId = firstString(prize.provider_product_id, prize.prize_id);
    if (!productId) continue;
    if (!groups.has(productId)) {
      groups.set(productId, {
        product_id: productId,
        product_name: firstString(prize.prize_name, productId),
        logo_url: firstString(prize.cover_image),
        denominations: [],
      });
    }
    groups.get(productId).denominations.push({
      prize_id: firstString(prize.prize_id),
      denomination: asNumber(prize.face_value, 0),
      spend_coin: asNumber(prize.coin_cost, 0),
    });
  }
  for (const product of groups.values()) {
    product.denominations.sort((a, b) => a.denomination - b.denomination);
  }
  return {
    country_code: firstString(data?.country_iso, params.country_code),
    currency_code: firstString(data?.currency, params.currency_code),
    products: [...groups.values()],
  };
}

export function normalizeV2RedeemStatus(value) {
  const status = String(value || "pending").trim().toLowerCase();
  if (status === "success") return "success";
  if (FAILED_REDEEM_STATUSES.has(status)) return "failed";
  return status === "processing" ? "processing" : "pending";
}

function recipientValue(order, ...keys) {
  const recipient = asObject(firstValue(order.recipient_summary, order.recipient_info));
  return firstString(...keys.map((key) => firstValue(order[key], recipient[key])));
}

export function adaptV2RedeemOrder(order = {}) {
  const providerType = normalizeProviderType(firstValue(order.provider_type, order.provider_name));
  const faceValue = asNumber(
    firstValue(order.face_value, order.prize_face_value, order.denomination, order.receive_value),
    0,
  );
  const currency = firstString(
    order.currency,
    order.prize_currency,
    order.currency_code,
    order.receive_currency,
  );
  const orderId = firstString(order.order_id, order.business_id, order.distributor_ref);
  return {
    ...order,
    order_id: orderId,
    business_id: orderId,
    distributor_ref: orderId,
    prize_id: firstString(order.prize_id),
    sku_code: firstString(order.provider_product_id, order.prize_id),
    provider_type: providerType,
    provider_name: firstString(order.provider_name, order.provider_code, providerType),
    provider_code: firstString(order.provider_code, order.provider_name, providerType),
    display_text: firstString(order.display_text, order.prize_name),
    cover_image: firstString(order.cover_image, order.prize_cover_image),
    denomination: faceValue,
    receive_value: faceValue,
    send_value: firstValue(order.send_value, faceValue),
    currency_code: currency,
    receive_currency: currency,
    coin_cost: asNumber(order.coin_cost, 0),
    phone_number: recipientValue(order, "phone_number", "masked_phone", "account_number"),
    recipient_email: recipientValue(order, "recipient_email", "masked_email", "email"),
    status: normalizeV2RedeemStatus(order.status),
    processing_state: normalizeV2RedeemStatus(order.status),
    failure_reason_code: firstString(order.failure_reason_code, order.fail_reason_code),
    refunded_coin: asNumber(order.refunded_coin, 0),
  };
}

export function adaptV2RedeemOrders(data) {
  const rows = Array.isArray(data) ? data : asArray(firstValue(data?.records, data?.items));
  return rows.map(adaptV2RedeemOrder);
}

export function isV2RedeemOrderProvider(order, providerType) {
  return normalizeProviderType(firstValue(order?.provider_type, order?.provider_name)) === providerType;
}
