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
    toggle: (item, force) => {
      if (force === true) values.add(item);
      else if (force === false) values.delete(item);
      else if (values.has(item)) values.delete(item);
      else values.add(item);
      return values.has(item);
    },
  };
}

function clickable() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    click() {
      listeners.get("click")?.();
    },
  };
}

test("coin rain only starts from the Play Now action", () => {
  const entry = clickable();
  const action = clickable();
  let starts = 0;
  const ui = {
    ...coinRainUiMixin,
    _coinRainStatus: { enabled: true, state: "available" },
    elements: { coinRainEntry: entry, coinRainEntryAction: action },
    config: { onCoinRainEntryClick: () => { starts += 1; } },
  };

  ui.bindCoinRainEvents();
  entry.click();
  assert.equal(starts, 0);
  action.click();
  assert.equal(starts, 1);
});

test("leave dialog pauses rendering without extending the server deadline", () => {
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
  assert.equal(ui._coinRainSession.endAt, endAtBeforeResume);
});

test("abandoning during the local countdown does not call the server", async () => {
  let cancelled = 0;
  let abandoned = 0;
  const ui = {
    ...coinRainUiMixin,
    config: { onCoinRainAbandon: async () => { abandoned += 1; } },
    _coinRainSession: { preparing: true, settling: false, settlementPending: false },
    cancelCoinRainPreparation() { cancelled += 1; },
  };

  await ui.abandonCoinRainImmediately();

  assert.equal(cancelled, 1);
  assert.equal(abandoned, 0);
});

test("paused game timer still settles when the deadline elapses", () => {
  const previousWindow = globalThis.window;
  let intervalCb = null;
  globalThis.window = {
    setInterval: (cb) => {
      intervalCb = cb;
      return 1;
    },
    clearInterval() {},
    setTimeout() {},
  };
  const leaveDialog = { style: { display: "none" } };
  let finished = 0;
  const ui = {
    ...coinRainUiMixin,
    elements: {
      coinRainOverlay: { classList: classList() },
      coinRainStage: { childElementCount: 14, appendChild() {}, replaceChildren() {} },
      coinRainTime: { textContent: "" },
      coinRainGameProgress: { style: {} },
      coinRainLeaveDialog: leaveDialog,
      coinRainCountdown: { style: {} },
    },
    _coinRainSession: {
      duration: 30,
      deadlineAt: Date.now() - 1,
      endAt: 0,
      running: false,
      paused: false,
      settling: false,
      settlementPending: false,
      clicked: 3,
      baseMaxCoin: 200,
    },
    finishCoinRain() {
      finished += 1;
      this._coinRainSession.running = false;
      this._coinRainSession.paused = false;
    },
  };
  try {
    ui.runCoinRain();
    ui.leaveCoinRain();
    assert.equal(ui._coinRainSession.paused, true);
    assert.equal(leaveDialog.style.display, "flex");
    assert.equal(typeof intervalCb, "function");
    intervalCb();
    assert.equal(finished, 1);
    assert.equal(leaveDialog.style.display, "none");
    assert.equal(ui._coinRainSession.paused, false);
  } finally {
    ui.clearCoinRainLocalTimers();
    globalThis.window = previousWindow;
  }
});

test("game progress follows the remaining coin rain time", () => {
  const progress = { style: {} };
  const ui = {
    ...coinRainUiMixin,
    elements: { coinRainGameProgress: progress },
  };

  ui.updateCoinRainGameProgress(30_000, 30_000);
  assert.equal(progress.style.width, "100%");
  ui.updateCoinRainGameProgress(15_000, 30_000);
  assert.equal(progress.style.width, "50%");
  ui.updateCoinRainGameProgress(0, 30_000);
  assert.equal(progress.style.width, "0%");
});

test("resumed games keep the original server deadline", () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    setInterval: () => 1,
    clearInterval() {},
    setTimeout() {},
  };
  const deadlineAt = Date.now() + 8_000;
  const ui = {
    ...coinRainUiMixin,
    elements: {
      coinRainOverlay: { classList: classList() },
      coinRainStage: { childElementCount: 14, appendChild() {} },
      coinRainTime: { textContent: "" },
      coinRainGameProgress: { style: {} },
    },
    _coinRainSession: {
      duration: 30,
      deadlineAt,
      endAt: 0,
      running: false,
      paused: false,
      clicked: 0,
      baseMaxCoin: 200,
    },
  };
  try {
    ui.runCoinRain();
    assert.equal(ui._coinRainSession.endAt, deadlineAt);
  } finally {
    ui.clearCoinRainLocalTimers();
    globalThis.window = previousWindow;
  }
});

