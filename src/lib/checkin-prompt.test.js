import assert from "node:assert/strict";
import test from "node:test";

import {
  dismissCheckinPrompt,
  normalizeCheckinPrompt,
  shouldShowCheckinPrompt,
} from "./checkin-prompt.js";

function installStorage() {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  return () => {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  };
}

test("check-in prompt requires a server-approved valid date", () => {
  const restore = installStorage();
  try {
    assert.deepEqual(normalizeCheckinPrompt({ show: true, server_date: "2026-07-22" }), {
      show: true,
      serverDate: "2026-07-22",
    });
    assert.equal(shouldShowCheckinPrompt({ show: true, server_date: "bad-date" }), false);
    assert.equal(shouldShowCheckinPrompt({ show: false, server_date: "2026-07-22" }), false);
  } finally {
    restore();
  }
});

test("closing the prompt suppresses only that server date", () => {
  const restore = installStorage();
  try {
    const today = { show: true, server_date: "2026-07-22" };
    assert.equal(shouldShowCheckinPrompt(today), true);
    dismissCheckinPrompt("2026-07-22");
    assert.equal(shouldShowCheckinPrompt(today), false);
    assert.equal(shouldShowCheckinPrompt({ show: true, server_date: "2026-07-23" }), true);
  } finally {
    restore();
  }
});
