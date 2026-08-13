import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptV2ConfigToActivityInfo,
  adaptV2PrizesToCharges,
  adaptV2PrizesToTremendous,
  adaptV2RedeemOrder,
  isV2RedeemOrderProvider,
} from "./activity-v2-adapter.js";

test("V2 config keeps user identity and opaque check-in chest ids for the legacy page", () => {
  const result = adaptV2ConfigToActivityInfo({
    user: { user_id: "user_v2", coin_balance: 321 },
    tasks: [{
      task_id: "task_signin_real",
      task_type: "signin",
      state: "completed",
      available_actions: ["chest_claim"],
      state_detail: {
        progress: { max_streak: 7, current_cycle_day: 3, completed_days: 3, signed_today: true },
        days: [{ day: 3, coin: 30, received: true, current: true }],
        chests: [{ id: "chest_abcd", continuous_day: 3, status: "pending" }],
      },
    }],
  });

  assert.equal(result.user_info.user_id, "user_v2");
  assert.equal(result.wallet_info.coin, 321);
  assert.equal(result.tasks[0].task_id, "task_signin_real");
  assert.equal(result.tasks[0].detail.continuous_days, 3);
  assert.equal(result.tasks[0].detail.days[2].received, true);
  assert.equal(result.tasks[0].detail.days[2].current, true);
  assert.equal(result.tasks[0].detail.chests[0].id, "chest_abcd");
});

test("V2 signin adapter exposes today's completed cycle day to the legacy card", () => {
  const result = adaptV2ConfigToActivityInfo({
    tasks: [{
      task_id: "task_signin",
      task_type: "signin",
      state: "boost_available",
      available_actions: ["boost"],
      state_detail: {
        progress: {
          max_streak: 7,
          current_cycle_day: 1,
          next_cycle_day: 2,
          completed_days: 1,
          signed_today: true,
        },
        days: [
          { day: 1, coin: 35, video_coin: 70, received: true, current: true },
        ],
      },
    }],
  });

  const checkin = result.tasks[0].detail;
  assert.equal(checkin.continuous_days, 1);
  assert.equal(checkin.days[0].received, true);
  assert.equal(checkin.days[0].current, true);
});

test("V2 signin adapter highlights next cycle day when today is unsigned", () => {
  const result = adaptV2ConfigToActivityInfo({
    user: { user_id: "user_v2", coin_balance: 10 },
    tasks: [{
      task_id: "task_signin",
      task_type: "signin",
      state: "available",
      available_actions: ["join"],
      state_detail: {
        progress: {
          max_streak: 7,
          current_cycle_day: 3,
          next_cycle_day: 4,
          completed_days: 3,
          signed_today: false,
        },
        // Stale backend current on day 3 must not win over next_cycle_day.
        days: [
          { day: 3, coin: 30, received: true, current: true },
          { day: 4, coin: 40, received: false, current: false },
        ],
      },
    }],
  });

  const days = result.tasks[0].detail.days;
  assert.equal(days.find((day) => day.day === 3)?.current, false);
  assert.equal(days.find((day) => day.day === 4)?.current, true);
});

test("V2 config hides executable tasks when the task-state service is unavailable", () => {
  const result = adaptV2ConfigToActivityInfo({
    task_state_available: false,
    user: { user_id: "user_degraded", coin_balance: 456 },
    tasks: [
      { task_id: "signin", task_type: "signin", state: "available", available_actions: ["join"] },
      { task_id: "watch", task_type: "watch_ad", state: "available", available_actions: ["prepare"] },
      { task_id: "bonus", task_type: "new_user_bonus", state: "available", available_actions: ["claim_base"] },
    ],
    page_state: {
      new_user_bonus: { eligible: true, show: true },
      redeem_rewards: { enabled: true, items: [{ type: "topup", min_coin: 100 }] },
      recent_redemptions: [{ order_id: "order_1" }],
    },
  });

  assert.deepEqual(result.tasks, []);
  assert.equal(result.user_info.user_id, "user_degraded");
  assert.equal(result.wallet_info.coin, 456);
  assert.equal(Object.hasOwn(result, "new_user_bonus"), false);
  assert.equal(result.redeem_rewards.enabled, true);
  assert.equal(result.recent_redemptions[0].order_id, "order_1");
});

