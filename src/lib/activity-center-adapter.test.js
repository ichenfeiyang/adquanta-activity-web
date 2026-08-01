import test from "node:test";
import assert from "node:assert/strict";

import { ActivityCenterAdapter } from "./activity-center-adapter.js";

test("keeps the native event callback working after the SDK shim callback is replaced", () => {
  const previousWindow = globalThis.window;
  const received = [];
  const listeners = [];
  globalThis.window = {
    ActivityBridgeHelper: {
      onActivityEventCompleted: (arg) => {
        if (typeof arg === "function") {
          listeners.push(arg);
          return true;
        }
        return true;
      },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    visibilityState: "visible",
  };

  try {
    const adapter = new ActivityCenterAdapter({
      onEventCompleted: (result) => received.push(result),
    });

    adapter.setupEventCallback();
    const stableGlobalCallback = window.onActivityEventCompleted;
    assert.equal(listeners.length, 1);

    // Mirrors a second SDK-shim injection: its private listener array is
    // recreated and its registration function is replaced.
    const nextListeners = [];
    window.ActivityBridgeHelper.onActivityEventCompleted = (arg) => {
      if (typeof arg === "function") {
        nextListeners.push(arg);
        return true;
      }
      return true;
    };
    adapter.setupEventCallback();
    assert.equal(nextListeners.length, 1);
    assert.equal(window.onActivityEventCompleted, stableGlobalCallback);

    stableGlobalCallback({ eventType: "reward_ad", success: true });
    assert.deepEqual(received, [{ eventType: "reward_ad", success: true }]);

    adapter.dispose();
    assert.equal(window.onActivityEventCompleted, null);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    delete globalThis.document;
  }
});

test("registers both the global callback and the shim listener list", () => {
  const previousWindow = globalThis.window;
  const received = [];
  const listeners = [];
  globalThis.window = {
    ActivityBridgeHelper: {
      onActivityEventCompleted: (arg) => {
        if (typeof arg === "function") {
          listeners.push(arg);
          return true;
        }
        listeners.forEach((fn) => fn(arg));
        return true;
      },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    visibilityState: "visible",
  };

  try {
    const adapter = new ActivityCenterAdapter({
      onEventCompleted: (result) => received.push(result),
    });
    adapter.setupEventCallback();

    assert.equal(typeof window.onActivityEventCompleted, "function");
    assert.equal(listeners.length, 1);

    // Shim-only hosts still reach H5 through the registered listener.
    window.ActivityBridgeHelper.onActivityEventCompleted({ eventType: "reward_ad", success: true });
    assert.deepEqual(received, [{ eventType: "reward_ad", success: true }]);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    delete globalThis.document;
  }
});
