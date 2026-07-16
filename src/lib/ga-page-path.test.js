import assert from "node:assert/strict";
import test from "node:test";

import { normalizeGaPagePath } from "./ga-page-path.js";

test("normalizeGaPagePath merges legacy HTML entries into SPA routes", () => {
  const legacyActivityCenter = `/${"activity-center"}.html`;
  assert.equal(normalizeGaPagePath(legacyActivityCenter), "/activity-center");
  assert.equal(normalizeGaPagePath(`/campaign/${"activity-center"}.html`), "/campaign/activity-center");
  assert.equal(normalizeGaPagePath("/topup-status.html"), "/topup-status");
  assert.equal(normalizeGaPagePath("/gold-coins-exchange.html"), "/gold-coins-exchange");
});

test("normalizeGaPagePath merges SPA entry paths into the activity center", () => {
  assert.equal(normalizeGaPagePath("/"), "/activity-center");
  assert.equal(normalizeGaPagePath("/index.html"), "/activity-center");
  assert.equal(normalizeGaPagePath("/campaign/"), "/campaign/activity-center");
  assert.equal(normalizeGaPagePath("/campaign/index.html"), "/campaign/activity-center");
});

test("normalizeGaPagePath preserves canonical and unrelated paths", () => {
  assert.equal(normalizeGaPagePath("/activity-center"), "/activity-center");
  assert.equal(normalizeGaPagePath("/other.html"), "/other.html");
});
