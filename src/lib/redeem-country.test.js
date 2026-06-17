import test from "node:test";
import assert from "node:assert/strict";
import {
  __resetRedeemCountryStorageForTests,
  DEFAULT_REDEEM_COUNTRY,
  formatPhoneDisplay,
  getInitialRedeemCountry,
  getSavedRedeemCountry,
  resolveRedeemCountry,
  saveRedeemCountry,
} from "./redeem-country.js";

test("resolveRedeemCountry maps supported ISO codes", () => {
  assert.equal(resolveRedeemCountry("ID").dialCode, "+62");
  assert.equal(resolveRedeemCountry("PH").iso, "PH");
  assert.equal(resolveRedeemCountry("IN").dialCode, "+91");
});

test("resolveRedeemCountry falls back to India", () => {
  assert.equal(resolveRedeemCountry("US"), DEFAULT_REDEEM_COUNTRY);
  assert.equal(resolveRedeemCountry(""), DEFAULT_REDEEM_COUNTRY);
});

test("formatPhoneDisplay formats known country prefixes", () => {
  assert.equal(formatPhoneDisplay("6281234567890"), "+62 81234567890");
  assert.equal(formatPhoneDisplay("639171234567"), "+63 9171234567");
  assert.equal(formatPhoneDisplay("918801384326"), "+91 8801384326");
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