test("multiplier badge follows successful click count", () => {
  const badge = { classList: classList(), offsetWidth: 1 };
  const label = { textContent: "x0" };
  const ui = {
    ...coinRainUiMixin,
    elements: { coinRainMultiplier: badge, coinRainMultiplierValue: label },
  };

  ui.updateCoinRainMultiplier(0);
  assert.equal(label.textContent, "x0");
  assert.equal(badge.classList.contains("is-wide"), false);
  assert.equal(badge.classList.contains("is-bump"), false);

  ui.updateCoinRainMultiplier(2);
  assert.equal(label.textContent, "x2");
  assert.equal(badge.classList.contains("is-wide"), false);
  assert.equal(badge.classList.contains("is-bump"), true);

  ui.updateCoinRainMultiplier(12);
  assert.equal(label.textContent, "x12");
  assert.equal(badge.classList.contains("is-wide"), true);

  ui.updateCoinRainMultiplier(128);
  assert.equal(label.textContent, "x128");
  assert.equal(badge.classList.contains("is-wider"), true);
});

test("countdown badge highlights the configured max coin", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const children = [];
  const badge = {
    textContent: "",
    replaceChildren(...nodes) {
      children.length = 0;
      children.push(...nodes);
      this.textContent = nodes.map((node) => node.textContent ?? String(node)).join("");
    },
  };
  const value = { textContent: "", classList: classList(), offsetWidth: 1 };
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      return { tagName: String(tag).toUpperCase(), textContent: "" };
    },
    createTextNode(text) {
      return { textContent: String(text) };
    },
  };
  try {
    const ui = {
      ...coinRainUiMixin,
      elements: { coinRainCountdownMax: badge, coinRainCountdownValue: value },
    };

    ui.updateCoinRainCountdownMax(400);
    assert.equal(badge.textContent, "UP TO 400 COINS!");
    assert.equal(children[1]?.textContent, "400");
    assert.equal(children[1]?.tagName, "EM");

    ui.setCoinRainCountdownValue(2);
    assert.equal(value.textContent, "2");
    assert.equal(value.classList.contains("is-tick"), true);
  } finally {
    globalThis.document = previousDocument;
  }
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

test("boost success follows the Got it design layout", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const resultClassList = classList();
  const heroImg = { src: "", width: 0, height: 0 };
  const ui = {
    ...coinRainUiMixin,
    _coinRainStatus: {},
    setCoinRainAdLoading() {},
    elements: {
      coinRainResult: { classList: resultClassList, style: {} },
      coinRainResultHeroImg: heroImg,
      coinRainResultTitle: { textContent: "" },
      coinRainResultAmount: { textContent: "", style: {} },
      coinRainResultUnit: { style: {} },
      coinRainResultCopy: { style: {} },
      coinRainBoostOffer: { style: {} },
      coinRainWatchAd: { style: {} },
      coinRainClaim: { textContent: "" },
    },
  };

  ui.showCoinRainBoostSuccess({ base_coin: 16, boost_coin: 16 });
  assert.equal(resultClassList.contains("is-boost-success"), true);
  assert.equal(resultClassList.contains("is-boost-prompt"), false);
  assert.equal(ui.elements.coinRainResultTitle.textContent, "Boost Successful");
  assert.equal(ui.elements.coinRainResultAmount.textContent, "+32");
  assert.equal(ui.elements.coinRainClaim.textContent, "Got it");
  assert.equal(ui.elements.coinRainWatchAd.style.display, "none");
  assert.equal(ui.elements.coinRainBoostOffer.style.display, "none");
  assert.equal(ui.elements.coinRainResultCopy.style.display, "none");
  assert.match(heroImg.src, /coin-rain-reward-art\.png/);
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
  assert.match(leaveDesc.textContent, /cannot join Coin Rain again today/i);
});

