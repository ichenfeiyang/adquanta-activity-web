import test from "node:test";
import assert from "node:assert/strict";

import { isNoviceGuideCompleted, markNoviceGuideCompleted } from "./novice-guide-state.js";

test("novice guide completion is isolated by activity user scope", () => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  try {
    markNoviceGuideCompleted("activity-1:user-a");

    assert.equal(isNoviceGuideCompleted("activity-1:user-a"), true);
    assert.equal(isNoviceGuideCompleted("activity-1:user-b"), false);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
