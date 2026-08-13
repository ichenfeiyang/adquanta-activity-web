import assert from "node:assert/strict";
import test from "node:test";

import { checkinUiMixin } from "./activity-center-checkin-ui.js";
import { initActivityLocale } from "./i18n/activity-locale.js";

function classList() {
  const values = new Set();
  return {
    add: (...items) => items.forEach((item) => values.add(item)),
    remove: (...items) => items.forEach((item) => values.delete(item)),
    contains: (item) => values.has(item),
    toggle: (item, force) => {
      if (force === true) values.add(item);
      else if (force === false) values.delete(item);
      else if (values.has(item)) values.delete(item);
      else values.add(item);
      return values.has(item);
    },
  };
}

function element() {
  return {
    children: [],
    dataset: {},
    className: "",
    textContent: "",
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this[name] = String(value); },
    removeAttribute(name) { delete this[name]; },
  };
}

test("completed V2 signin paints the 1/7 progress and Day 1 checkmark", async () => {
  await initActivityLocale({ locale: "en", force: true });
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => element(), getElementById: () => null };

  const pill = element();
  const container = element();
  const buttonLabel = element();
  const button = {
    ...element(),
    classList: classList(),
    querySelector: (selector) => selector === "span" ? buttonLabel : null,
  };
  const ui = {
    ...checkinUiMixin,
    elements: {
      checkinPill: pill,
      checkinDaysContainer: container,
      signinTimerBtn: button,
    },
    config: {},
  };

  try {
    ui.updateCheckin({
      continuous_days: 1,
      days: [{ day: 1, coin: 35, video_coin: 70, current: true, received: true, video_received: false }],
    });

    assert.equal(pill.textContent, "1/7 Days");
    assert.match(container.children[0].className, /tc-checkin-day--done/);
    assert.equal(container.children[0].children[0].children[0].textContent, "✓");
    assert.equal(button.classList.contains("is-completed"), false);
    assert.equal(buttonLabel.textContent, "Claim Today’s Reward");
  } finally {
    globalThis.document = previousDocument;
  }
});
