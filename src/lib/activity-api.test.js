import assert from "node:assert/strict";
import test from "node:test";

import {
  getActivityInfo,
  getChargeRecords,
  getTremendousRecords,
  postActivityVideo,
  postActivityFeedback,
  postCheckinChest,
  prepareActivityVideo,
} from "./activity-api.js";

test("redeem history filters by provider on the server before pagination", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(JSON.stringify({
      code: 200,
      data: [{ order_id: "order-1", provider_type: "server-filtered" }],
      pagination: { page: 2, per_page: 1, total: 1 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const ding = await getChargeRecords({ token: "token" }, { limit: 1, offset: 1 });
    const tremendous = await getTremendousRecords({ token: "token" }, { limit: 1, offset: 1 });

    assert.equal(new URL(requests[0], "https://activity.invalid").searchParams.get("provider_type"), "dingconnect");
    assert.equal(new URL(requests[1], "https://activity.invalid").searchParams.get("provider_type"), "tremendous");
    assert.equal(ding.data.records.length, 1);
    assert.equal(tremendous.data.records.length, 1);
    assert.equal(ding.data.pagination.total, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("postActivityVideo keeps the client-complete idempotency key stable for one prepared session", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url, init });
    const body = init.method === "POST"
      ? {
          code: 200,
          data: {
            join: { reward_coin: 3, coin_balance: 13 },
            payload: { success: true },
          },
        }
      : {
          code: 200,
          data: {
            task_state_available: true,
            user: { user_id: "user_complete", coin_balance: 10 },
            tasks: [{
              task_id: "watch_complete",
              task_type: "watch_ad",
              state: "pending_ad",
              available_actions: ["client_complete"],
              state_detail: {
                ad_session: {
                  session_id: "adsess_complete",
                  status: "pending_ad",
                  next_client_action: "show_ad",
                  expires_at: "2099-01-01T00:00:00Z",
                },
              },
            }],
          },
        };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const options = { token: "complete-session-token" };
    await getActivityInfo({ ...options, gaClientId: "123.456" });
    await postActivityVideo(options, {
      session_id: "adsess_complete",
      ad_event_id: "event_complete",
    });
    await postActivityVideo(options, {
      session_id: "adsess_complete",
      ad_event_id: "event_complete",
    });

    const actionBodies = requests
      .filter((request) => request.init.method === "POST")
      .map((request) => JSON.parse(request.init.body));
    assert.equal(actionBodies.length, 2);
    assert.equal(actionBodies[0].idempotent_key, "watch-ad-complete-adsess_complete");
    assert.equal(actionBodies[1].idempotent_key, actionBodies[0].idempotent_key);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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
    assert.equal(request.url, "/api/v2/activity/feedback");
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

test("postCheckinChest forwards the caller-provided idempotency key", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url, init });
    const body = init.method === "POST"
      ? { code: 200, data: { payload: { success: true } } }
      : {
          code: 200,
          data: {
            tasks: [{ task_id: "signin_chest", task_type: "signin" }],
          },
        };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await postCheckinChest(
      { token: "checkin-chest-idempotency-token" },
      {
        chest_id: "chest_7",
        action: "claim",
        ad_event_id: "ad_event_7",
        idempotent_key: "stable-chest-claim-key",
      },
    );

    const actionRequest = requests.find((request) => request.init.method === "POST");
    assert.ok(actionRequest);
    assert.deepEqual(JSON.parse(actionRequest.init.body), {
      idempotent_key: "stable-chest-claim-key",
      ad_event_id: "ad_event_7",
      extra: { chest_id: "chest_7", action: "claim" },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("prepareActivityVideo reuses the pending session returned by config after a refresh", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({
      code: 200,
      data: {
        task_state_available: true,
        user: { user_id: "user_pending", coin_balance: 10 },
        tasks: [{
          task_id: "watch_pending",
          task_type: "watch_ad",
          state: "pending_ad",
          available_actions: ["client_complete"],
          state_detail: {
            ad_session: {
              session_id: "adsess_pending",
              custom_data: "custom_pending",
              status: "pending_ad",
              next_client_action: "show_ad",
              expires_at: "2099-01-01T00:00:00Z",
            },
          },
        }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const options = { token: "pending-session-token", gaClientId: "123.456" };
    await getActivityInfo(options);
    const result = await prepareActivityVideo(options);

    assert.equal(result.code, 200);
    assert.equal(result.data.reused, true);
    assert.equal(result.data.session_id, "adsess_pending");
    assert.equal(result.data.custom_data, "custom_pending");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].init.method, "GET");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("prepareActivityVideo creates a new session when cached pending state is expired", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url, init });
    const isPrepare = String(url).endsWith("/tasks/watch_expired/actions/prepare");
    const body = isPrepare
      ? {
          code: 200,
          data: {
            join: {
              ad_session: {
                session_id: "adsess_new",
                custom_data: "custom_new",
                status: "pending_ad",
                expires_at: "2099-01-01T00:00:00Z",
              },
            },
          },
        }
      : {
          code: 200,
          data: {
            task_state_available: true,
            user: { user_id: "user_expired", coin_balance: 10 },
            tasks: [{
              task_id: "watch_expired",
              task_type: "watch_ad",
              state: "pending_ad",
              available_actions: ["client_complete"],
              state_detail: {
                ad_session: {
                  session_id: "adsess_expired",
                  status: "pending_ad",
                  expires_at: "2000-01-01T00:00:00Z",
                },
              },
            }],
          },
        };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const options = { token: "expired-session-token", gaClientId: "123.456" };
    await getActivityInfo(options);
    const result = await prepareActivityVideo(options);

    assert.equal(result.data.reused, undefined);
    assert.equal(result.data.session_id, "adsess_new");
    assert.equal(requests.length, 2);
    assert.equal(requests[1].init.method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