test("V2 config skips unavailable task states but keeps completed and pending-ad progress", () => {
  const result = adaptV2ConfigToActivityInfo({
    task_state_available: true,
    tasks: [
      { task_id: "signin_bad", task_type: "signin", state: "unavailable", available_actions: [] },
      { task_id: "watch_bad", task_type: "watch_ad", state: "unsupported", available_actions: [] },
      { task_id: "signin_done", task_type: "signin", state: "completed", available_actions: [] },
      {
        task_id: "watch_pending",
        task_type: "watch_ad",
        state: "pending_ad",
        available_actions: ["client_complete"],
        state_detail: { ad_session: { session_id: "adsess_1", status: "pending_ad" } },
      },
    ],
  });

  assert.deepEqual(result.tasks.map((task) => task.task_id), ["signin_done", "watch_pending"]);
});

test("fixed watch-ad reward preview replaces legacy placeholder wheel prizes", () => {
  const result = adaptV2ConfigToActivityInfo({
    tasks: [{
      task_id: "watch_fixed",
      task_type: "watch_ad",
      state: "available",
      available_actions: ["prepare"],
      reward_preview: { coin: 12 },
      state_detail: {
        progress: { join_count_today: 1 },
        limits: { daily_join_limit: 3, remaining_today: 2 },
      },
    }],
  });

  const detail = result.tasks[0].detail;
  assert.equal(detail.coin, 12);
  assert.deepEqual(detail.roulette.roulette_coins, Array(8).fill(12));
});

test("Ding prize catalog exposes the operator and product fields required by the old UI", () => {
  const result = adaptV2PrizesToCharges({ prizes: [{
    prize_id: "prize_ding_1",
    provider_type: "dingconnect",
    provider_code: "JIO",
    provider_name: "Jio",
    provider_logo: "https://cdn.example/jio.png",
    provider_product_id: "sku_1",
    product_type: "data",
    display_text: "1 GB",
    validity_period: "1 day",
    send_value: 10,
    receive_value: 1,
    receive_currency: "GB",
    coin_cost: 100,
    country_iso: "IN",
  }] }, { country_code: "IN" });

  assert.deepEqual(result.providers[0], {
    provider_code: "JIO",
    provider_name: "Jio",
    logo_url: "https://cdn.example/jio.png",
    products: [{
      available: true,
      prize_id: "prize_ding_1",
      sku_code: "prize_ding_1",
      provider_product_id: "sku_1",
      provider_code: "JIO",
      provider_name: "Jio",
      product_type: "data",
      display_text: "1 GB",
      validity_period: "1 day",
      send_value: 10,
      receive_value: 1,
      receive_currency: "GB",
      spend_coin: 100,
      country_code: "IN",
    }],
  });
});

test("Tremendous denominations retain the V2 prize id used to submit redemption", () => {
  const result = adaptV2PrizesToTremendous({ prizes: [{
    prize_id: "prize_gift_10",
    provider_type: "tremendous",
    provider_product_id: "product_amazon",
    prize_name: "Amazon",
    face_value: 10,
    currency: "USD",
    coin_cost: 1000,
  }] }, { country_code: "US", currency_code: "USD" });

  assert.equal(result.products[0].denominations[0].prize_id, "prize_gift_10");
});

test("redeem order adapter keeps provider, prize snapshot and masked recipient fields", () => {
  const result = adaptV2RedeemOrder({
    order_id: "ord_1",
    prize_id: "prize_ding_1",
    prize_name: "Jio 1 GB",
    prize_face_value: 1,
    prize_currency: "GB",
    prize_cover_image: "https://cdn.example/prize.png",
    provider_type: "dingconnect",
    provider_name: "dingconnect",
    provider_code: "JIO",
    provider_product_id: "sku_1",
    recipient_summary: { masked_phone: "+91******4326" },
    coin_cost: 100,
    status: "failed_refunded",
    failure_reason_code: "provider_rejected",
    refunded_coin: 100,
  });

  assert.equal(isV2RedeemOrderProvider(result, "dingconnect"), true);
  assert.equal(result.sku_code, "sku_1");
  assert.equal(result.provider_code, "JIO");
  assert.equal(result.denomination, 1);
  assert.equal(result.currency_code, "GB");
  assert.equal(result.cover_image, "https://cdn.example/prize.png");
  assert.equal(result.phone_number, "+91******4326");
  assert.equal(result.status, "failed");
  assert.equal(result.failure_reason_code, "provider_rejected");
  assert.equal(result.refunded_coin, 100);
});

test("redeem order adapter treats refund_pending as failed without claiming a refund", () => {
  const result = adaptV2RedeemOrder({
    order_id: "ord_refund_pending",
    status: "refund_pending",
    coin_cost: 100,
    refunded_coin: 0,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.processing_state, "failed");
  assert.equal(result.refunded_coin, 0);
});
