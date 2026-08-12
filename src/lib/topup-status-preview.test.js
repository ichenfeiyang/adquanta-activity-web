import test from "node:test";
import assert from "node:assert/strict";
import {
  __resetTopupStatusPreviewForTests,
  extractTopupStatusFromApi,
  getTopupStatusPreview,
  mergeTopupStatusDetails,
  resolveTopupStatusDetails,
  saveTopupStatusPreview,
} from "./topup-status-preview.js";

if (typeof globalThis.sessionStorage === "undefined") {
  const values = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: (key) => values.delete(String(key)),
    clear: () => values.clear(),
  };
}

test("saveTopupStatusPreview stores preview by distributor ref", () => {
  __resetTopupStatusPreviewForTests();
  saveTopupStatusPreview("order-123", {
    phone_number: "6281234567890",
    operator: "Telkomsel",
    amount_label: "10 IDR",
  });

  const preview = getTopupStatusPreview("order-123");
  assert.equal(preview?.phone_number, "6281234567890");
  assert.equal(preview?.operator, "Telkomsel");
  assert.equal(preview?.amount_label, "10 IDR");
  __resetTopupStatusPreviewForTests();
});

test("resolveTopupStatusDetails finds preview by distributor_ref when business_id differs", () => {
  __resetTopupStatusPreviewForTests();
  saveTopupStatusPreview("dist-456", {
    phone_number: "918801384326",
    operator: "Airtel",
    amount_label: "10 INR",
  });

  const details = resolveTopupStatusDetails("dist-456", () => "", "biz-123");
  assert.equal(details.phoneNumber, "918801384326");
  assert.equal(details.operator, "Airtel");
  assert.equal(details.amountLabel, "10 INR");
  __resetTopupStatusPreviewForTests();
});

test("resolveTopupStatusDetails falls back to alternate lookup ref", () => {
  __resetTopupStatusPreviewForTests();
  saveTopupStatusPreview("dist-456", {
    phone_number: "6281234567890",
    operator: "Telkomsel",
    amount_label: "10 IDR",
  });

  const details = resolveTopupStatusDetails("biz-123", () => "", "dist-456");
  assert.equal(details.phoneNumber, "6281234567890");
  assert.equal(details.operator, "Telkomsel");
  assert.equal(details.amountLabel, "10 IDR");
  __resetTopupStatusPreviewForTests();
});

test("resolveTopupStatusDetails prefers preview over query", () => {
  __resetTopupStatusPreviewForTests();
  saveTopupStatusPreview("order-456", {
    phone_number: "639171234567",
    operator: "Globe",
    amount_label: "50 PHP",
  });

  const details = resolveTopupStatusDetails("order-456", () => "918801384326");
  assert.equal(details.phoneNumber, "639171234567");
  assert.equal(details.operator, "Globe");
  assert.equal(details.amountLabel, "50 PHP");
  __resetTopupStatusPreviewForTests();
});

test("resolveTopupStatusDetails keeps zero send_value from preview", () => {
  __resetTopupStatusPreviewForTests();
  saveTopupStatusPreview("order-zero", {
    send_value: "0",
    amount_label: "",
  });

  const details = resolveTopupStatusDetails("order-zero", () => "99");
  assert.equal(details.amountLabel, "99");
  __resetTopupStatusPreviewForTests();
});

test("mergeTopupStatusDetails fills missing local fields from api", () => {
  const merged = mergeTopupStatusDetails(
    { amountLabel: "-", phoneNumber: "", operator: "-" },
    {
      phone_number: "6281234567890",
      operator: "Telkomsel",
      amount_label: "10 IDR",
      status: "success",
    },
  );

  assert.equal(merged.phoneNumber, "6281234567890");
  assert.equal(merged.operator, "Telkomsel");
  assert.equal(merged.amountLabel, "10 IDR");
});

test("extractTopupStatusFromApi maps common response fields", () => {
  const extracted = extractTopupStatusFromApi({
    status: "pending",
    phone_number: "918801384326",
    provider_name: "Airtel",
    receive_value: "10",
    receive_currency: "INR",
  });

  assert.equal(extracted?.status, "pending");
  assert.equal(extracted?.phone_number, "918801384326");
  assert.equal(extracted?.operator, "Airtel");
  assert.equal(extracted?.amount_label, "10 INR");
});

test("saveTopupStatusPreview prunes expired entries", () => {
  __resetTopupStatusPreviewForTests();
  const storeKey = "topup_status_preview_v1";
  sessionStorage.setItem(
    storeKey,
    JSON.stringify({
      stale: {
        phone_number: "620000000000",
        operator: "Old",
        amount_label: "1 IDR",
        send_value: "1",
        storedAt: Date.now() - 31 * 60_000,
      },
    }),
  );

  saveTopupStatusPreview("fresh-order", {
    phone_number: "6281234567890",
    operator: "Telkomsel",
    amount_label: "10 IDR",
  });

  const raw = JSON.parse(sessionStorage.getItem(storeKey) || "{}");
  assert.equal(raw.stale, undefined);
  assert.equal(raw["fresh-order"]?.phone_number, "6281234567890");
  __resetTopupStatusPreviewForTests();
});
