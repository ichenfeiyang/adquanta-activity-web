import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSelectedRedeemSummary,
  formatRedeemProductName,
  formatValidityPeriod,
  getHistoryRecordTitle,
  getRecordAmountLabel,
  getRedeemSummaryLabel,
  hasMixedProductTypes,
  isValidMappedChargeProduct,
  mapChargeProduct,
  normalizeProductType,
  sortChargeProducts,
} from "./charge-product.js";

test("normalizeProductType treats missing and topup as topup", () => {
  assert.equal(normalizeProductType(), "topup");
  assert.equal(normalizeProductType("topup"), "topup");
  assert.equal(normalizeProductType("TOPUP"), "topup");
  assert.equal(normalizeProductType("data"), "data");
});

test("formatValidityPeriod converts ISO 8601 durations", () => {
  assert.equal(formatValidityPeriod("P28D"), "28 days valid");
  assert.equal(formatValidityPeriod("P1D"), "1 day valid");
  assert.equal(formatValidityPeriod("P2W"), "2 weeks valid");
  assert.equal(formatValidityPeriod(""), "");
});

test("mapChargeProduct maps topup products", () => {
  const mapped = mapChargeProduct(
    {
      sku_code: "SKU-T",
      receive_value: 100,
      receive_currency: "USD",
      send_value: 10,
      spend_coin: 80,
      product_type: "topup",
    },
    { provider_name: "Airtel", provider_code: "airtel" },
  );

  assert.equal(mapped.product_type, "topup");
  assert.equal(mapped.amount_text, "100 USD");
  assert.equal(mapped.amount_subtitle, "");
  assert.equal(mapped.charges_id, "SKU-T");
});

test("mapChargeProduct maps data products", () => {
  const mapped = mapChargeProduct({
    sku_code: "SKU-DATA",
    receive_value: 399,
    receive_currency: "INR",
    send_value: 4.15,
    spend_coin: 120,
    product_type: "data",
    display_text: "INR 399: 2.5GB/Day",
    validity_period: "P28D",
  });

  assert.equal(mapped.product_type, "data");
  assert.equal(mapped.amount_text, "INR 399: 2.5GB/Day");
  assert.equal(mapped.amount_subtitle, "28 days valid");
  assert.equal(mapped.display_text, "INR 399: 2.5GB/Day");
});

test("hasMixedProductTypes detects mixed provider catalogs", () => {
  assert.equal(
    hasMixedProductTypes([
      { product_type: "topup" },
      { product_type: "data" },
    ]),
    true,
  );
  assert.equal(hasMixedProductTypes([{ product_type: "topup" }]), false);
  assert.equal(hasMixedProductTypes([{ product_type: "data" }]), false);
});

test("getRedeemSummaryLabel and action verb vary by product type", () => {
  assert.equal(
    getRedeemSummaryLabel({
      product_type: "data",
      display_text: "INR 399: 2.5GB/Day",
      amount_text: "INR 399: 2.5GB/Day",
    }),
    "INR 399: 2.5GB/Day",
  );
  assert.equal(
    buildSelectedRedeemSummary({
      coins: 120,
      product: {
        product_type: "data",
        display_text: "INR 399: 2.5GB/Day",
        amount_text: "INR 399: 2.5GB/Day",
      },
      operator: "Airtel",
      countryCode: "+91",
      mobile: "8801384326",
    }),
    "Use 120 coins to redeem data INR 399: 2.5GB/Day (Airtel) for +91 8801384326",
  );
});

test("isValidMappedChargeProduct accepts data plans without receive_value", () => {
  const mapped = mapChargeProduct({
    sku_code: "SKU-DATA",
    send_value: 4.15,
    spend_coin: 120,
    available: true,
    product_type: "data",
    display_text: "INR 399: 2.5GB/Day",
    validity_period: "P28D",
  });

  assert.equal(isValidMappedChargeProduct(mapped), true);
  assert.equal(mapped.amount, 0);
});

test("isValidMappedChargeProduct rejects topup without positive receive_value", () => {
  const mapped = mapChargeProduct({
    sku_code: "SKU-T",
    send_value: 10,
    spend_coin: 80,
    available: true,
    product_type: "topup",
  });

  assert.equal(isValidMappedChargeProduct(mapped), false);
});

test("sortChargeProducts lists topup before data and keeps amount order within type", () => {
  const sorted = sortChargeProducts([
    { product_type: "data", amount: 399, charges_id: "d1" },
    { product_type: "topup", amount: 100, charges_id: "t2" },
    { product_type: "topup", amount: 50, charges_id: "t1" },
    { product_type: "data", amount: 49, charges_id: "d2" },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.charges_id),
    ["t1", "t2", "d2", "d1"],
  );
});

test("formatRedeemProductName and history title prefer display_text", () => {
  const product = {
    product_type: "data",
    display_text: "INR 399: 2.5GB/Day",
    amount_text: "INR 399: 2.5GB/Day",
  };

  assert.equal(formatRedeemProductName(product), "Data INR 399: 2.5GB/Day");
  assert.equal(
    getHistoryRecordTitle({
      product_type: "data",
      display_text: "INR 399: 2.5GB/Day",
      sku_code: "SKU-DATA",
    }),
    "INR 399: 2.5GB/Day",
  );
  assert.equal(getHistoryRecordTitle({ product_type: "topup", sku_code: "SKU-T" }), "Top-up SKU-T");
});

test("getRecordAmountLabel prefers history fields over mapped zero amounts", () => {
  assert.equal(
    getRecordAmountLabel({
      amount_label: "100 INR",
      sku_code: "SKU-T",
    }),
    "100 INR",
  );
  assert.equal(
    getRecordAmountLabel({
      amount_text: "INR 399: 2.5GB/Day",
      product_type: "data",
      sku_code: "SKU-DATA",
    }),
    "INR 399: 2.5GB/Day",
  );
  assert.equal(
    getRecordAmountLabel({
      sku_code: "SKU-T",
    }),
    "",
  );
  assert.equal(
    getRecordAmountLabel({
      receive_value: 100,
      receive_currency: "INR",
      product_type: "topup",
      sku_code: "SKU-T",
    }),
    "100 INR",
  );
});
