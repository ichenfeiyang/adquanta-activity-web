import assert from "node:assert/strict";
import test from "node:test";
import {
  __resetUserLocaleStorageForTests,
  initActivityLocale,
  readSavedUserLocale,
  resolveActivityLocale,
  resolveLocaleFromRegion,
  readSystemLocaleFromSdkSession,
  saveUserLocale,
  setActivityLocale,
  t,
} from "./activity-locale.js";

test("resolveLocaleFromRegion maps supported regions", () => {
  assert.equal(resolveLocaleFromRegion("ID"), "id");
  assert.equal(resolveLocaleFromRegion("PK"), "ur");
  assert.equal(resolveLocaleFromRegion("BD"), "bn");
  assert.equal(resolveLocaleFromRegion("NP"), "ne");
  assert.equal(resolveLocaleFromRegion("IN"), "en");
  assert.equal(resolveLocaleFromRegion("US"), "en");
});

test("resolveActivityLocale prefers explicit locale param", () => {
  assert.equal(resolveActivityLocale({ locale: "id-ID" }), "id");
  assert.equal(resolveActivityLocale({ locale: "in-ID" }), "id");
  assert.equal(resolveActivityLocale({ locale: "ur-PK" }), "ur");
  assert.equal(resolveActivityLocale({ locale: "bn-BD" }), "bn");
  assert.equal(resolveActivityLocale({ locale: "ne-NP" }), "ne");
  assert.equal(resolveActivityLocale({ locale: "en-US" }), "en");
  assert.equal(resolveActivityLocale({ locale: "hi-IN" }), "en");
});

test("resolveActivityLocale prefers phone system language over SDK region", () => {
  __resetUserLocaleStorageForTests();
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { language: "id-ID", languages: ["id-ID", "en-ID"] },
  });
  try {
    assert.equal(resolveActivityLocale({ session: { region: "IN" } }), "id");
    assert.equal(resolveActivityLocale({ session: { locale: "en-US" } }), "id");
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    __resetUserLocaleStorageForTests();
  }
});

test("resolveActivityLocale prefers SDK system locale in app webview", () => {
  __resetUserLocaleStorageForTests();
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { language: "en-US", languages: ["en-US"] },
  });
  try {
    assert.equal(
      resolveActivityLocale({ session: { systemLocale: "id-ID", locale: "en-US", region: "IN" } }),
      "id",
    );
    assert.equal(
      resolveActivityLocale({ session: { deviceLanguage: "in-ID", language: "en", region: "IN" } }),
      "id",
    );
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    __resetUserLocaleStorageForTests();
  }
});

test("resolveActivityLocale uses region when SDK app locale is generic English", () => {
  __resetUserLocaleStorageForTests();
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { language: "en-US", languages: ["en-US"] },
  });
  try {
    assert.equal(resolveActivityLocale({ session: { locale: "en-US", region: "ID" } }), "id");
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    __resetUserLocaleStorageForTests();
  }
});

test("resolveActivityLocale ignores stale locale storage without manual flag", () => {
  const storage = {};
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => storage[key] ?? null,
    setItem: (key, value) => {
      storage[key] = String(value);
    },
    removeItem: (key) => {
      delete storage[key];
    },
  };
  try {
    storage["activity_ui_locale_v1"] = "en";
    assert.equal(resolveActivityLocale({ session: { region: "ID" } }), "id");
  } finally {
    globalThis.localStorage = originalStorage;
  }
});

test("resolveActivityLocale maps legacy Indonesian in-ID from navigator", () => {
  __resetUserLocaleStorageForTests();
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { language: "in-ID", languages: ["in-ID"] },
  });
  try {
    assert.equal(resolveActivityLocale({}), "id");
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    __resetUserLocaleStorageForTests();
  }
});

test("resolveActivityLocale reads native bridge system locale", () => {
  __resetUserLocaleStorageForTests();
  const originalBridge = globalThis.window?.ActivityBridgeHelper;
  globalThis.window = globalThis.window || {};
  globalThis.window.ActivityBridgeHelper = {
    getSystemLocale: () => "id-ID",
  };
  try {
    assert.equal(resolveActivityLocale({ session: {} }), "id");
  } finally {
    if (originalBridge === undefined) {
      delete globalThis.window.ActivityBridgeHelper;
    } else {
      globalThis.window.ActivityBridgeHelper = originalBridge;
    }
    __resetUserLocaleStorageForTests();
  }
});

