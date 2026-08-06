import assert from "node:assert/strict";
import test from "node:test";

import { giftDeliveryFailureMessageKey } from "./gift-card-redeem.js";

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
