import test from "node:test";
import assert from "node:assert/strict";

import { ActivityCenterAdapter } from "./activity-center-adapter.js";

test("keeps the native event callback working after the SDK shim callback is replaced", () => {
  const previousWindow = globalThis.window;
  const received = [];
  globalThis.window = {
    ActivityBridgeHelper: {
      onActivityEventCompleted: () => true,
    },
  };

  try {
    const adapter = new ActivityCenterAdapter({
      onEventCompleted: (result) => received.push(result),
    });

    adapter.setupEventCallback();
    const stableGlobalCallback = window.onActivityEventCompleted;

    // Mirrors a second SDK-shim injection: its private listener array is
    // recreated and its registration function is replaced.
    window.ActivityBridgeHelper.onActivityEventCompleted = () => true;
    stableGlobalCallback({ eventType: "reward_ad", success: true });

    assert.deepEqual(received, [{ eventType: "reward_ad", success: true }]);
    assert.equal(window.onActivityEventCompleted, stableGlobalCallback);

    adapter.dispose();
    assert.equal(window.onActivityEventCompleted, null);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
