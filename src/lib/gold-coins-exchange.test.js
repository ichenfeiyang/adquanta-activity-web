import assert from "node:assert/strict";
import test from "node:test";

import {
  attachChargeRedeemRequestId,
  clearChargeRedeemRequestId,
  GoldCoinsExchange,
  handleChargeRedeemRequestError,
  isChargeRedeemOutcomeUnknown,
} from "./gold-coins-exchange.js";

const TOPUP_PAYLOAD = {
  prize_id: "prize-airtel-100",
  sku_code: "airtel-100",
  send_value: 100,
  phone_number: "919876543210",
};

function createRequestContext() {
  return { retryChargeRequestId: "", retryChargeIntentKey: "" };
}

function createExchangeContext(overrides = {}) {
  const failures = [];
  const pending = [];
  return {
    exchangeLoading: false,
    lastSubmitAt: 0,
    submitDebounceMs: 0,
    userGoldCoins: 2000,
    retryChargeRequestId: "",
    retryChargeIntentKey: "",
    chargesLoaded: true,
    lastChargesMobile: "IN:9876543210",
    state: {
      mobile: "9876543210",
      countryCode: "+91",
      countryCodeEnum: "IN",
      operator: "Airtel",
      amount: 100,
      selectedCharge: {
        charges_id: "airtel-100",
        prize_id: "prize-airtel-100",
        send_value: 100,
      },
    },
    config: {
      apiOptions: { token: "activity-token" },
      onExchangeFailed: (message) => failures.push(message),
      onExchangePending: (message) => pending.push(message),
    },
    $: { btnRedeem: null },
    failures,
    pending,
    buildRedeemProduct: () => ({ points: 100 }),
    getFullPhoneNumber: () => TOPUP_PAYLOAD.phone_number,
    getChargesLookupKey: () => "IN:9876543210",
    isChargesLookupCurrent: () => true,
    loadCharges: async () => {},
    loadActivityInfo: async () => {},
    loadRecords: async () => {},
    pollWalletAfterRedeem: async () => {},
    openTopupStatusPage: async () => {},
    updateRedeemState() {},
    ...overrides,
  };
}

async function withMockFetch(mockFetch, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("top-up retries reuse the request id only for the same redeem intent", () => {
  const ctx = createRequestContext();
  const first = attachChargeRedeemRequestId(ctx, TOPUP_PAYLOAD, "token-a");
  const retry = attachChargeRedeemRequestId(ctx, { ...TOPUP_PAYLOAD }, "token-a");

  assert.ok(first.client_request_id);
  assert.equal(retry.client_request_id, first.client_request_id);

  for (const changed of [
    [{ ...TOPUP_PAYLOAD }, "token-b"],
    [{ ...TOPUP_PAYLOAD, prize_id: "prize-airtel-200" }, "token-a"],
    [{ ...TOPUP_PAYLOAD, phone_number: "919999999999" }, "token-a"],
    [{ ...TOPUP_PAYLOAD, send_value: 200 }, "token-a"],
  ]) {
    const changedCtx = createRequestContext();
    const before = attachChargeRedeemRequestId(changedCtx, TOPUP_PAYLOAD, "token-a");
    const after = attachChargeRedeemRequestId(changedCtx, changed[0], changed[1]);
    assert.notEqual(after.client_request_id, before.client_request_id);
  }
});

test("top-up keeps the request id for every unknown network outcome", () => {
  const errors = [
    Object.assign(new Error("request aborted"), { name: "AbortError" }),
    new TypeError("connection reset"),
    Object.assign(new Error("transport unavailable"), { name: "NetworkError" }),
    new Error("Failed to fetch"),
  ];

  for (const error of errors) {
    const ctx = createRequestContext();
    const first = attachChargeRedeemRequestId(ctx, TOPUP_PAYLOAD, "token-a");
    assert.equal(isChargeRedeemOutcomeUnknown(error), true);
    assert.equal(handleChargeRedeemRequestError(ctx, error), true);
    assert.equal(
      attachChargeRedeemRequestId(ctx, TOPUP_PAYLOAD, "token-a").client_request_id,
      first.client_request_id,
    );
  }
});

test("top-up clears the request id after an explicit rejection or completion", () => {
  const ctx = createRequestContext();
  const first = attachChargeRedeemRequestId(ctx, TOPUP_PAYLOAD, "token-a");

  assert.equal(handleChargeRedeemRequestError(ctx, new Error("HTTP 400")), false);
  const afterRejection = attachChargeRedeemRequestId(ctx, TOPUP_PAYLOAD, "token-a");
  assert.notEqual(afterRejection.client_request_id, first.client_request_id);

  clearChargeRedeemRequestId(ctx);
  const afterCompletion = attachChargeRedeemRequestId(ctx, TOPUP_PAYLOAD, "token-a");
  assert.notEqual(afterCompletion.client_request_id, afterRejection.client_request_id);
});

test("top-up reuses an unknown request id and clears it after success", async () => {
  const requestIds = [];
  let attempt = 0;
  await withMockFetch(async (_url, init) => {
    requestIds.push(JSON.parse(init.body).idempotent_key);
    attempt += 1;
    if (attempt === 1) {
      throw Object.assign(new Error("request aborted"), { name: "AbortError" });
    }
    return new Response(JSON.stringify({
      code: 200,
      data: {
        order_id: "ding-order-1",
        provider_type: "dingconnect",
        coin_cost: 100,
        status: "pending",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }, async () => {
    const ctx = createExchangeContext();
    await GoldCoinsExchange.prototype.performExchange.call(ctx);
    assert.ok(ctx.retryChargeRequestId);

    await GoldCoinsExchange.prototype.performExchange.call(ctx);

    assert.equal(requestIds.length, 2);
    assert.equal(requestIds[1], requestIds[0]);
    assert.equal(ctx.retryChargeRequestId, "");
    assert.equal(ctx.retryChargeIntentKey, "");
  });
});

test("top-up uses a new request id after explicit HTTP or business rejection", async () => {
  for (const responseFactory of [
    () => new Response(JSON.stringify({ error: { message: "invalid recipient" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }),
    () => new Response(JSON.stringify({ code: 400, message: "prize unavailable" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ]) {
    const requestIds = [];
    await withMockFetch(async (_url, init) => {
      requestIds.push(JSON.parse(init.body).idempotent_key);
      return responseFactory();
    }, async () => {
      const ctx = createExchangeContext();
      await GoldCoinsExchange.prototype.performExchange.call(ctx);
      assert.equal(ctx.retryChargeRequestId, "");

      await GoldCoinsExchange.prototype.performExchange.call(ctx);
      assert.equal(requestIds.length, 2);
      assert.notEqual(requestIds[1], requestIds[0]);
    });
  }
});
