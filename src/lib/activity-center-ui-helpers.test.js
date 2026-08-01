import assert from "node:assert/strict";
import test from "node:test";
import {
  LUCKY_SPIN_PROMO_MAX_COIN,
  loadDeferredImage,
  resolveCompletedVideoCount,
} from "./activity-center-ui-helpers.js";

test("lucky spin promotion advertises up to 200 coins", () => {
  assert.equal(LUCKY_SPIN_PROMO_MAX_COIN, 200);
});

test("lucky spin progress displays watched videos instead of remaining videos", () => {
  assert.equal(resolveCompletedVideoCount(2, 20, 18), 2);
  assert.equal(resolveCompletedVideoCount(2, 20, null), 2);
  assert.equal(resolveCompletedVideoCount(25, 20, null), 20);
});

test("modal illustrations are loaded only when their modal opens", () => {
  let source = "";
  const image = {
    dataset: { src: "/images/later.png" },
    getAttribute(name) { return name === "src" ? source : null; },
    set src(value) { source = value; },
  };

  loadDeferredImage(image);
  assert.equal(source, "/images/later.png");
  loadDeferredImage(image);
  assert.equal(source, "/images/later.png");
});
