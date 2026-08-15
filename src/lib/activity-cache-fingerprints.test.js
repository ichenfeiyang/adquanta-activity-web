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

test("fingerprintCharges tracks data product display fields", () => {
  const first = {
    providers: [
      {
        provider_code: "JIO",
        products: [
          {
            sku_code: "sku-data",
            receive_value: 399,
            receive_currency: "INR",
            spend_coin: 120,
            send_value: 4.15,
            available: true,
            product_type: "data",
            display_text: "INR 399: 2.5GB/Day",
            validity_period: "P28D",
          },
        ],
      },
    ],
  };
  const second = {
    providers: [
      {
        provider_code: "JIO",
        products: [
          {
            sku_code: "sku-data",
            receive_value: 399,
            receive_currency: "INR",
            spend_coin: 120,
            send_value: 4.15,
            available: true,
            product_type: "data",
            display_text: "INR 399: 2.5GB/Day Updated",
            validity_period: "P28D",
          },
        ],
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

test("fingerprintChargeRecords tracks recharge failure reasons", () => {
  const first = { records: [{ business_id: "a1", status: "failed", amount: 10 }] };
  const second = {
    records: [{ business_id: "a1", status: "failed", amount: 10, failure_reason_code: "invalid_phone_number" }],
  };

  assert.notEqual(fingerprintChargeRecords(first), fingerprintChargeRecords(second));
});
