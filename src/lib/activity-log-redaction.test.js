import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVITY_LOG_REDACTED,
  redactActivityLogBody,
  redactActivityLogValue,
} from "./activity-log-redaction.js";

test("activity API log redaction recursively removes secrets and recipient PII", () => {
  const source = {
    activity_id: "activity-1",
    token: "token-secret",
    app_key: "app-secret",
    content: "private feedback",
    nested: {
      phone_number: "+15551234567",
      contact_email: "person@example.com",
      recipient_info: { recipient_name: "Person", email: "person@example.com" },
      safe_status: "success",
    },
    rows: [{ account_number: "15551234567", prize_id: "prize-1" }],
  };

  const redacted = redactActivityLogValue(source);
  assert.equal(redacted.token, ACTIVITY_LOG_REDACTED);
  assert.equal(redacted.app_key, ACTIVITY_LOG_REDACTED);
  assert.equal(redacted.content, ACTIVITY_LOG_REDACTED);
  assert.equal(redacted.nested.phone_number, ACTIVITY_LOG_REDACTED);
  assert.equal(redacted.nested.contact_email, ACTIVITY_LOG_REDACTED);
  assert.equal(redacted.nested.recipient_info, ACTIVITY_LOG_REDACTED);
  assert.equal(redacted.rows[0].account_number, ACTIVITY_LOG_REDACTED);
  assert.equal(redacted.rows[0].prize_id, "prize-1");
  assert.equal(source.nested.phone_number, "+15551234567");
});

test("activity API body redaction parses JSON without changing the transmitted source", () => {
  const body = JSON.stringify({ phone_number: "15551234567", safe: "value" });
  assert.deepEqual(redactActivityLogBody(body), {
    phone_number: ACTIVITY_LOG_REDACTED,
    safe: "value",
  });
  assert.deepEqual(JSON.parse(body), { phone_number: "15551234567", safe: "value" });
  assert.equal(redactActivityLogBody("opaque-private-body"), ACTIVITY_LOG_REDACTED);
});
