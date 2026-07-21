import assert from "node:assert/strict";
import test from "node:test";

import { coinRainUiMixin } from "./activity-center-coin-rain-ui.js";
import { initActivityLocale } from "./i18n/activity-locale.js";

function classList() {
  const values = new Set();
  return {
    add: (...items) => items.forEach((item) => values.add(item)),
    remove: (...items) => items.forEach((item) => values.delete(item)),
    contains: (item) => values.has(item),
  };
}

test("leave dialog pauses and continue restores the remaining game time", () => {
  const overlay = { classList: classList() };
  const leaveDialog = { style: { display: "none" } };
  const ui = {
    ...coinRainUiMixin,
    elements: { coinRainOverlay: overlay, coinRainLeaveDialog: leaveDialog },
    _coinRainSession: { running: true, paused: false, pauseStartedAt: 0, endAt: Date.now() + 10_000 },
  };

  ui.leaveCoinRain();
  assert.equal(ui._coinRainSession.paused, true);
  assert.equal(overlay.classList.contains("is-paused"), true);
  assert.equal(leaveDialog.style.display, "flex");

  const endAtBeforeResume = ui._coinRainSession.endAt;
  ui._coinRainSession.pauseStartedAt -= 1_000;
  ui.hideCoinRainLeaveDialog();
  assert.equal(ui._coinRainSession.paused, false);
  assert.equal(overlay.classList.contains("is-paused"), false);
  assert.ok(ui._coinRainSession.endAt >= endAtBeforeResume + 1_000);
});

test("base result follows the PRD reward and boost layout", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const resultClassList = classList();
  const ui = {
    ...coinRainUiMixin,
    _coinRainStatus: {},
    elements: {
      coinRainResult: { classList: resultClassList, style: {} },
      coinRainResultTitle: { textContent: "" },
      coinRainResultAmount: { textContent: "", style: {} },
      coinRainResultUnit: { style: {} },
      coinRainResultCopy: { textContent: "", style: {} },
      coinRainBoostOffer: { style: {} },
      coinRainBoostOfferCopy: { textContent: "" },
      coinRainWatchAd: { style: {} },
      coinRainClaim: { textContent: "" },
    },
  };

  ui.showCoinRainResult({ base_coin: 16, boost_available: true });
  assert.equal(ui.elements.coinRainResultAmount.textContent, "+16");
  assert.equal(ui.elements.coinRainBoostOffer.style.display, "flex");
  assert.match(ui.elements.coinRainBoostOfferCopy.textContent, /32/);
  assert.match(ui.elements.coinRainClaim.textContent, /16/);
  assert.equal(ui.elements.coinRainResult.style.display, "flex");
});

test("boost prompt follows the already-claimed design layout", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const resultClassList = classList();
  const heroImg = { src: "", width: 0, height: 0 };
  const ui = {
    ...coinRainUiMixin,
    _coinRainStatus: {},
    elements: {
      coinRainResult: { classList: resultClassList, style: {} },
      coinRainResultHeroImg: heroImg,
      coinRainResultTitle: { textContent: "" },
      coinRainResultAmount: { textContent: "", style: {} },
      coinRainResultUnit: { style: {} },
      coinRainResultCopy: { textContent: "", style: {} },
      coinRainBoostOffer: { style: {} },
      coinRainBoostOfferCopy: { textContent: "" },
      coinRainWatchAd: { style: {}, textContent: "" },
      coinRainClaim: { textContent: "" },
    },
  };

  ui.showCoinRainBoostPrompt({ base_coin: 16, boost_available: true });
  assert.equal(resultClassList.contains("is-boost-prompt"), true);
  assert.match(ui.elements.coinRainResultTitle.textContent, /already got 16/i);
  assert.match(ui.elements.coinRainResultCopy.textContent, /16 more/i);
  assert.equal(ui.elements.coinRainWatchAd.textContent, "Watch Video");
  assert.equal(ui.elements.coinRainClaim.textContent, "Later");
  assert.equal(ui.elements.coinRainBoostOffer.style.display, "none");
  assert.equal(ui.elements.coinRainResultAmount.style.display, "none");
  assert.match(heroImg.src, /coin-rain-boost-prompt-art\.png/);
});

test("background leave opens confirm dialog instead of abandoning", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const overlay = { classList: classList(), style: {} };
  const leaveDialog = { style: { display: "none" } };
  const leaveDesc = { textContent: "" };
  const ui = {
    ...coinRainUiMixin,
    elements: {
      coinRainOverlay: overlay,
      coinRainLeaveDialog: leaveDialog,
      coinRainLeaveDesc: leaveDesc,
    },
    _coinRainSession: { running: false, paused: false, pauseStartedAt: 0, endAt: 0 },
    config: { onCoinRainAbandon: () => assert.fail("should not abandon on background") },
  };

  ui.leaveCoinRain();
  assert.equal(ui._coinRainSession.paused, true);
  assert.equal(leaveDialog.style.display, "flex");
  assert.match(leaveDesc.textContent, /won't be able to join/i);
});

test("already-joined dialog matches PRD copy", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const dialog = { style: { display: "none" } };
  const ui = {
    ...coinRainUiMixin,
    elements: { coinRainJoinedDialog: dialog },
  };
  ui.showCoinRainAlreadyJoined();
  assert.equal(dialog.style.display, "flex");
  ui.hideCoinRainAlreadyJoined();
  assert.equal(dialog.style.display, "none");
});

test("destroyCoinRain abandons an active session", () => {
  let abandoned = null;
  const overlay = { classList: classList(), style: { display: "block" } };
  const ui = {
    ...coinRainUiMixin,
    elements: {
      coinRainOverlay: overlay,
      coinRainStage: { replaceChildren() {} },
      coinRainLeaveDialog: { style: {} },
      coinRainJoinedDialog: { style: {} },
    },
    _coinRainSession: { sessionId: "s1", running: true },
    config: {
      onCoinRainAbandon: ({ sessionId }) => {
        abandoned = sessionId;
      },
    },
  };
  ui.destroyCoinRain();
  assert.equal(abandoned, "s1");
  assert.equal(ui._coinRainSession, null);
});
