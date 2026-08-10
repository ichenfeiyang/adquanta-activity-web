import test from "node:test";
import assert from "node:assert/strict";

if (typeof globalThis.sessionStorage === "undefined") {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

import {
  __resetRedeemCountryStorageForTests,
  DEFAULT_REDEEM_COUNTRY,
  findSupportedRedeemCountry,
  formatPhoneDisplay,
  formatRedeemDenomination,
  getGiftCurrenciesForCountry,
  getInitialGiftCurrencyForCountry,
  getInitialRedeemCountry,
  getRedeemCurrencyForCountry,
  getSavedRedeemCountry,
  getSavedRedeemCountryIso,
  resolveRedeemCountry,
  saveRedeemCountry,
} from "./redeem-country.js";

test("resolveRedeemCountry maps supported ISO codes", () => {
  assert.equal(resolveRedeemCountry("ID").dialCode, "+62");
  assert.equal(resolveRedeemCountry("PH").iso, "PH");
  assert.equal(resolveRedeemCountry("IN").dialCode, "+91");
  assert.equal(resolveRedeemCountry("US").dialCode, "+1");
  assert.equal(resolveRedeemCountry("CA").dialCode, "+1");
  assert.equal(resolveRedeemCountry("PK").dialCode, "+92");
  assert.equal(resolveRedeemCountry("BD").dialCode, "+880");
  assert.equal(resolveRedeemCountry("NP").dialCode, "+977");
});

test("redeem countries keep English name fallback and i18n nameKey", () => {
  assert.equal(resolveRedeemCountry("IN").name, "India");
  assert.equal(resolveRedeemCountry("IN").nameKey, "redeem.countryIN");
  assert.equal(resolveRedeemCountry("PK").nameKey, "redeem.countryPK");
});

test("resolveRedeemCountry falls back to India", () => {
  assert.equal(resolveRedeemCountry("ZZ"), DEFAULT_REDEEM_COUNTRY);
  assert.equal(resolveRedeemCountry(""), DEFAULT_REDEEM_COUNTRY);
});

test("formatPhoneDisplay formats known country prefixes", () => {
  assert.equal(formatPhoneDisplay("6281234567890"), "+62 81234567890");
  assert.equal(formatPhoneDisplay("639171234567"), "+63 9171234567");
  assert.equal(formatPhoneDisplay("918801384326"), "+91 8801384326");
  assert.equal(formatPhoneDisplay("923001234567"), "+92 3001234567");
  assert.equal(formatPhoneDisplay("8801712345678"), "+880 1712345678");
  assert.equal(formatPhoneDisplay("9779812345678"), "+977 9812345678");
  assert.equal(formatPhoneDisplay("14165551234"), "+1 4165551234");
});

test("getInitialRedeemCountry defaults to India", () => {
  __resetRedeemCountryStorageForTests();
  assert.equal(getInitialRedeemCountry(), DEFAULT_REDEEM_COUNTRY);
  assert.equal(getSavedRedeemCountry(), null);
});

test("saveRedeemCountry persists user selection", () => {
  __resetRedeemCountryStorageForTests();
  saveRedeemCountry("ID");
  assert.equal(getSavedRedeemCountry()?.iso, "ID");
  assert.equal(getSavedRedeemCountryIso(), "ID");
  assert.equal(getInitialRedeemCountry().iso, "ID");
  __resetRedeemCountryStorageForTests();
});

test("saved redeem country helpers never invent India for unknown codes", () => {
  __resetRedeemCountryStorageForTests();
  assert.equal(findSupportedRedeemCountry("ZZ"), null);
  assert.equal(getSavedRedeemCountry(), null);
  assert.equal(getSavedRedeemCountryIso(), "");
  assert.equal(getInitialRedeemCountry(), DEFAULT_REDEEM_COUNTRY);
});

test("getRedeemCurrencyForCountry maps ISO to Tremendous currency", () => {
  assert.equal(getRedeemCurrencyForCountry("IN").code, "INR");
  assert.equal(getRedeemCurrencyForCountry("ID").code, "IDR");
  assert.equal(getRedeemCurrencyForCountry("US").code, "USD");
  assert.equal(getRedeemCurrencyForCountry("CA").code, "CAD");
  assert.equal(getRedeemCurrencyForCountry("XX").code, "INR");
});

test("gift card currencies provide the local currency and USD for each activity country", () => {
  assert.deepEqual(getGiftCurrenciesForCountry("IN").map((item) => item.code), ["INR", "USD"]);
  assert.deepEqual(getGiftCurrenciesForCountry("PK").map((item) => item.code), ["USD", "PKR"]);
  assert.deepEqual(getGiftCurrenciesForCountry("US").map((item) => item.code), ["USD"]);
  assert.deepEqual(getGiftCurrenciesForCountry("CA").map((item) => item.code), ["CAD", "USD"]);
  assert.equal(getInitialGiftCurrencyForCountry("PK").code, "USD");
  assert.equal(getInitialGiftCurrencyForCountry("CA").code, "CAD");
});

test("formatRedeemDenomination formats currency labels", () => {
  assert.equal(formatRedeemDenomination(100, "INR"), "₹100");
  assert.equal(formatRedeemDenomination(250000, "IDR"), "Rp250,000");
  assert.equal(formatRedeemDenomination(10.5, "USD"), "$10.50");
  assert.equal(formatRedeemDenomination(10.5, "CAD"), "C$10.50");
});
