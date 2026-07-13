import assert from "node:assert/strict";
import test from "node:test";
import { resolveIndexHtmlPathname } from "./reload-activity-page.js";

test("resolveIndexHtmlPathname maps virtual SPA paths to index.html", () => {
  assert.equal(resolveIndexHtmlPathname("/activity-center"), "/index.html");
  assert.equal(resolveIndexHtmlPathname("/gold-coins-exchange"), "/index.html");
  assert.equal(resolveIndexHtmlPathname("/topup-status"), "/index.html");
  assert.equal(resolveIndexHtmlPathname("/"), "/index.html");
  assert.equal(resolveIndexHtmlPathname("/index.html"), "/index.html");
  assert.equal(resolveIndexHtmlPathname("/campaign/index.html"), "/campaign/index.html");
  assert.equal(resolveIndexHtmlPathname("/campaign/activity-center"), "/campaign/index.html");
});
