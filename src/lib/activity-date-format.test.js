import assert from "node:assert/strict";
import test from "node:test";
import { formatActivityRecordDate } from "./activity-date-format.js";

test("formatActivityRecordDate uses recharge record format with 24-hour time", () => {
  assert.equal(formatActivityRecordDate(new Date(2026, 6, 10, 9, 5)), "Jul 10, 2026 • 09:05");
});

test("formatActivityRecordDate preserves invalid values and supports fallback", () => {
  assert.equal(formatActivityRecordDate("", "—"), "—");
  assert.equal(formatActivityRecordDate("bad-date", "—"), "bad-date");
});
