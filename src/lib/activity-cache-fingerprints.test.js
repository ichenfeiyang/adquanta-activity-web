import assert from "node:assert/strict";
import test from "node:test";
import {
  fingerprintChargeRecords,
  fingerprintCharges,
} from "./activity-cache-fingerprints.js";

test("fingerprintCharges tracks provider products", () => {
  const first = {
    providers: [
      {
        provider_code: "AIRTEL",
        products: [{ sku_code: "sku1", receive_value: 100, spend_coin: 500, available: true }],
      },
    ],
  };
  const second = {
    providers: [
      {
        provider_code: "AIRTEL",
        products: [{ sku_code: "sku1", receive_value: 100, spend_coin: 600, available: true }],
      },
    ],
  };

  assert.notEqual(fingerprintCharges(first), fingerprintCharges(second));
});

test("fingerprintChargeRecords supports list payloads", () => {
  const first = { list: [{ business_id: "a1", status: "pending", amount: 10 }] };
  const second = { list: [{ business_id: "a1", status: "success", amount: 10 }] };

  assert.notEqual(fingerprintChargeRecords(first), fingerprintChargeRecords(second));
});

test("fingerprintChargeRecords supports records payloads", () => {
  const payload = {
    records: [{ business_id: "a1", status: "pending", amount: 10 }],
  };

  assert.match(fingerprintChargeRecords(payload), /a1:pending:10/);
});
