import assert from "node:assert/strict";
import test from "node:test";

import { postActivityFeedback, postHideRewardsCenter } from "./activity-api.js";

test("postActivityFeedback sends the optional country code", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ code: 200, data: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await postActivityFeedback(
      { token: "token" },
      {
        content: "Need more rewards",
        clientRequestId: "d290f1ee-6c54-4b01-90e6-d701748f0851",
        contactEmail: "user@example.com",
        locale: "en",
        countryCode: "PK",
      },
    );
    assert.equal(request.init.headers.Authorization, "Bearer token");
    assert.deepEqual(JSON.parse(request.init.body), {
      content: "Need more rewards",
      client_request_id: "d290f1ee-6c54-4b01-90e6-d701748f0851",
      contact_email: "user@example.com",
      locale: "en",
      country_code: "PK",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("postHideRewardsCenter authenticates without sending user or device identifiers", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ code: 200, data: { success: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await postHideRewardsCenter({ token: "activity-token" });
    assert.match(request.url, /\/api\/v1\/ops\/activity\/rewards-center\/hide$/);
    assert.equal(request.init.method, "POST");
    assert.equal(request.init.headers.Authorization, "Bearer activity-token");
    assert.equal(request.init.body, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