test("resolveActivityLocale maps SDK session region to locale", () => {
  __resetUserLocaleStorageForTests();
  assert.equal(resolveActivityLocale({ session: { region: "ID" } }), "id");
  assert.equal(resolveActivityLocale({ session: { country_code: "PK" } }), "ur");
});

test("resolveActivityLocale prefers saved user locale over region", () => {
  const storage = {};
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => storage[key] ?? null,
    setItem: (key, value) => {
      storage[key] = String(value);
    },
    removeItem: (key) => {
      delete storage[key];
    },
  };
  try {
    saveUserLocale("en");
    assert.equal(resolveActivityLocale({ session: { region: "ID" } }), "en");
    assert.equal(readSavedUserLocale(), "en");
  } finally {
    globalThis.localStorage = originalStorage;
  }
});

test("t returns localized strings with interpolation", async () => {
  __resetUserLocaleStorageForTests();
  await initActivityLocale({ locale: "en", force: true });
  assert.equal(t("center.myBalance"), "My Balance");
  assert.equal(t("center.progressSpins", { used: 2, limit: 5 }), "2 / 5 Spins");

  await initActivityLocale({ locale: "id", force: true });
  assert.equal(t("center.myBalance"), "Saldo Saya");
  assert.equal(t("center.progressSpins", { used: 2, limit: 5 }), "2 / 5 Putaran");
});

test("check-in chest dialogs provide copy for every supported locale", async () => {
  const keys = [
    "center.checkinChestDropped",
    "center.checkinChestDescLine1",
    "center.checkinChestDescLine2",
    "center.checkinChestWatchVideo",
    "center.checkinChestDismiss",
    "center.checkinChestCongratulations",
    "center.checkinChestYouGot",
    "center.checkinChestClaim",
  ];
  for (const locale of ["en", "id", "ur", "bn", "ne"]) {
    await initActivityLocale({ locale, force: true });
    for (const key of keys) {
      assert.notEqual(t(key), key, `${locale} is missing ${key}`);
      assert.notEqual(t(key).trim(), "", `${locale} has empty ${key}`);
    }
  }
});

test("coin rain flow provides PRD dialog copy for every supported locale", async () => {
  const keys = [
    "center.coinRainUpTo",
    "center.coinRainLeaveTitle",
    "center.coinRainLeaveDesc",
    "center.coinRainLeaveBeforeStartDesc",
    "center.coinRainContinue",
    "center.coinRainLeave",
    "center.coinRainWatchShortVideo",
    "center.coinRainGetInstead",
    "center.coinRainClaimAmount",
    "center.coinRainAlreadyGot",
    "center.coinRainWatchMore",
    "center.coinRainWatchVideo",
    "center.coinRainLater",
    "center.coinRainAlreadyJoinedTitle",
    "center.coinRainAlreadyJoinedDesc",
    "center.coinRainOk",
  ];
  for (const locale of ["en", "id", "ur", "bn", "ne"]) {
    await initActivityLocale({ locale, force: true });
    for (const key of keys) {
      assert.notEqual(t(key, { count: 16 }), key, `${locale} is missing ${key}`);
      assert.notEqual(t(key, { count: 16 }).trim(), "", `${locale} has empty ${key}`);
    }
  }
});

test("initActivityLocale sets document lang and dir", async () => {
  __resetUserLocaleStorageForTests();
  const originalDocument = globalThis.document;
  const storage = {};
  globalThis.localStorage = {
    getItem: (key) => storage[key] ?? null,
    setItem: (key, value) => {
      storage[key] = String(value);
    },
    removeItem: (key) => {
      delete storage[key];
    },
  };
  globalThis.document = { documentElement: { lang: "en", dir: "ltr" } };
  try {
    await initActivityLocale({ locale: "ur", force: true });
    assert.equal(document.documentElement.lang, "ur");
    assert.equal(document.documentElement.dir, "rtl");
    await initActivityLocale({ locale: "bn", force: true });
    assert.equal(document.documentElement.lang, "bn");
    assert.equal(document.documentElement.dir, "ltr");
  } finally {
    globalThis.document = originalDocument;
    delete globalThis.localStorage;
    __resetUserLocaleStorageForTests();
  }
});
