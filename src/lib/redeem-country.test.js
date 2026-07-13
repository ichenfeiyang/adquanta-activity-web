import test from "node:test";
import assert from "node:assert/strict";
import {
  __resetRedeemCountryStorageForTests,
  DEFAULT_REDEEM_COUNTRY,
  formatPhoneDisplay,
  formatRedeemDenomination,
  getInitialRedeemCountry,
  getRedeemCurrencyForCountry,
  getSavedRedeemCountry,
  resolveRedeemCountry,
  saveRedeemCountry,
} from "./redeem-country.js";

test("resolveRedeemCountry maps supported ISO codes", () => {
  assert.equal(resolveRedeemCountry("ID").dialCode, "+62");
  assert.equal(resolveRedeemCountry("PH").iso, "PH");
  assert.equal(resolveRedeemCountry("IN").dialCode, "+91");
  assert.equal(resolveRedeemCountry("PK").dialCode, "+92");
  assert.equal(resolveRedeemCountry("BD").dialCode, "+880");
  assert.equal(resolveRedeemCountry("NP").dialCode, "+977");
});

test("resolveRedeemCountry falls back to India", () => {
  assert.equal(resolveRedeemCountry("US"), DEFAULT_REDEEM_COUNTRY);
  assert.equal(resolveRedeemCountry(""), DEFAULT_REDEEM_COUNTRY);
});

test("formatPhoneDisplay formats known country prefixes", () => {
  assert.equal(formatPhoneDisplay("6281234567890"), "+62 81234567890");
  assert.equal(formatPhoneDisplay("639171234567"), "+63 9171234567");
  assert.equal(formatPhoneDisplay("918801384326"), "+91 8801384326");
  assert.equal(formatPhoneDisplay("923001234567"), "+92 3001234567");
  assert.equal(formatPhoneDisplay("8801712345678"), "+880 1712345678");
  assert.equal(formatPhoneDisplay("9779812345678"), "+977 9812345678");
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
  assert.equal(getInitialRedeemCountry().iso, "ID");
  __resetRedeemCountryStorageForTests();
});

test("getRedeemCurrencyForCountry maps ISO to Tremendous currency", () => {
  assert.equal(getRedeemCurrencyForCountry("IN").code, "INR");
  assert.equal(getRedeemCurrencyForCountry("ID").code, "IDR");
  assert.equal(getRedeemCurrencyForCountry("XX").code, "INR");
});

test("formatRedeemDenomination formats currency labels", () => {
  assert.equal(formatRedeemDenomination(100, "INR"), "₹100");
  assert.equal(formatRedeemDenomination(250000, "IDR"), "Rp250,000");
  assert.equal(formatRedeemDenomination(10.5, "USD"), "$10.50");
});