test("backgrounding the preparation countdown never starts a coin-rain session", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  let countdownTick = null;
  let visibilityHandler = null;
  const overlay = { classList: classList(), style: {} };
  const leaveDialog = { style: { display: "none" } };
  globalThis.window = {
    setInterval(callback) { countdownTick = callback; return 1; },
    clearInterval() {},
  };
  globalThis.document = {
    hidden: false,
    body: { style: {} },
    addEventListener(type, callback) { if (type === "visibilitychange") visibilityHandler = callback; },
    removeEventListener() {},
  };
  let starts = 0;
  const ui = {
    ...coinRainUiMixin,
    elements: {
      coinRainOverlay: overlay,
      coinRainCountdown: { style: {} },
      coinRainStage: { replaceChildren() {} },
      coinRainCollected: { textContent: "" },
      coinRainMultiplier: { classList: classList(), offsetWidth: 1 },
      coinRainMultiplierValue: { textContent: "" },
      coinRainTime: { textContent: "" },
      coinRainGameProgress: { style: {} },
      coinRainLeaveDialog: leaveDialog,
      coinRainLeaveDesc: { textContent: "" },
    },
  };
  try {
    assert.equal(ui.startCoinRainPreparation({ base_max_coin: 200, display_max_coin: 400 }, () => { starts += 1; }), true);
    assert.equal(typeof visibilityHandler, "function");
    globalThis.document.hidden = true;
    visibilityHandler();
    countdownTick();

    assert.equal(starts, 0);
    assert.equal(ui._coinRainSession.paused, true);
    assert.equal(leaveDialog.style.display, "flex");
  } finally {
    ui.destroyCoinRain();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
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

test("playing stays visible while abandoned is completed", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const entry = { classList: classList() };
  const action = { textContent: "" };
  const ui = {
    ...coinRainUiMixin,
    elements: {
      coinRainSection: { style: {} },
      coinRainEntry: entry,
      coinRainEntryAction: action,
      coinRainDesc: { textContent: "" },
    },
  };

  for (const state of ["playing", "available"]) {
    ui.updateCoinRain({ enabled: true, state, display_max_coin: 400, base_coin: 0, boost_coin: 0 });
    assert.equal(entry.classList.contains("is-completed"), false);
    assert.equal(action.textContent, "Play Now");
  }

  ui.updateCoinRain({ enabled: true, state: "abandoned", display_max_coin: 400, base_coin: 0, boost_coin: 0 });
  assert.equal(entry.classList.contains("is-completed"), true);
  assert.equal(action.textContent, "Completed");

  ui.updateCoinRain({ enabled: true, state: "completed", display_max_coin: 400, base_coin: 0, boost_coin: 0 });
  assert.equal(entry.classList.contains("is-completed"), true);
  assert.equal(action.textContent, "Completed");

  ui.updateCoinRain({ enabled: true, state: "settle_pending", display_max_coin: 400, base_coin: 0, boost_coin: 0 });
  assert.equal(entry.classList.contains("is-completed"), false);
  assert.equal(action.textContent, "Claim");
});

test("settlement retry keeps the original session and click count after both requests fail", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const submitted = [];
  globalThis.window = {
    clearInterval() {},
    setTimeout(callback) { callback(); return 1; },
    alert() {},
  };
  globalThis.document = { getElementById() { return null; } };
  const session = {
    sessionId: "settle-retry-session",
    clicked: 37,
    running: true,
    paused: false,
    settling: false,
    settlementPending: false,
  };
  const ui = {
    ...coinRainUiMixin,
    _coinRainSession: session,
    elements: {
      coinRainStage: { replaceChildren() {} },
      coinRainOverlay: { style: {}, classList: classList() },
    },
    config: {
      async onCoinRainSettle(payload) {
        submitted.push(payload);
        return { ok: false, message: "temporary network failure" };
      },
    },
  };
  try {
    await ui.finishCoinRain();
    assert.equal(submitted.length, 2);
    assert.deepEqual(submitted, [
      { sessionId: "settle-retry-session", clickedCount: 37 },
      { sessionId: "settle-retry-session", clickedCount: 37 },
    ]);
    assert.equal(ui._coinRainSession, session);
    assert.equal(session.clicked, 37);
    assert.equal(session.settlementPending, true);
    assert.equal(session.settling, false);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("settlement recovery restores only the matching saved session", () => {
  const previousStorage = globalThis.sessionStorage;
  const store = new Map();
  globalThis.sessionStorage = {
    getItem(key) { return store.get(key) || null; },
    setItem(key, value) { store.set(key, value); },
    removeItem(key) { store.delete(key); },
  };
  store.set("activity-center:coin-rain-recovery", JSON.stringify({
    sessionId: "recoverable-session",
    clicked: 42,
    deadlineAt: 1_789_000_000_000,
  }));
  try {
    const ui = { ...coinRainUiMixin, elements: {} };
    assert.equal(ui.restoreCoinRainSettlement({
      session_id: "recoverable-session",
      base_max_coin: 200,
      display_max_coin: 400,
      duration_seconds: 30,
    }), true);
    assert.equal(ui._coinRainSession.clicked, 42);
    assert.equal(ui._coinRainSession.settlementPending, true);

    ui._coinRainSession = null;
    assert.equal(ui.restoreCoinRainSettlement({ session_id: "other-session", base_max_coin: 200 }), false);
    assert.equal(ui._coinRainSession, null);
  } finally {
    globalThis.sessionStorage = previousStorage;
  }
});

test("destroyCoinRain preserves the server session for recovery", () => {
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
  assert.equal(abandoned, null);
  assert.equal(ui._coinRainSession, null);
  assert.equal(overlay.style.display, "none");
});
