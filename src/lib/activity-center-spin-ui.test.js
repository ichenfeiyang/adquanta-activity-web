import test from "node:test";
import assert from "node:assert/strict";

import { initActivityLocale } from "./i18n/activity-locale.js";
import { SPIN_AD_WAIT_STALE_MS, spinUiMixin } from "./activity-center-spin-ui.js";

function createSpinUi(config = {}) {
  const spinBtn = { textContent: "", disabled: false };
  const ui = Object.assign(Object.create(spinUiMixin), {
    config,
    elements: {
      spinWheelSpinBtn: spinBtn,
      spinWheelModal: { style: { display: "none" } },
      spinWheelSubtitle: { textContent: "" },
      spinRewardModal: { style: { display: "none" } },
    },
    spinPrizePool: [10, 20, 30, 50, 100, 150, 200, 10],
    currentSpinAvailable: 0,
    dailySpinLimit: 5,
    _turntableNeedsWatch: true,
    _waitingAdForSpin: false,
    _waitingAdForSpinAt: 0,
    _spinInFlight: false,
    spinRotation: 0,
    syncBodyScrollLock() {},
    saveSpinAvailableState() {},
    clampSpinCountByLimit() {
      this.currentSpinAvailable = Math.max(0, Math.floor(this.currentSpinAvailable));
    },
  });
  return ui;
}

test("stale spin-ad wait unlocks and retries instead of staying on Processing", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const calls = [];
  const ui = createSpinUi({
    onWatchAdClick: () => calls.push("watch"),
    onSpinAdWaitRecover: () => calls.push("recover"),
    isDailyAdLimitReached: () => false,
  });

  ui.beginWaitingAdForSpin();
  ui._waitingAdForSpinAt = Date.now() - SPIN_AD_WAIT_STALE_MS - 1;
  ui.handleSpinWheelBottomClick();

  assert.deepEqual(calls, ["recover", "watch"]);
  assert.equal(ui.isWaitingAdForSpin(), true);
});

test("closing the spin modal clears a pending ad wait and recovers the coordinator", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const previousDocument = globalThis.document;
  globalThis.document = { body: { classList: { toggle() {}, add() {}, remove() {} } } };
  const calls = [];
  const ui = createSpinUi({
    onSpinAdWaitRecover: () => calls.push("recover"),
  });
  try {
    ui.beginWaitingAdForSpin();
    ui.setSpinWheelVisible(true);

    ui.hideSpinWheel();

    assert.equal(ui.isWaitingAdForSpin(), false);
    assert.deepEqual(calls, ["recover"]);
    assert.equal(ui.elements.spinWheelModal.style.display, "none");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("failed spin settlement re-enables the spin button", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const ui = createSpinUi({
    onSpinRequest: async () => ({ ok: false }),
    isDailyAdLimitReached: () => false,
  });
  ui.currentSpinAvailable = 1;
  ui._turntableNeedsWatch = false;

  await ui.spinWheel();

  assert.equal(ui._spinInFlight, false);
  assert.equal(ui.elements.spinWheelSpinBtn.disabled, false);
  assert.equal(ui.currentSpinAvailable, 1);
});

test("ad success unlocks Spin Now even when waiting was already cleared", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const ui = createSpinUi({ isDailyAdLimitReached: () => false });
  ui._turntableNeedsWatch = true;
  ui._waitingAdForSpin = false;

  await ui.handleRewardAdCompletedForSpin();

  assert.equal(ui.currentSpinAvailable, 1);
  assert.equal(ui._turntableNeedsWatch, false);
  assert.equal(ui.elements.spinWheelSpinBtn.textContent, "Spin Now");
});

test("bottom click with leftover chance only unlocks Spin Now when still in watch mode", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const calls = [];
  const ui = createSpinUi({
    onWatchAdClick: () => calls.push("watch"),
    onSpinRequest: async () => {
      calls.push("spin");
      return { ok: false };
    },
    isDailyAdLimitReached: () => false,
  });
  ui.currentSpinAvailable = 1;
  ui._turntableNeedsWatch = true;

  ui.handleSpinWheelBottomClick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(calls, []);
  assert.equal(ui._turntableNeedsWatch, false);
  assert.equal(ui.elements.spinWheelSpinBtn.textContent, "Spin Now");
  assert.equal(ui.elements.spinWheelSpinBtn.disabled, false);
});

test("showSpinWheel restores Spin Now after locale reload when a chance remains", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const previousDocument = globalThis.document;
  globalThis.document = { body: { classList: { toggle() {}, add() {}, remove() {} } } };
  const ui = createSpinUi({
    onSpinWheelOpen: async () => {},
  });
  try {
    ui.currentSpinAvailable = 1;
    ui._turntableNeedsWatch = true;
    ui.isTodayTurntableDailyFirstShown = () => true;

    await ui.showSpinWheel();

    assert.equal(ui._turntableNeedsWatch, false);
    assert.equal(ui.elements.spinWheelSpinBtn.textContent, "Spin Now");
    assert.equal(ui.elements.spinWheelModal.style.display, "flex");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
