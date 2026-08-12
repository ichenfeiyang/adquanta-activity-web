import assert from "node:assert/strict";
import test from "node:test";

import {
  attachGiftRedeemRequestId,
  clearGiftRedeemRequestId,
  giftDeliveryFailureMessageKey,
  giftCardRedeemMethods,
  handleGiftRedeemRequestError,
} from "./gift-card-redeem.js";

function createGiftRedeemContext() {
  return {
    giftState: {
      productId: "product_amazon",
      selectedDenomination: {
        prize_id: "prize_amazon_10",
        denomination: 10,
        spend_coin: 1000,
      },
      spendCoin: 1000,
      currencyCode: "USD",
    },
    tremendousInfo: {
      countryCode: "US",
      products: [{ product_id: "product_amazon" }],
    },
    giftExchangeLoading: false,
    retryGiftRequestId: "",
    retryGiftIntentKey: "",
    _appliedGiftCatalogKey: "US:USD",
    userGoldCoins: 2000,
    config: {
      apiOptions: { token: "activity-token" },
      onExchangeFailed() {},
    },
    $: {
      inputGiftRecipientName: { value: "Ada" },
      inputGiftRecipientEmail: { value: "ada@example.com" },
      btnGiftRedeem: null,
      giftAmountGrid: null,
    },
    getTremendousQueryParams: () => ({ country_code: "US", currency_code: "USD" }),
    loadActivityInfo: async () => {},
    loadGiftCatalog: async () => {},
    loadGiftRecords: async () => {},
    pollWalletAfterRedeem: async () => {},
    applyGiftRedeemWallet() {},
    setGiftRedeemBusy() {},
    updateGiftRedeemState() {},
  };
}

async function withGiftRedeemGlobals(mockFetch, run) {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.fetch = mockFetch;
  globalThis.document = { getElementById: () => null };
  globalThis.window = { alert() {} };
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
}

test("gift delivery failure reasons use safe, user-facing message keys", () => {
  assert.equal(
    giftDeliveryFailureMessageKey("delivery_failed", "invalid_email"),
    "redeem.giftDeliveryFailedInvalidEmail",
  );
  assert.equal(
    giftDeliveryFailureMessageKey("delivery_failed", "invalid_domain"),
    "redeem.giftDeliveryFailedInvalidDomain",
  );
  assert.equal(
    giftDeliveryFailureMessageKey("delivery_failed", "mailbox_unavailable"),
    "redeem.giftDeliveryFailedMailboxUnavailable",
  );
  assert.equal(
    giftDeliveryFailureMessageKey("delivery_failed", "provider_internal_detail"),
    "redeem.giftDeliveryFailed",
  );
  assert.equal(giftDeliveryFailureMessageKey("success", ""), "");
  // Order/cancel failures must not reuse delivery-failure copy even if a code leaks.
  assert.equal(giftDeliveryFailureMessageKey("failed", "unknown"), "");
  assert.equal(giftDeliveryFailureMessageKey("failed", "invalid_email"), "");
});

test("gift redeem retries reuse the request id for the same user intent", () => {
  const ctx = { retryGiftRequestId: "", retryGiftIntentKey: "" };
  const payload = {
    prize_id: "prize_amazon_10",
    recipient_name: "Ada",
    recipient_email: "ada@example.com",
    delivery_method: "EMAIL",
  };

  const first = attachGiftRedeemRequestId(ctx, payload);
  const retry = attachGiftRedeemRequestId(ctx, { ...payload });

  assert.ok(first.client_request_id);
  assert.equal(retry.client_request_id, first.client_request_id);
});

test("gift redeem creates a new request id for a new or completed intent", () => {
  const ctx = { retryGiftRequestId: "", retryGiftIntentKey: "" };
  const payload = {
    prize_id: "prize_amazon_10",
    recipient_name: "Ada",
    recipient_email: "ada@example.com",
    delivery_method: "EMAIL",
  };

  const first = attachGiftRedeemRequestId(ctx, payload);
  const changed = attachGiftRedeemRequestId(ctx, {
    ...payload,
    recipient_email: "grace@example.com",
  });
  assert.notEqual(changed.client_request_id, first.client_request_id);

  clearGiftRedeemRequestId(ctx);
  const afterCompletion = attachGiftRedeemRequestId(ctx, payload);
  assert.notEqual(afterCompletion.client_request_id, first.client_request_id);
});

test("gift redeem keeps the request id only while the server outcome is unknown", () => {
  const payload = {
    prize_id: "prize_amazon_10",
    recipient_name: "Ada",
    recipient_email: "ada@example.com",
    delivery_method: "EMAIL",
  };
  const networkCtx = { retryGiftRequestId: "", retryGiftIntentKey: "" };
  const first = attachGiftRedeemRequestId(networkCtx, payload);

  assert.equal(handleGiftRedeemRequestError(networkCtx, new TypeError("Failed to fetch")), true);
  assert.equal(
    attachGiftRedeemRequestId(networkCtx, payload).client_request_id,
    first.client_request_id,
  );

  const timeout = new Error("The request timed out");
  timeout.name = "AbortError";
  assert.equal(handleGiftRedeemRequestError(networkCtx, timeout), true);
  assert.equal(networkCtx.retryGiftRequestId, first.client_request_id);

  assert.equal(handleGiftRedeemRequestError(networkCtx, new Error("recipient email is invalid")), false);
  const afterRejection = attachGiftRedeemRequestId(networkCtx, payload);
  assert.notEqual(afterRejection.client_request_id, first.client_request_id);
});

test("gift redeem reuses the same request id after timeout and clears it after success", async () => {
  const requests = [];
  let attempt = 0;
  await withGiftRedeemGlobals(async (_url, init) => {
    requests.push(JSON.parse(init.body));
    attempt += 1;
    if (attempt === 1) {
      const timeout = new Error("The request timed out");
      timeout.name = "AbortError";
      throw timeout;
    }
    return new Response(JSON.stringify({
      code: 200,
      data: {
        order_id: "order-1",
        prize_id: "prize_amazon_10",
        provider_type: "tremendous",
        coin_cost: 1000,
        status: "pending",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }, async () => {
    const ctx = createGiftRedeemContext();
    await giftCardRedeemMethods.performGiftRedeem.call(ctx);
    assert.ok(ctx.retryGiftRequestId);

    await giftCardRedeemMethods.performGiftRedeem.call(ctx);

    assert.equal(requests.length, 2);
    assert.equal(requests[1].idempotent_key, requests[0].idempotent_key);
    assert.equal(ctx.retryGiftRequestId, "");
  });
});

test("gift redeem clears the request id after an explicit HTTP rejection", async () => {
  const requestIds = [];
  await withGiftRedeemGlobals(async (_url, init) => {
    requestIds.push(JSON.parse(init.body).idempotent_key);
    return new Response(JSON.stringify({ error: { message: "recipient email is invalid" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }, async () => {
    const ctx = createGiftRedeemContext();
    await giftCardRedeemMethods.performGiftRedeem.call(ctx);
    assert.equal(ctx.retryGiftRequestId, "");

    await giftCardRedeemMethods.performGiftRedeem.call(ctx);

    assert.equal(requestIds.length, 2);
    assert.notEqual(requestIds[1], requestIds[0]);
  });
});
